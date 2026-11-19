// Self-study page: course sets, a student's own file, Practice and Exam, progress, review, Labs.
//
//   npm test        (or: node tests/study.js; screenshots go to tests/output/)
//
// Serves the repository on 127.0.0.1:8080. The course folder (sets/) and GitHub's folder listing are simulated.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, 'output'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8080';
const log = (...a) => console.log(...a);
let errors = 0;
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); log('  ✓', m); }

const children = [];
function up(url) { return new Promise(r => http.get(url, res => { res.resume(); r(true); }).on('error', () => r(false))); }
async function waitUp(url) { for (let i = 0; i < 50; i++) { if (await up(url)) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('server did not start: ' + url); }
function stopAll() { for (const c of children) { try { c.kill(); } catch (e) {} } }
const head = p => p.textContent('#ht');
const waitHead = (p, s) => p.waitForFunction(t => document.getElementById('ht').textContent.startsWith(t), s, { timeout: 8000 });

(async () => {
  children.push(spawn('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT], { cwd: ROOT, stdio: 'ignore' }));
  await waitUp(BASE + '/study/');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pics = fs.readFileSync(path.join(FIX, 'pictures.quiz.json'), 'utf8');   // answers C, F, B
  await ctx.route('**/sets/index.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ sets: [{ file: 'demo-course.quiz.json', title: 'Demo course set', description: 'Placeholder course set for testing.', n: 3 }] }) }));
  await ctx.route('**/sets/demo-course.quiz.json', r => r.fulfill({ contentType: 'application/json', body: pics }));
  const S = await ctx.newPage();
  S.on('pageerror', e => { errors++; log('[study pageerror]', e.message); });
  await S.goto(`${BASE}/study/`);

  log('Home');
  await S.waitForSelector('#course .setrow');
  const row = await S.innerText('#course .setrow');
  assert(row.includes('Demo course set') && row.includes('Placeholder course set for testing.') && row.includes('3 cases'), 'course sets are listed with title, description and number of cases');
  assert((await S.textContent('#mine')).includes('None yet'), '“My sets” starts empty');

  log('Practice');
  await S.click('#course [data-course="demo-course.quiz.json"]');
  await S.waitForSelector('fieldset.mode');
  assert(await S.$eval('input[name="mode"][value="practice"]', i => i.checked), 'Practice is the default mode');
  await S.click('#goBtn');
  await S.waitForSelector('#opts .opt');
  assert((await head(S)) === 'Practice · Case 1 of 3' && !(await S.$eval('#labBtn', b => b.hidden)) && (await S.$eval('#submitBtn', b => b.disabled)), 'case 1: the Labs button is there and Submit waits for a choice');
  await S.click('#opts [data-pick="C"]'); await S.click('#submitBtn');
  await S.waitForSelector('#verdict.good');
  assert(!!(await S.$('.opt.correct[data-l="C"]')) && !!(await S.$('.explain')), 'Practice: right or wrong, the answer and the explanation straight after each case');
  await S.click('#nextBtn');
  await S.waitForSelector('#opts [data-pick="F"]');
  await S.click('#opts [data-pick="A"]'); await S.click('#submitBtn');
  await S.waitForSelector('#verdict.bad');
  await S.screenshot({ path: `${OUT}/50-study-practice.png` });
  await S.click('#nextBtn');
  await waitHead(S, 'Practice · Case 3 of 3');

  log('Progress is kept');
  await S.reload();
  await S.waitForSelector('#course .setrow');
  assert((await S.innerText('#course .setrow')).includes('In progress: case 3 of 3 · Practice'), 'after closing the page the list shows where the student stopped');
  await S.click('#course [data-course]'); await S.waitForSelector('#inprog'); await S.click('#goBtn');
  await waitHead(S, 'Practice · Case 3 of 3');
  assert(true, '“Continue” goes back to that case');
  await S.click('#labBtn'); await S.waitForSelector('#lab:not([hidden]) .labr');
  await S.goBack(); await S.waitForSelector('#lab', { state: 'hidden' });
  assert(!!(await S.$('#opts')) && (await head(S)).startsWith('Practice · Case 3'), 'Labs works here too, and Back only closes it');
  await S.click('#opts [data-pick="B"]'); await S.click('#submitBtn');
  await S.waitForSelector('#verdict.good'); await S.click('#nextBtn');
  await S.waitForSelector('#score');
  const rows = await S.$$eval('.resrow', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ')));
  assert((await S.textContent('#score')).trim() === '2 / 3' && rows.length === 3 && rows[0].includes('✓') && rows[0].includes('Placeholder concept one') &&
    rows[0].includes('Hematology and Oncology › Placeholder subtopic › Placeholder entry one') && rows[1].includes('✗'), 'results: the score and each case with ✓ / ✗, topic and concept');
  await S.click('.resrow[data-rev="1"]');
  await S.waitForSelector('#verdict.bad');
  assert((await head(S)) === 'Review · Case 2 of 3', 'tapping a case opens its answer and explanation');
  await S.click('[data-do="results"]'); await S.waitForSelector('#score');
  await S.screenshot({ path: `${OUT}/51-study-results.png` });

  log('Exam');
  await S.click('#againBtn'); await S.waitForSelector('#last');
  assert((await S.textContent('#last')).includes('2 / 3'), 'the set remembers the last score');
  await S.check('#modeExam'); await S.click('#goBtn');
  await waitHead(S, 'Exam · Case 1 of 3');
  await S.click('#opts [data-pick="A"]');
  assert((await S.textContent('#submitBtn')).includes('Submit & next case'), 'Exam: “Submit & next case”');
  await S.click('#submitBtn');
  await waitHead(S, 'Exam · Case 2 of 3');
  assert(!(await S.$('#verdict')) && !(await S.$('.explain')) && !(await S.$('.opt.correct')), 'no answer or explanation during the exam');
  await S.click('#opts [data-pick="F"]'); await S.click('#submitBtn');
  await waitHead(S, 'Exam · Case 3 of 3');
  await S.click('#opts [data-pick="B"]');
  assert((await S.textContent('#submitBtn')).includes('Submit & finish'), 'the last case: “Submit & finish”');
  await S.click('#submitBtn');
  await S.waitForSelector('#score');
  assert((await S.textContent('#score')).trim() === '2 / 3' && !!(await S.$('#reviewBtn')), 'then the score and “Review answers”');
  await S.click('#reviewBtn');
  await S.waitForSelector('#verdict.bad');
  await S.keyboard.press('Enter');
  await waitHead(S, 'Review · Case 2 of 3');
  assert(!!(await S.$('#verdict.good')), 'the review steps through every case (Enter works on a laptop)');

  log('My sets');
  await S.click('#homeBtn'); await S.waitForSelector('#course .setrow');
  assert((await S.innerText('#course .setrow')).includes('Last score 2 / 3 (67%) · Exam'), 'the list shows the last score');
  await S.setInputFiles('#file', path.join(FIX, 'sample-25.quiz.json'));
  await S.waitForSelector('fieldset.mode');
  assert((await S.textContent('main')).includes('25 cases · from a file'), 'a quiz file the teacher sends opens as a set');
  await S.goBack();
  await S.waitForSelector('#mine .setrow');
  assert((await S.innerText('#mine')).includes('Sample quiz'), '… and stays under “My sets”; Back returns to the list');
  await S.setInputFiles('#file', { name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('not json') });
  await S.waitForSelector('#homemsg .banner');
  assert((await S.textContent('#homemsg')).includes('is not a quiz file'), 'a file that is not a quiz is refused with a message');
  await S.setInputFiles('#file', { name: 'broken.quiz.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'acsom-live-quiz', version: 1, questions: [{ stem: 'x', lead: 'y?', options: ['a', 'b'], answer: 'Z' }] })) });
  await S.waitForFunction(() => document.getElementById('homemsg').textContent.includes('problems'));
  assert((await S.textContent('#homemsg')).includes('Case 1'), 'a broken quiz file is refused, naming the problem');
  await S.click('#mine [data-forget]');
  await S.waitForSelector('#mine >> text=None yet');
  assert(true, 'a set can be removed from the device');
  await S.screenshot({ path: `${OUT}/52-study-home.png` });

  log('Course sets uploaded on GitHub');
  await ctx.route('https://api.github.com/repos/test-owner/live-quiz/contents/sets', r => r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify([{ name: 'demo-course.quiz.json', type: 'file' }, { name: 'new-upload_set.quiz.json', type: 'file' }, { name: 'README.md', type: 'file' }, { name: 'index.json', type: 'file' }]) }));
  const G = await ctx.newPage();
  G.on('pageerror', e => { errors++; log('[study 2 pageerror]', e.message); });
  await G.goto(`${BASE}/study/?gh=test-owner/live-quiz`);
  await G.waitForSelector('#course .setrow >> nth=1');
  const titles = await G.$$eval('#course .setrow .st', ts => ts.map(t => t.textContent));
  assert(titles.length === 2 && titles.includes('Demo course set') && titles.includes('New upload set'), 'a file uploaded to sets/ on GitHub is listed even before the index is rebuilt (other files ignored)');

  log('Empty and offline lists');
  await ctx.unroute('**/sets/index.json');
  await ctx.route('**/sets/index.json', r => r.abort());
  const O = await ctx.newPage();
  O.on('pageerror', e => { errors++; log('[study 3 pageerror]', e.message); });
  await O.goto(`${BASE}/study/`);
  await O.waitForSelector('#course .setrow');
  assert((await O.textContent('#course')).includes('Test pack with pictures') && (await O.textContent('#course')).includes('Couldn’t check for new course sets'), 'offline: the course sets opened before are still listed, with a note');
  log('On a laptop');
  const lctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await lctx.route('**/sets/index.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ sets: [{ file: 'demo-course.quiz.json', title: 'Demo course set', n: 3 }] }) }));
  await lctx.route('**/sets/demo-course.quiz.json', r => r.fulfill({ contentType: 'application/json', body: pics }));
  const L = await lctx.newPage();
  L.on('pageerror', e => { errors++; log('[study laptop pageerror]', e.message); });
  await L.goto(`${BASE}/study/`);
  await L.click('#course [data-course]'); await L.waitForSelector('#goBtn'); await L.click('#goBtn');
  await L.waitForSelector('#opts .opt');
  const lay = await L.evaluate(() => { const a = document.querySelector('.caseL').getBoundingClientRect(), b = document.querySelector('.caseR').getBoundingClientRect();
    return { side: b.left >= a.right && Math.abs(a.top - b.top) < 40, font: parseFloat(getComputedStyle(document.documentElement).fontSize), over: document.documentElement.scrollWidth > innerWidth }; });
  assert(lay.side && lay.font > 17 && !lay.over, 'on a laptop the text grows with the window and the case sits beside its options');
  await L.screenshot({ path: `${OUT}/53-study-laptop.png` });
  await lctx.close();

  assert(errors === 0, 'no script errors');
  await browser.close(); stopAll();
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
