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
  await A.addInitScript(() => { window.showOpenFilePicker = undefined; window.showSaveFilePicker = undefined; });
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

  log('Editor and player together');
  const P = await A.newPage(); watch(P, 'player');
  await P.goto(`${BASE}/presenter.html?${PQ}`);
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
