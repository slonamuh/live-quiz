// Editor test: the quiz editor on its own and together with the player, in headless Chromium.
//
//   npm test        (runs e2e.js, security.js, then this file; screenshots go to tests/output/)
//
// Like the other tests it starts its own PeerJS relay (127.0.0.1:9000) and web server (127.0.0.1:8080).
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, 'output'); fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lq-editor-'));
const BASE = 'http://127.0.0.1:8080';
const PQ = 'ph=127.0.0.1&pp=9000&ps=0';
const log = (...a) => console.log(...a);
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); log('  ✓', m); }

const children = [];
function start(cmd, args) { const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' }); children.push(p); return p; }
function up(url) { return new Promise(r => http.get(url, res => { res.resume(); r(true); }).on('error', () => r(false))); }
async function waitUp(url) { for (let i = 0; i < 50; i++) { if (await up(url)) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('server did not start: ' + url); }
function stopAll() { for (const c of children) { try { c.kill(); } catch (e) {} } }

// Run the repository's own checker (tools/make_pack.py) on a saved file: errors, warnings.
// Picture facts from the repository's Python (Pillow): format and size of a data URI.
function imageInfo(dataUri) {
  const out = execFileSync('python3', ['-I', '-c', `import sys, base64, io, json
from PIL import Image
u = sys.stdin.read(); head, b64 = u.split(',', 1); im = Image.open(io.BytesIO(base64.b64decode(b64)))
print(json.dumps({'format': im.format, 'w': im.size[0], 'h': im.size[1], 'chars': len(u)}))`], { input: dataUri });
  return JSON.parse(out.toString());
}
// Test pictures: a large photo-like JPEG and a line drawing (PNG).
function makeImages() {
  execFileSync('python3', ['-I', '-c', `import sys
from PIL import Image, ImageDraw, ImageFilter
w, h = 2600, 1800
noise = Image.effect_noise((w, h), 60).filter(ImageFilter.GaussianBlur(1.2))
grad = Image.linear_gradient('L').resize((w, h))
photo = Image.merge('RGB', (noise, grad, Image.blend(noise, grad, 0.5)))
photo.save(sys.argv[1], quality=95)
d = Image.new('RGB', (1200, 800), 'white'); g = ImageDraw.Draw(d)
for i in range(0, 1200, 100): g.line([(i, 0), (i, 800)], fill='black', width=3)
g.rectangle([300, 300, 900, 600], outline='navy', width=8, fill='lightblue'); d.save(sys.argv[2])`, path.join(TMP, 'photo.jpg'), path.join(TMP, 'diagram.png')]);
}
function checkWithTool(file) {
  const out = execFileSync('python3', ['-I', '-c', `import sys, json; sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'tools'))}); from make_pack import validate
e, w, d = validate(json.load(open(sys.argv[1], encoding='utf-8'))); print(json.dumps({'errors': e, 'warnings': w}))`, file]);
  return JSON.parse(out.toString());
}
async function saveDownload(E, name) {
  const [dl] = await Promise.all([E.waitForEvent('download'), E.click('#saveBtn')]);
  const file = path.join(TMP, name); await dl.saveAs(file);
  return { file, json: JSON.parse(fs.readFileSync(file, 'utf-8')), suggested: dl.suggestedFilename() };
}

const STEM = 'A 34-year-old woman comes to the physician because of fatigue and shortness of breath on exertion for 3 months. She follows a strict vegan diet and takes no supplements. Examination shows pale conjunctivae, a smooth red tongue, and decreased vibration sense in both feet with a positive Romberg sign.\n• Hemoglobin 8.9 g/dL\n• Mean corpuscular volume 112 μm³\n• Reticulocyte count 0.4%';
const WHY = {
  0: 'Folate deficiency also causes macrocytic anemia, as in a patient taking methotrexate, but it does not cause the posterior column signs seen here.',
  1: 'Iron deficiency causes microcytic anemia, as in a menstruating woman with heavy periods; this patient\'s MCV is high.',
  3: 'Thiamine deficiency causes neuropathy in alcohol use disorder, but it does not cause macrocytic anemia.',
  4: 'Vitamin B6 deficiency causes sideroblastic anemia with a low MCV, as in a patient taking isoniazid.'
};

(async () => {
  start(process.execPath, [path.join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9000', '--host', '127.0.0.1', '--path', '/']);
  start('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT]);
  await waitUp('http://127.0.0.1:9000/'); await waitUp(BASE + '/editor.html');
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  let pageErrors = 0;
  const watch = (pg, tag) => pg.on('pageerror', e => { pageErrors++; log(`[${tag} pageerror]`, e.message); });

  // Context A: no file-access API (Safari, Firefox): opening uses the file input, saving downloads a file.
  const A = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
  await A.addInitScript(() => { window.showOpenFilePicker = undefined; window.showSaveFilePicker = undefined; window.__printed = 0; window.print = () => { window.__printed++; }; });
  const E = await A.newPage(); watch(E, 'editor');

  log('A new quiz, written from scratch');
  await E.goto(`${BASE}/editor.html?${PQ}`);
  await E.screenshot({ path: `${OUT}/20-editor-start.png` });
  await E.click('#newBtn');
  assert((await E.textContent('#checks')).includes('case text is missing'), 'an empty case shows what is missing');
  await E.fill('#titleIn', 'Editor Test Quiz');
  await E.fill('#stemIn', STEM);
  await E.fill('#leadIn', 'Supplementation with which of the following would most likely have prevented this condition?');
  const opts = ['Folic acid', 'Iron', 'Cobalamin', 'Thiamine', 'Pyridoxine'];
  for (let i = 0; i < 5; i++) await E.fill(`input[data-o="${i}"]`, opts[i]);
  await E.check('input[data-c="2"]');
  for (const i of [0, 1, 3, 4]) await E.fill(`textarea[data-w="${i}"]`, WHY[i]);
  await E.fill('#expIn', 'Macrocytic anemia with posterior column signs in a strict vegan points to vitamin B12 deficiency. B12 is needed for DNA synthesis and for myelin, so deficiency causes both findings.');
  await E.fill('#objIn', 'Vitamin B12 deficiency: macrocytic anemia plus neurologic signs; folate deficiency has no neurologic signs.');
  await E.waitForSelector('#checks.ok', { timeout: 3000 });
  assert(true, 'a complete case passes all checks');
  await E.screenshot({ path: `${OUT}/21-editor-case.png` });

  log('Checks for common giveaways');
  await E.fill('input[data-o="2"]', 'Cobalamin given as monthly intramuscular injections for life');
  await E.waitForSelector('#checks >> text=clearly the longest');
  assert(true, 'a correct answer that is clearly the longest is flagged');
  await E.fill('input[data-o="2"]', 'Cobalamin');
  await E.fill('#expIn', 'Option B is wrong because the MCV is high.');
  await E.waitForSelector('#checks >> text=refers to an option by its letter');
  assert(true, 'an explanation that names an option by its letter is flagged');
  await E.screenshot({ path: `${OUT}/22-editor-warnings.png` });
  await E.fill('#expIn', 'Macrocytic anemia with posterior column signs in a strict vegan points to vitamin B12 deficiency. B12 is needed for DNA synthesis and for myelin, so deficiency causes both findings.');
  await E.fill('input[data-o="1"]', 'A. Iron');
  await E.waitForSelector('#checks >> text=Remove the letter');
  assert(true, 'a letter typed at the start of an option is flagged');
  await E.fill('input[data-o="1"]', 'Iron');
  await E.waitForSelector('#checks.ok');

  log('Cases: add, duplicate, move, delete');
  await E.click('#addBtn');
  assert((await E.$$('.item')).length === 2 && (await E.textContent('.casehead h2')).includes('Case 2 of 2'), 'Add case inserts a new case after the current one');
  await E.click('.item[data-i="0"]'); await E.click('button[data-act="dup"]');
  assert((await E.$$('.item')).length === 3 && (await E.textContent('.casehead h2')).includes('Case 2 of 3'), 'Duplicate copies the current case');
  await E.click('.item[data-i="2"]');                                   // the empty case
  await E.click('button[data-act="del"]');
  assert((await E.textContent('button[data-act="del"]')).includes('Click again'), 'Delete asks for a second click');
  await E.click('button[data-act="del"]');
  assert((await E.$$('.item')).length === 2, 'the second click deletes the case');
  await E.click('.item[data-i="1"]'); await E.fill('#leadIn', 'Which of the following is the most likely cause of the anemia?');
  await E.click('button[data-act="up"]');
  assert((await E.textContent('.casehead h2')).includes('Case 1 of 2') && (await E.inputValue('#leadIn')).includes('most likely cause'), 'Move up reorders the cases');

  log('Options: removing one keeps the answer and the “why not” lines attached');
  await E.click('.item[data-i="1"]');
  await E.click('button[data-odel="0"]');                                 // remove "Folic acid"
  assert(await E.isChecked('input[data-c="1"]'), 'the correct answer moves with its option (now B)');
  assert((await E.inputValue('textarea[data-w="0"]')) === WHY[1], 'each “why not” stays with its option');
  await E.click('button[data-oup="1"]');                                  // move the correct option up to A
  assert(await E.isChecked('input[data-c="0"]') && (await E.inputValue('input[data-o="0"]')) === 'Cobalamin', 'moving an option carries the tick');

  log('Saving (download, where the browser has no file access)');
  let saved = await saveDownload(E, 'first.quiz.json');
  assert(saved.suggested === 'editor-test-quiz.quiz.json', 'the file is named after the quiz (' + saved.suggested + ')');
  const q2 = saved.json.questions[1];
  assert(saved.json.format === 'acsom-live-quiz' && saved.json.version === 1 && saved.json.questions.length === 2, 'the file is a version-1 quiz pack with both cases');
  assert(q2.options.length === 4 && q2.answer === 'A' && q2.options[0] === 'Cobalamin' && JSON.stringify(Object.keys(q2.why)) === '["B","C","D"]' && q2.why.B === WHY[1], 'answer letter and “why not” keys follow the edited options');
  const tool = checkWithTool(saved.file);
  assert(tool.errors.length === 0, 'the repository checker accepts the saved file');
  assert((await E.textContent('#status')).includes('Downloaded'), 'the status says where the file went');

  log('Paste from an AI assistant');
  const sample = JSON.parse(fs.readFileSync(path.join(FIX, 'sample-25.quiz.json'), 'utf-8'));
  const three = Object.assign({}, sample, { id: 'pasted-01', title: 'Pasted <b>quiz</b>', questions: sample.questions.slice(0, 3) });
  three.questions[0] = Object.assign({}, three.questions[0], { stem: three.questions[0].stem + ' <img src=x onerror="window.__pwned=1">', options: three.questions[0].options.map((o, i) => i ? o : o + ' <script>window.__pwned=2</script>') });
  const reply = 'Here is your quiz pack.\n\n```json\n' + JSON.stringify(three, null, 2).replace(/\n  \]\n\}$/, ',\n  ]\n}') + '\n```\n\nReport: suggested file name pasted-01.quiz.json';
  await E.click('#homeBtn');
  await E.click('#pasteBtn');
  await E.fill('#pasteBox', reply);
  await E.click('.modal >> text=Open in editor');
  await E.waitForSelector('.item');
  assert((await E.$$('.item')).length === 3 && (await E.textContent('#status')).includes('Pasted 3 cases'), 'a whole AI reply (text around the code block, a trailing comma) opens as 3 cases');
  assert(!(await E.evaluate(() => window.__pwned)) && !(await E.$('img[src="x"]')) && (await E.inputValue('#titleIn')) === 'Pasted <b>quiz</b>', 'markup in pasted text stays text; nothing runs');

  log('Opening a file with pictures and extra fields: nothing is lost');
  const pics = JSON.parse(fs.readFileSync(path.join(FIX, 'pictures.quiz.json'), 'utf-8'));
  pics.notes = 'kept by the editor'; pics.questions[0].trap = { B: 'looks similar' };
  const picsFile = path.join(TMP, 'pictures-extra.quiz.json'); fs.writeFileSync(picsFile, JSON.stringify(pics));
  await E.click('#homeBtn');
  await E.waitForSelector('.modal >> text=Discard unsaved changes?');
  assert(true, 'leaving a quiz with unsaved changes asks first');
  await E.click('.modal >> text=Discard changes');
  await E.setInputFiles('#fileInput', picsFile);
  await E.waitForSelector('.item');
  assert(await E.$('.pic img'), 'a case picture is shown in the editor');
  await E.fill('#titleIn', 'Pictures (edited)');
  saved = await saveDownload(E, 'pictures-out.quiz.json');
  const o = saved.json;
  assert(saved.suggested === 'pictures-extra.quiz.json', 'saving keeps the file name it was opened with');
  assert(JSON.stringify(o.images) === JSON.stringify(pics.images) && o.questions[0].image === pics.questions[0].image && o.questions[0].imageCaption === pics.questions[0].imageCaption, 'pictures and captions are saved unchanged');
  assert(o.notes === 'kept by the editor' && JSON.stringify(o.questions[0].trap) === JSON.stringify(pics.questions[0].trap) && o.title === 'Pictures (edited)', 'fields the editor does not know are kept; the edit is saved');

  log('Unsaved changes survive closing the tab');
  await E.fill('#titleIn', 'Pictures (draft)');
  await E.waitForTimeout(900);
  await E.goto(`${BASE}/editor.html?${PQ}`);
  await E.waitForSelector('#resumeBtn');
  await E.click('#resumeBtn');
  assert((await E.inputValue('#titleIn')) === 'Pictures (draft)', 'the start screen offers the unsaved changes, and they come back');


  log('Pictures: choose, drop, paste, caption, remove');
  makeImages();
  await E.click('.item[data-i="2"]');
  const [chooser] = await Promise.all([E.waitForEvent('filechooser'), E.click('[data-slot="image"] [data-pic-add="image"]')]);
  await chooser.setFiles(path.join(TMP, 'photo.jpg'));
  await E.waitForFunction(() => /JPEG/.test((document.querySelector('[data-slot="image"] .meta2') || {}).textContent || ''));
  const meta = await E.textContent('[data-slot="image"] .meta2');
  assert(/^1400 × 969 · JPEG · \d+ KB$/.test(meta.trim()), 'a large photo is resized to 1400 px and stored as JPEG (' + meta.trim() + ')');
  await E.fill('[data-slot="image"] input.cap', 'Peripheral smear, Wright stain');
  const pngB64 = fs.readFileSync(path.join(TMP, 'diagram.png')).toString('base64');
  const fileIn = async (sel, ev) => E.evaluate(({ b64, sel, ev }) => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([u8], 'diagram.png', { type: 'image/png' }));
    const el = document.querySelector(sel);
    el.dispatchEvent(ev === 'paste' ? new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }) : new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, { b64: pngB64, sel, ev });
  await fileIn('[data-slot="explainImage"]', 'drop');
  await E.waitForFunction(() => /PNG/.test((document.querySelector('[data-slot="explainImage"] .meta2') || {}).textContent || ''));
  assert(/^1200 × 800 · PNG/.test((await E.textContent('[data-slot="explainImage"] .meta2')).trim()), 'a flat diagram dropped on the reveal box stays PNG at its own size');
  await E.$eval('.pics', el => el.scrollIntoView()); await E.screenshot({ path: `${OUT}/27-editor-pictures.png` });
  await E.click('.item[data-i="1"]');
  await E.focus('#stemIn');
  await fileIn('#stemIn', 'paste');
  await E.waitForSelector('[data-slot="image"] img');
  assert(true, 'a picture pasted while typing the case goes into “Shown with the case”');
  await E.click('[data-pic-del="explainImage"]');
  assert(!!(await E.$('.pic.empty[data-slot="explainImage"]')), 'Remove empties the picture box');
  saved = await saveDownload(E, 'pics-v2.quiz.json');
  const qs = saved.json.questions, im = saved.json.images;
  const photoInfo = imageInfo(im[qs[2].image]), diagInfo = imageInfo(im[qs[2].explainImage]);
  assert(photoInfo.format === 'JPEG' && Math.max(photoInfo.w, photoInfo.h) === 1400 && photoInfo.chars <= 400 * 1024, `saved photo: JPEG ${photoInfo.w}×${photoInfo.h}, ${Math.round(photoInfo.chars / 1024)} KB embedded (limit 400)`);
  assert(diagInfo.format === 'PNG' && qs[2].imageCaption === 'Peripheral smear, Wright stain', 'saved diagram is PNG; the caption is saved');
  assert(qs[1].image && !qs[1].explainImage && !('chart' in im) && 'histo' in im, 'removed pictures leave the file; pictures still in use stay');
  assert(checkWithTool(saved.file).errors.length === 0, 'the checker accepts the file with the new pictures');

  log('Balancing the answer letters');
  const ten = Object.assign({}, sample, { id: 'skewed-01', title: 'Skewed', questions: sample.questions.slice(0, 10).map((q, i) => {
    if (i >= 8) return q;                                   // cases 1–8 get answer A; case 9 already has it: 9 of 10
    const L = 'ABCDE', a = L.indexOf(q.answer), o = q.options.slice(), why = {};
    [o[0], o[a]] = [o[a], o[0]];
    q.options.forEach((t, j) => { if (j !== a) why[L[o.indexOf(t)]] = q.why[L[j]]; });
    return Object.assign({}, q, { options: o, answer: 'A', why });
  }) });
  await E.click('#homeBtn');
  await E.click('#pasteBtn'); await E.fill('#pasteBox', JSON.stringify(ten)); await E.click('.modal >> text=Open in editor');
  await E.waitForSelector('.item');
  assert((await E.textContent('#summary')).includes('answers A 9'), 'a pasted quiz with 9 of 10 answers on A shows the imbalance');
  await E.click('#balanceBtn');
  await E.waitForSelector('.modal .plan li');
  const planN = (await E.$$('.modal .plan li')).length;
  await E.screenshot({ path: `${OUT}/25-editor-balance.png` });
  await E.click('.modal .acts button >> text=Balance');
  assert((await E.textContent('#summary')).includes('answers A 2 · B 2 · C 2 · D 2 · E 2'), `Balance moves the answer in ${planN} cases: 2 of each letter`);
  saved = await saveDownload(E, 'balanced.quiz.json');
  const kept = saved.json.questions.every((q, i) => {
    const orig = ten.questions[i], L = 'ABCDE';
    if (q.options[L.indexOf(q.answer)] !== orig.options[L.indexOf(orig.answer)]) return false;
    return q.options.every((t, j) => j === L.indexOf(q.answer) || q.why[L[j]] === orig.why[L[orig.options.indexOf(t)]]);
  });
  assert(kept, 'every case keeps its correct option and each “why not” line stays with its option');
  await E.click('.toast >> text=Undo');
  assert((await E.textContent('#summary')).includes('answers A 9'), 'Undo puts the letters back');
  await E.selectOption('select[data-act="moveans"]', '3');
  assert(await E.isChecked('input[data-c="3"]') && (await E.textContent('.toast')).includes('moved to D'), '“Move the correct answer to” D swaps it into place');

  log('Drag a case to a new place');
  const labels = async () => E.$$eval('.item .s', els => els.map(e => e.textContent));
  const before = await labels(), box = await (await E.$('.item[data-i="2"]')).boundingBox();
  await E.dragAndDrop('.item[data-i="0"]', '.item[data-i="2"]', { targetPosition: { x: 20, y: box.height - 3 } });
  const after = await labels();
  assert(after[2] === before[0] && after[0] === before[1] && after[1] === before[2], 'dragging case 1 below case 3 moves it to position 3');

  log('Print sheets');
  await E.click('#printBtn'); await E.click('.modal input[value="q"]'); await E.click('.modal .acts button >> text=Print');
  await E.waitForFunction(() => window.__printed === 1);
  const pq = await E.evaluate(() => ({ n: document.querySelectorAll('#printView .q').length, text: document.getElementById('printView').textContent }));
  assert(pq.n === 10 && !/Answer key|Answer:|Take-home|Why not/.test(pq.text), 'Questions only: 10 cases and no answers anywhere');
  await E.click('#printBtn'); await E.click('.modal input[value="x"]'); await E.click('.modal .acts button >> text=Print');
  await E.waitForFunction(() => window.__printed === 2);
  const px = await E.evaluate(() => ({ rows: document.querySelectorAll('#printView table tr').length, text: document.getElementById('printView').textContent }));
  assert(px.rows === 11 && /Explanations/.test(px.text) && /Why not the others/.test(px.text) && /Take-home/.test(px.text), 'Everything: answer key table and every explanation');
  await E.emulateMedia({ media: 'print' });
  await E.screenshot({ path: `${OUT}/26-editor-print.png`, fullPage: true });
  assert(!(await E.isVisible('#app')) && (await E.isVisible('#printView')), 'on paper only the print sheet appears');
  await E.emulateMedia({ media: 'screen' });
  await E.click('#homeBtn'); await E.click('.modal >> text=Discard changes');
  await E.click('#newBtn'); await E.fill('#titleIn', 'Unsaved draft'); await E.waitForTimeout(900);   // leave a draft for the next part

  log('Editor and player together');
  const P = await A.newPage(); watch(P, 'player');
  await P.goto(`${BASE}/?${PQ}`);
  await P.setInputFiles('#file', path.join(FIX, 'sample-25.quiz.json'));
  await P.waitForSelector('.net.ok', { timeout: 20000 });
  await P.screenshot({ path: `${OUT}/23-lobby-edit.png` });
  await P.click('#editBtn');
  await P.waitForSelector('.modal >> text=You have unsaved changes');
  assert(true, 'opening another quiz from the player protects the unsaved draft');
  await P.click('.modal >> text=Discard and open');
  await P.waitForSelector('.item');
  assert((await P.$$('.item')).length === 25, 'Edit in the player lobby opens that quiz in the editor');
  await P.fill('#titleIn', 'Sample 25 (edited)');
  await P.click('.item[data-i="0"]');
  await P.click('#playBtn');
  await P.waitForSelector('.net.ok', { timeout: 20000 });
  assert((await P.textContent('.settings .pack b')) === 'Sample 25 (edited)', 'Play now opens the edited quiz in the player, ready for students');
  assert(new URL(P.url()).pathname === '/', 'Play now opens the player at the site’s main address');
  await P.click('#changeBtn');
  await P.waitForSelector('#recent .rrow');
  const rows = await P.$$eval('#recent .rrow .rt', els => els.map(e => e.textContent));
  assert(rows.includes('Sample 25 (edited)') && !rows.includes('Sample — 25 Placeholder Questions') && !rows.some(t => t.startsWith('Sample') && t !== 'Sample 25 (edited)'), 'Recent quizzes holds the edited version instead of the old one (' + rows.join(' | ') + ')');
  await P.screenshot({ path: `${OUT}/24-library-edit.png` });
  await P.click('#recent .rrow a.btn >> nth=0');
  await P.waitForSelector('.item');
  assert((await P.inputValue('#titleIn')) === 'Sample 25 (edited)', 'Edit in Recent quizzes opens that quiz in the editor');
  await P.click('#addBtn');
  await P.click('#playBtn');
  await P.waitForSelector('.modal >> text=Fix these first');
  await P.click('.modal >> text=Go to case');
  assert((await P.textContent('.casehead h2')).includes('Case 2 of 26'), 'Play now refuses a quiz the player would reject and shows the case to fix');
  await A.close();

  log('Chrome: save back to the same file');
  const B = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  await B.addInitScript(() => {
    window.__written = []; window.__picks = [];
    const handle = name => ({ name, kind: 'file', getFile: async () => new File([window.__openText || '{}'], name),
      createWritable: async () => ({ write: async t => { window.__written.push({ name, t }); }, close: async () => {} }), requestPermission: async () => 'granted' });
    window.showOpenFilePicker = async () => [handle('lymph-stub.quiz.json')];
    window.showSaveFilePicker = async o => { window.__picks.push(o.suggestedName); return handle('copy-' + o.suggestedName); };
  });
  const F = await B.newPage(); watch(F, 'editor-fs');
  await F.goto(`${BASE}/editor.html?${PQ}`);
  await F.evaluate(t => { window.__openText = t; }, fs.readFileSync(path.join(FIX, 'sample-25.quiz.json'), 'utf-8'));
  await F.click('#openBtn');
  await F.waitForSelector('.item');
  await F.fill('#titleIn', 'Saved in place');
  await F.keyboard.press('Control+s');
  await F.waitForFunction(() => window.__written.length === 1);
  const w1 = await F.evaluate(() => window.__written[0]);
  assert(w1.name === 'lymph-stub.quiz.json' && JSON.parse(w1.t).title === 'Saved in place' && (await F.evaluate(() => window.__picks.length)) === 0, 'Ctrl+S writes back to the file that was opened, without asking where');
  await F.click('#saveAsBtn');
  await F.waitForFunction(() => window.__written.length === 2);
  assert((await F.evaluate(() => window.__picks[0])) === 'lymph-stub.quiz.json' && (await F.evaluate(() => window.__written[1].name)) === 'copy-lymph-stub.quiz.json', 'Save as… asks for a new file');
  assert((await F.textContent('#status')).includes('copy-lymph-stub.quiz.json'), 'the status names the file it saved to');
  await B.close();

  assert(pageErrors === 0, 'no script errors on any page');
  await browser.close(); stopAll(); fs.rmSync(TMP, { recursive: true, force: true });
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
