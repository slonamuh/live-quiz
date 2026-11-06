// End-to-end test: one presenter and several simulated phones, all in headless Chromium.
//
//   npm install && npx playwright install chromium
//   npm test                      (screenshots go to tests/output/)
//
// It starts its own PeerJS relay (127.0.0.1:9000) and a static web server (127.0.0.1:8080)
// serving this repository, so it never touches the public PeerJS server.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, 'output'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8080';
const PQ = 'ph=127.0.0.1&pp=9000&ps=0';          // use the local relay instead of the public one
const log = (...a) => console.log(...a);
let errors = 0;
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); log('  ✓', m); }

const children = [];
function start(cmd, args) { const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' }); children.push(p); return p; }
function up(url) { return new Promise(r => http.get(url, res => { res.resume(); r(true); }).on('error', () => r(false))); }
async function waitUp(url) { for (let i = 0; i < 50; i++) { if (await up(url)) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('server did not start: ' + url); }
function stopAll() { for (const c of children) { try { c.kill(); } catch (e) {} } }

async function answer(s, l, sure) {
  await s.click(`.opt[data-l="${l}"]`);
  await s.click(`button[data-sure="${sure ? 1 : 0}"]`);
  await s.waitForSelector('.dock .msg >> text=Answer sent', { timeout: 10000 });
}
async function phone(browser, url, tag, dark) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  const s = await ctx.newPage();
  s.on('pageerror', e => { errors++; log(`[${tag} pageerror]`, e.message); });
  await s.goto(url); return s;
}
async function lobbyUrl(P) { await P.waitForSelector('#code'); await P.waitForSelector('.net.ok', { timeout: 20000 }); return (await P.textContent('#join .url')).trim(); }

(async () => {
  start(process.execPath, [path.join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9000', '--host', '127.0.0.1', '--path', '/']);
  start('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT]);
  await waitUp('http://127.0.0.1:9000/'); await waitUp(BASE + '/index.html');

  // Local WebRTC between browser contexts needs real host candidates, not mDNS names.
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const P = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true })).newPage();
  P.on('pageerror', e => { errors++; log('[presenter pageerror]', e.message); });
  await P.goto(`${BASE}/presenter.html?${PQ}`);

  log('Library');
  await P.waitForSelector('#file', { state: 'attached' });
  await P.setInputFiles('#file', path.join(FIX, 'not-json.quiz.json'));
  await P.waitForSelector('#loaderr .warn');
  assert((await P.textContent('#loaderr')).includes('not a quiz pack'), 'non-JSON file is rejected with a message');
  await P.setInputFiles('#file', path.join(FIX, 'broken.quiz.json'));
  await P.waitForFunction(() => document.querySelector('#loaderr').textContent.includes('Question 1: needs 2 to 8'));
  assert(true, 'broken pack is rejected, naming the question and the problem');
  await P.setInputFiles('#file', path.join(FIX, 'sample-25.quiz.json'));
  let url = await lobbyUrl(P);
  assert((await P.textContent('.settings .pack')).includes('25 questions'), 'lobby shows the loaded pack');
  assert(url.startsWith(BASE + '/?') && url.includes('ph=127.0.0.1'), 'phone address defaults to this site’s folder');
  await P.screenshot({ path: `${OUT}/01-lobby.png` });

  log('Session with three phones');
  const S = [];
  for (let i = 0; i < 3; i++) S.push(await phone(browser, url, 'S' + i, i === 2));
  for (const s of S) await s.waitForSelector('text=You’re in', { timeout: 25000 });
  await P.waitForFunction(() => document.querySelector('#joined b').textContent === '3', null, { timeout: 15000 });
  await P.click('#startBtn');
  for (const s of S) await s.waitForSelector('.opt');
  await answer(S[0], 'B', true); await answer(S[1], 'A', false);
  assert((await P.$$('.opt .bar')).length === 0, 'results stay hidden while voting is open');
  await answer(S[2], 'B', true);
  await P.waitForSelector('text=Voting closed', { timeout: 10000 });
  assert(true, 'voting closes automatically when everyone has answered');
  await P.click('[data-act="revote"]');
  for (const s of S) await s.waitForSelector('.banner.r2');
  assert((await S[1].textContent('.banner.r2')).includes('Your first answer: A'), 'round 2 shows each phone its first answer');
  await answer(S[0], 'B', true); await answer(S[1], 'A', false); await answer(S[2], 'B', true);
  await P.waitForSelector('text=Voting closed');
  assert((await P.$$('.opt .ghost')).length === 5, 'round 2 results show round 1 for comparison');
  await P.click('[data-act="reveal"]'); await P.waitForSelector('.explain');
  assert(/67%\s*correct \(2 of 3\)/.test(await P.textContent('#status')), 'reveal shows 67% correct (2 of 3)');
  await S[1].waitForSelector('.banner.bad'); await S[0].waitForSelector('.banner.good');
  assert((await S[1].$$('.why li')).length === 4, 'phone shows the four “why not” lines');
  await P.screenshot({ path: `${OUT}/02-reveal.png` });
  await P.click('[data-act="next"]');
  await S[0].waitForSelector('text=Question 2 of 25');
  await answer(S[0], 'D', true);
  await S[0].reload(); await S[0].waitForSelector('.dock .msg >> text=Answer sent: D', { timeout: 25000 });
  assert(true, 'a phone that reloads keeps its answer');

  log('Presenter reload and resume');
  await P.reload();
  await P.waitForSelector('#resumeBtn');
  assert((await P.textContent('.card')).includes('Sample quiz'), 'resume prompt names the quiz');
  await P.click('#resumeBtn');
  await P.waitForSelector('.net.ok', { timeout: 30000 });
  await S[1].waitForSelector('#dot.ok', { timeout: 40000 });
  await P.waitForFunction(() => /1\s*of\s*3 answered/.test(document.querySelector('#status').textContent), null, { timeout: 20000 });
  assert(true, 'session resumes mid-question; phones reconnect; answers kept');
  await P.keyboard.press('Enter'); await P.waitForSelector('text=Voting closed');
  await P.click('[data-act="end"]'); await P.click('[data-act="end"]');
  await P.waitForSelector('.avg');
  await S[0].waitForSelector('.score');
  assert((await S[0].textContent('.score')).trim() === '2 / 2', 'each phone gets its private score');
  const [dl] = await Promise.all([P.waitForEvent('download'), P.click('[data-act="csv"]')]);
  const csvPath = path.join(OUT, 'results.csv'); await dl.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf8').split('\n');
  assert(csv[0].includes('Sample quiz') && csv[1].startsWith('Question,Correct') && csv.length === 4, 'CSV export: title, header, one row per question');

  log('Pictures, 6 options, missing explanation');
  await P.click('[data-act="change"]'); await P.click('[data-act="change"]');
  await P.waitForSelector('#recent .rrow');
  assert((await P.textContent('#recent')).includes('Sample quiz'), 'recent list remembers the loaded quiz');
  await P.setInputFiles('#file', path.join(FIX, 'pictures.quiz.json'));
  url = await lobbyUrl(P);
  assert((await P.textContent('.settings')).includes('Question 3 has no explanation'), 'lobby warns about a missing explanation');
  const T = [];
  for (let i = 0; i < 2; i++) T.push(await phone(browser, url, 'T' + i));
  for (const s of T) await s.waitForSelector('text=You’re in', { timeout: 25000 });
  await P.waitForFunction(() => document.querySelector('#joined b').textContent === '2', null, { timeout: 15000 });
  await P.click('#startBtn');
  await P.waitForSelector('#left figure.qimg img');
  for (const s of T) await s.waitForFunction(() => { const i = document.querySelector('.stem + figure.qimg img'); return i && i.complete && i.naturalWidth > 1000; }, null, { timeout: 20000 });
  assert(true, 'a ~300 KB picture reaches the phones intact');
  const late = await phone(browser, url, 'late');
  await late.waitForFunction(() => { const i = document.querySelector('figure.qimg img'); return i && i.naturalWidth > 1000; }, null, { timeout: 25000 });
  assert(true, 'a late joiner also receives the picture');
  await P.screenshot({ path: `${OUT}/03-picture.png` });
  await T[0].screenshot({ path: `${OUT}/04-phone-picture.png`, fullPage: true });
  await P.click('#left figure.qimg img'); await P.waitForSelector('.zoomover.open');
  await P.keyboard.press('Escape');
  assert(!(await P.$('.zoomover.open')), 'presenter picture enlarges and closes with Escape');
  await T[0].click('figure.qimg img'); await T[0].waitForSelector('.zoom img');
  await T[0].click('.zoom .x'); assert(!(await T[0].$('.zoom')), 'phone picture opens full screen and closes');
  for (const s of T.concat([late])) await answer(s, 'C', true);
  await P.waitForSelector('text=Voting closed'); await P.keyboard.press('Enter');
  await P.waitForSelector('.explain'); await P.keyboard.press('Enter');
  for (const s of T) await s.waitForSelector('text=Question 2 of 3');
  assert((await T[0].$$('.opt')).length === 6 && (await P.$$('.opt')).length === 6, 'six options on phone and screen');
  for (const s of T.concat([late])) await answer(s, 'F', true);
  await P.waitForSelector('text=Voting closed'); await P.keyboard.press('Enter');
  await P.waitForSelector('.explain figure.qimg img');
  await T[1].waitForFunction(() => { const i = document.querySelector('.explain figure.qimg img'); return i && i.naturalWidth > 500; }, null, { timeout: 15000 });
  assert(/100%\s*correct/.test(await P.textContent('#status')), 'option F scores as correct');
  assert(true, 'explanation picture shown on screen and phones');
  await P.keyboard.press('Enter');
  for (const s of T) await s.waitForSelector('text=Question 3 of 3');
  assert((await T[0].$$('.opt')).length === 4, 'four options');
  for (const s of T.concat([late])) await answer(s, 'B', false);
  await P.waitForSelector('text=Voting closed'); await P.keyboard.press('Enter');
  await T[0].waitForSelector('.banner.good');
  assert(!(await T[0].$('.why')) && !(await P.$('.explain h3')), 'no explanation → no empty “why not” section');
  await P.keyboard.press('Enter');
  await T[0].waitForSelector('.score');
  assert((await T[0].textContent('.score')).trim() === '3 / 3', 'phone score 3 / 3');

  log('Recent quizzes');
  await P.click('[data-act="change"]'); await P.click('[data-act="change"]');
  await P.waitForSelector('#recent .rrow');
  assert((await P.$$('#recent .rrow')).length === 2, 'recent list has both quizzes');
  await P.click('#recent .rrow:has-text("Sample quiz") [data-use]');
  await P.waitForSelector('.settings .pack');
  assert((await P.textContent('.settings .pack')).includes('25 questions'), '“Use” reopens a quiz without the file');

  log('Timer');
  await P.selectOption('#t1', '30');
  await P.click('#startBtn');
  await P.waitForSelector('#timer');
  await P.waitForSelector('text=Voting closed', { timeout: 40000 });
  assert(true, 'the timer closes voting at 0:00');

  assert(errors === 0, 'no script errors on the presenter or any phone');
  await browser.close();
  stopAll();
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
