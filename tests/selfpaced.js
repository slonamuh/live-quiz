// Self-paced (always an exam): every phone moves through the cases on its own; the room's screen shows only progress.
//
//   npm test        (or: node tests/selfpaced.js; screenshots go to tests/output/)
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

// The fixture's cases: 1 answer C, 2 answer F, 3 answer B. A phone tells which one it shows by its first words.
const CASES = { 'Test case one': 'C', 'Test case two': 'F', 'Test case three': 'B' };
async function shown(s) { const t = await s.textContent('.stem'); return Object.keys(CASES).find(k => t.includes(k)); }
async function answer(s, l) {
  await s.click(`.opt[data-l="${l}"]`);
  await s.click('button[data-sure="1"]');
}
async function phone(browser, url, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const s = await ctx.newPage();
  s.on('pageerror', e => { errors++; log(`[${tag} pageerror]`, e.message); });
  await s.goto(url); return s;
}
async function lobbyUrl(P) { await P.waitForSelector('#code'); await P.waitForSelector('.net.ok', { timeout: 20000 }); return (await P.waitForSelector('#copyBtn'), await P.getAttribute('#copyBtn', 'data-url')).trim(); }
const head = s => s.textContent('#ht');
const waitHead = (s, t) => s.waitForFunction(x => document.getElementById('ht').textContent.startsWith(x), t, { timeout: 10000 });
const num = async (P, sel) => (await P.textContent(sel)).trim();

