// Exam mode: no results or answers during the quiz, then a review of every case asked, then the results.
//
//   npm test        (or: node tests/exam.js; screenshots go to tests/output/)
//
// Uses its own PeerJS relay (127.0.0.1:9000) and static server (127.0.0.1:8080), like tests/e2e.js.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, 'output'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8080';
const PQ = 'ph=127.0.0.1&pp=9000&ps=0';
const log = (...a) => console.log(...a);
let errors = 0;
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); log('  ✓', m); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const children = [];
function start(cmd, args) { const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' }); children.push(p); return p; }
function up(url) { return new Promise(r => http.get(url, res => { res.resume(); r(true); }).on('error', () => r(false))); }
async function waitUp(url) { for (let i = 0; i < 50; i++) { if (await up(url)) return; await sleep(200); } throw new Error('server did not start: ' + url); }
function stopAll() { for (const c of children) { try { c.kill(); } catch (e) {} } }

async function answer(s, l) {
  await s.click(`.opt[data-l="${l}"]`);
  await s.click('button[data-sure="1"]');
  await s.waitForSelector('.dock .msg >> text=Answer sent', { timeout: 10000 });
}
async function phone(browser, url, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const s = await ctx.newPage();
  s.on('pageerror', e => { errors++; log(`[${tag} pageerror]`, e.message); });
  await s.goto(url); return s;
}
async function lobbyUrl(P) { await P.waitForSelector('#code'); await P.waitForSelector('.net.ok', { timeout: 20000 }); return (await P.waitForSelector('#copyBtn'), await P.getAttribute('#copyBtn', 'data-url')).trim(); }
const head = s => s.textContent('#ht');
const qnum = P => P.textContent('.qnum');

(async () => {
  start(process.execPath, [path.join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9000', '--host', '127.0.0.1', '--path', '/']);
  start('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT]);
  await waitUp('http://127.0.0.1:9000/'); await waitUp(BASE + '/join/');

  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const P = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  P.on('pageerror', e => { errors++; log('[player pageerror]', e.message); });
  await P.goto(`${BASE}/?${PQ}`);
  await P.setInputFiles('#file', path.join(FIX, 'pictures.quiz.json'));   // answers: C, F, B
  let url = await lobbyUrl(P);

  log('Lobby');
  assert((await P.$eval('input[name="mode"][value="practice"]', i => i.checked)), 'Practice is the default mode');
  await P.check('#modeExam');
  const T = [await phone(browser, url, 'T0'), await phone(browser, url, 'T1')];
  for (const s of T) await s.waitForSelector('text=You’re in', { timeout: 25000 });
  await P.waitForFunction(() => document.querySelector('#joined b').textContent === '2', null, { timeout: 15000 });
  await P.click('#startBtn');
  for (const s of T) await s.waitForSelector('.opt');
  assert((await P.textContent('.badge.exam')).trim() === 'Exam' && (await head(T[0])).startsWith('Exam · Case 1 of 3'), 'Exam mode: the screen and the phones say “Exam”');

  log('Exam: no results, no answers');
  await answer(T[0], 'C'); await answer(T[1], 'A');
  await P.waitForSelector('#status >> text=Answers saved');
  assert((await P.$$('#opts .bar, #opts .opt.correct, #opts .opt.dim')).length === 0, 'after voting closes the screen shows no results and no answer');
  assert((await P.$$('[data-act="revote"], [data-act="reveal"]')).length === 0 && (await P.textContent('[data-act="next"]')).includes('Next case'), 'no discussion round or reveal; the next step is the next question');
  await T[0].waitForSelector('.banner >> text=The answers come at the end');
  assert((await T[0].textContent('.banner')).includes('Answer saved: C') && (await T[0].$$('.banner.good, .banner.bad, .opt.correct')).length === 0, 'phones show “Answer saved”, not right or wrong');
  await P.screenshot({ path: `${OUT}/40-exam-closed.png` });
  await T[0].screenshot({ path: `${OUT}/41-exam-phone.png` });
  await P.keyboard.press('d'); await sleep(400);
  assert(!(await P.$('.badge.r2')) && !!(await P.$('#status >> text=Answers saved')), 'D does not start a revote in an exam');

  await P.keyboard.press('Enter');
  for (const s of T) await s.waitForSelector('text=Case 2 of 3');
  await answer(T[0], 'F');                                   // T1 does not answer
  await P.keyboard.press('Enter');                           // close voting
  await P.waitForSelector('#status >> text=Answers saved');
  await T[1].waitForSelector('.banner >> text=You didn’t answer this case');
  await P.keyboard.press('Enter');
  for (const s of T) await s.waitForSelector('text=Case 3 of 3');
  await answer(T[0], 'B'); await answer(T[1], 'B');
  await P.waitForSelector('#status >> text=Answers saved');
  assert((await P.textContent('[data-act="next"]')).includes('Finish & review the answers'), 'after the last case: “Finish & review the answers”');

  log('Review at the end');
  await P.keyboard.press('Enter');
  await P.waitForSelector('#left .explain');
  assert((await qnum(P)).startsWith('Case 1') && (await P.textContent('.badge.exam')).includes('review') && !!(await P.$('#opts .opt.correct[data-l="C"]')) && (await P.$$('#opts .bar')).length === 5,
    'the review starts at the first case with the class results, the answer and the explanation');
  await T[0].waitForSelector('.banner.good'); await T[1].waitForSelector('.banner.bad');
  assert((await head(T[0])).startsWith('Review · Case 1'), 'each phone shows its own answer for that case, right or wrong');
  await P.screenshot({ path: `${OUT}/42-exam-review.png` });
  await P.keyboard.press('Enter');
  await T[1].waitForSelector('text=Review · Case 2');
  assert((await T[1].textContent('.banner')).includes('You didn’t answer') && (await P.$$('#opts .opt')).length === 6, '… case 2 (a student who did not answer is told so)');
  await P.keyboard.press('Enter');
  await P.waitForFunction(() => document.querySelector('.qnum').textContent.startsWith('Case 3'));
  assert((await P.textContent('[data-act="next"]')).includes('Show the results'), 'the last case of the review leads to the results');
  await P.keyboard.press('Enter');
  await P.waitForSelector('.avg');
  await T[0].waitForSelector('.score'); await T[1].waitForSelector('.score');
  assert((await T[0].textContent('.score')).trim() === '3 / 3' && (await T[1].textContent('.score')).trim() === '1 / 3', 'then the results and each student’s private score');

  log('Ending an exam early');
  await P.click('[data-act="newsession"]'); await P.click('[data-act="newsession"]');
  url = await lobbyUrl(P);
  assert(await P.$eval('#modeExam', i => i.checked), 'the lobby remembers Exam mode');
  for (const s of T) { await s.goto(url); await s.waitForSelector('text=You’re in', { timeout: 25000 }); }
  await P.waitForFunction(() => document.querySelector('#joined b').textContent === '2', null, { timeout: 15000 });
  await P.click('#startBtn');
  for (const s of T) await s.waitForSelector('.opt');
  await answer(T[0], 'A');
  assert((await P.textContent('[data-act="end"]')).includes('End exam'), 'the end button says “End exam”');
  await P.click('[data-act="end"]'); await P.click('[data-act="end"]');
  await P.waitForSelector('#left .explain');
  assert((await qnum(P)).startsWith('Case 1') && (await P.textContent('[data-act="next"]')).includes('Show the results'), 'ending early still reviews the cases asked so far');
  await T[0].waitForSelector('.banner.bad');
  await P.keyboard.press('Enter');
  await T[0].waitForSelector('.score');
  assert((await T[0].textContent('.score')).trim() === '0 / 1', '… then the results');
  assert((await P.textContent('.endgrid .card p')).includes('2 students · 1 case'), 'counts read “1 case”, not “1 cases”');

  assert(errors === 0, 'no script errors on the screen or the phones');
  await browser.close(); stopAll();
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