(async () => {
  start(process.execPath, [path.join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9000', '--host', '127.0.0.1', '--path', '/']);
  start('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT]);
  await waitUp('http://127.0.0.1:9000/'); await waitUp(BASE + '/join/');

  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const P = await ctx.newPage();
  P.on('pageerror', e => { errors++; log('[player pageerror]', e.message); });
  await P.goto(`${BASE}/?${PQ}`);
  await P.setInputFiles('#file', path.join(FIX, 'pictures.quiz.json'));
  let url = await lobbyUrl(P);

  log('Lobby');
  assert(await P.$eval('#modePractice', i => i.checked) && !(await P.$('#paceSelf')), 'Practice (the default) has no Pace choice: it always runs together');
  await P.check('#modeExam');
  assert(await P.$eval('#paceTogether', i => i.checked) && !(await P.$('#orderShuffle')), 'Exam: Together by default; the order choice is only for self-paced');
  await P.check('#paceSelf');
  assert(!(await P.$('#t1')) && (await P.textContent('#tp option:checked')).includes('5 min (90 s per case)'), 'Self-paced: one total time for the set, in minutes (3 cases × 90 s)');
  assert(await P.$eval('#orderSet', i => i.checked) && (await P.textContent('#setup')).includes('The same order on every phone'), 'the order of the cases: as in the set by default');
  { const b = await P.$eval('#startBtn', e => e.getBoundingClientRect().bottom), sc = await P.$eval('#setup', e => e.scrollHeight <= e.clientHeight + 1);
    assert(b <= 768 && sc, '“Start quiz” and the whole panel still fit a 1366×768 laptop'); }
  await P.screenshot({ path: `${OUT}/59-lobby-selfpaced.png` });

  log('Self-paced exam, same order for everyone');
  const T = [await phone(browser, url, 'T0'), await phone(browser, url, 'T1')];
  for (const s of T) await s.waitForSelector('text=You’re in', { timeout: 25000 });
  await P.waitForFunction(() => document.querySelector('#joined b').textContent === '2', null, { timeout: 15000 });
  await P.click('#startBtn');
  await P.waitForSelector('.rungrid');
  for (const s of T) await waitHead(s, 'Exam · Case 1 of 3');
  assert(!(await P.$('.stem, #opts, .opt')) && (await P.textContent('.badge.self')).includes('Exam'), 'the screen shows progress only, no case');
  assert((await num(P, '#rdone')) === '0' && (await P.textContent('.runmain')).includes('0 of 2 students finished'), '… “0 of 2 students finished”');
  await answer(T[0], 'C');
  await waitHead(T[0], 'Exam · Case 2 of 3');
  assert(!(await T[0].$('.banner.good, .banner.bad, .explain')), 'an answer is saved without showing right or wrong, and the next case follows');
  assert((await head(T[1])) === 'Exam · Case 1 of 3' && !!(await T[1].$('.opt:not([disabled])')), 'the other phone is not held up');
  await answer(T[1], 'A'); await waitHead(T[1], 'Exam · Case 2 of 3');
  await P.waitForFunction(() => document.getElementById('rpc').textContent === '33%', null, { timeout: 8000 });
  assert(true, 'completion counts every answer (2 of 6 = 33%)');
  assert((await P.textContent('.runcases')).includes('appear when you end the exam') && !(await P.$('.runcases .hard')), 'one screen: no results per case during the exam');
  await P.screenshot({ path: `${OUT}/60-selfpaced-screen.png` });
  await T[0].screenshot({ path: `${OUT}/61-selfpaced-phone.png` });

  log('Projector window');
  const [A] = await Promise.all([ctx.waitForEvent('page'), P.click('#audChip')]);
  A.on('pageerror', e => { errors++; log('[projector pageerror]', e.message); });
  await A.waitForSelector('.rungrid', { timeout: 15000 });
  await P.waitForSelector('.hard .key');
  assert(!(await A.$('.key, .stem, .runcases .hard')) && (await P.textContent('#projchip')).includes('progress'), 'the projector shows progress only; the laptop sees % correct per case and the answer key');

  log('Finishing');
  await answer(T[0], 'F'); await waitHead(T[0], 'Exam · Case 3 of 3');
  await answer(T[0], 'B');
  await T[0].waitForSelector('text=Finished ✓');
  assert((await T[0].textContent('#app')).includes('The answers and your score come when your teacher ends the exam') && !(await T[0].$('.score')), 'finished: no score until the end');
  await A.waitForFunction(() => document.getElementById('rdone').textContent === '1', null, { timeout: 8000 });
  assert(true, 'the projector counts the student who finished');
  await P.click('[data-act="end"]'); await P.click('[data-act="end"]');
  await P.waitForSelector('.avg'); await A.waitForSelector('.avg');
  await T[0].waitForSelector('.score'); await T[1].waitForSelector('.score');
  assert((await T[0].textContent('.score')).trim() === '3 / 3' && (await T[1].textContent('.score')).trim() === '0 / 3' && (await T[1].$$('.res .rr')).length === 3, 'End: the results, and each phone its score with every case');
  await T[1].click('.res .rr[data-rev="0"]');
  await T[1].waitForSelector('.banner.bad');
  assert((await head(T[1])) === 'Review · Case 1' && !!(await T[1].$('.explain')), 'tapping a case in the results opens its answer and explanation');
  await T[1].click('#backBtn'); await T[1].waitForSelector('.res .rr');
  assert(true, '“Back to the results” goes back');
  await A.close();

  log('Self-paced exam, shuffled, with a total time');
  await P.click('[data-act="newsession"]'); await P.click('[data-act="newsession"]');
  url = await lobbyUrl(P);
  assert(await P.$eval('#modeExam', i => i.checked) && await P.$eval('#paceSelf', i => i.checked), 'the lobby remembers Exam · Self-paced');
  await P.check('#orderShuffle');
  assert((await P.textContent('#setup')).includes('A different order on each phone'), 'Shuffled: a different order on each phone');
  await P.selectOption('#tp', '60');
  for (const s of T) { await s.goto(url); await s.waitForSelector('text=You’re in', { timeout: 25000 }); }
  await P.waitForFunction(() => document.querySelector('#joined b').textContent === '2', null, { timeout: 15000 });
  await P.click('#startBtn');
  await P.waitForSelector('.rungrid');
  for (const s of T) await waitHead(s, 'Exam · Case 1 of 3');
  assert((await P.textContent('.runcases')).includes('appear when you end the exam') && !(await P.$('.runcases .hard')), 'Exam on one screen: progress only, no results per case');
  const seen = [];
  for (let i = 1; i <= 3; i++) {
    await waitHead(T[0], `Exam · Case ${i} of 3`);
    const c = await shown(T[0]); seen.push(c);
    await answer(T[0], i === 1 ? 'A' : CASES[c]);
    assert(!(await T[0].$('.banner.good, .banner.bad, .explain')), `Exam: case ${i} is saved with no answer shown, and the next one follows`);
  }
  assert(new Set(seen).size === 3, 'the phone went through all three cases, each once');
  await T[0].waitForSelector('text=Finished ✓');
  assert((await T[0].textContent('#app')).includes('The answers and your score come when your teacher ends the exam') && !(await T[0].$('.score')), 'Exam: finished, no score yet');
  await waitHead(T[1], 'Exam · Case 1 of 3');
  await answer(T[1], 'A');
  await waitHead(T[1], 'Exam · Case 2 of 3');

  log('Time is up');
  await P.waitForFunction(() => /^\d+:\d\d$/.test(document.getElementById('rtimer').textContent));
  await P.evaluate(() => { const k = 'livequiz-session-v2', s = JSON.parse(localStorage.getItem(k)); s.deadline = Date.now() - 1000; localStorage.setItem(k, JSON.stringify(s)); });
  await P.reload();
  await P.waitForSelector('#resumeBtn');
  assert((await P.textContent('main')).includes('running self-paced'), 'after a reload the player offers to continue the self-paced session');
  await P.click('#resumeBtn');
  await P.waitForSelector('.rungrid');
  await T[1].waitForSelector('text=Time is up', { timeout: 25000 });
  assert((await T[1].textContent('#app')).includes('You answered 1 of 3') && (await num(P, '#rtimer')) === 'Time is up', 'when the time is up, phones stop and say how many they answered');
  await P.click('#more5Btn');
  await waitHead(T[1], 'Exam · Case 2 of 3');
  assert(/^[45]:\d\d$/.test(await num(P, '#rtimer')), '+5 min opens it again where the student was');
  await P.click('[data-act="end"]'); await P.click('[data-act="end"]');
  await P.waitForSelector('.avg');
  await T[0].waitForSelector('.score');
  assert((await T[0].textContent('.score')).trim() === '2 / 3', 'ending the exam sends each phone its score');
  await T[0].click('.res .rr >> nth=0'); await T[0].waitForSelector('.explain');
  assert(true, '… and the answers, case by case');

  assert(errors === 0, 'no script errors on the screens or the phones');
  await browser.close(); stopAll();
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
