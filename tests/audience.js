// Two screens: the presenter view on the laptop and the projector window, with two simulated phones.
//
//   npm test        (or: node tests/audience.js; screenshots go to tests/output/)
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

async function answer(s, l, sure) {
  await s.click(`.opt[data-l="${l}"]`);
  await s.click(`button[data-sure="${sure ? 1 : 0}"]`);
  await s.waitForSelector('.dock .msg >> text=Answer sent', { timeout: 10000 });
}
async function phone(browser, url, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const s = await ctx.newPage();
  s.on('pageerror', e => { errors++; log(`[${tag} pageerror]`, e.message); });
  await s.goto(url); return s;
}
function watch(page, tag) { page.on('pageerror', e => { errors++; log(`[${tag} pageerror]`, e.message); }); return page; }
const gone = (page, sel) => page.waitForFunction(s => !document.querySelector(s), sel, { timeout: 5000 });

(async () => {
  start(process.execPath, [path.join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9000', '--host', '127.0.0.1', '--path', '/']);
  start('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT]);
  await waitUp('http://127.0.0.1:9000/'); await waitUp(BASE + '/join/');

  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const P = watch(await ctx.newPage(), 'laptop');
  await P.goto(`${BASE}/?${PQ}`);
  await P.setInputFiles('#file', path.join(FIX, 'pictures.quiz.json'));
  await P.waitForSelector('#code'); await P.waitForSelector('.net.ok', { timeout: 20000 });
  const url = (await P.textContent('#join .url')).trim();

  log('Opening the projector window');
  assert(!!(await P.$('#audBtn')), 'the lobby offers “Open projector window”');
  const [A] = await Promise.all([ctx.waitForEvent('page'), P.click('#audBtn')]);
  watch(A, 'projector');
  await A.waitForSelector('.audjoin .qr svg', { timeout: 15000 });
  assert((await A.textContent('.audjoin .code')).trim() === (await P.textContent('#code')).trim(), 'the projector shows the join screen with the same code');
  assert((await A.textContent('.audjoin .url')).trim() === url, '… and the same join link');
  assert((await A.title()).includes('Projector'), 'the projector window is titled as such');
  await P.waitForSelector('#projrow .on');
  assert((await A.$$('.settings, #startBtn, [data-act="edit"]')).length === 0, 'no settings or buttons on the projector');
  await A.screenshot({ path: `${OUT}/20-projector-join.png` });
  await P.screenshot({ path: `${OUT}/21-laptop-lobby.png` });

  log('Phones join; a clicker on the projector window starts the quiz');
  const T = [await phone(browser, url, 'T0'), await phone(browser, url, 'T1')];
  for (const s of T) await s.waitForSelector('text=You’re in', { timeout: 25000 });
  await A.waitForFunction(() => document.querySelector('#joined b').textContent === '2', null, { timeout: 15000 });
  assert(true, 'the projector counts the students who joined');
  await A.keyboard.press('PageDown');
  await P.waitForSelector('.console', { timeout: 10000 });
  await A.waitForSelector('#left .stem');
  assert(true, 'PageDown on the projector window starts the quiz; the laptop switches to the presenter view');
  assert((await A.$$('[data-act="close"], [data-act="end"], #controls button')).length === 0, 'the projector shows no controls');
  assert((await A.$$('.opt.correct, .opt.key, .opt .bar, .keytag')).length === 0, 'the projector shows neither the answer nor results while voting');

  const ext = await P.evaluate(() => screen.isExtended);
  log('  (screen.isExtended here:', ext + ')');
  if (ext !== true) {
    assert((await P.textContent('#mirror')).includes('Only one screen'), 'one screen in use → the laptop warns about mirroring');
    assert((await P.$$('.opt.key')).length === 0 && (await P.textContent('#notes')).includes('Hidden on this screen'), '… and keeps the answer hidden until asked');
    await P.click('#peekBtn');
  }
  await P.waitForSelector('#copts .opt.key[data-l="C"]');
  assert((await P.textContent('#notes')).includes('Correct answer C'), 'the laptop shows the answer and teaching notes');
  assert((await P.textContent('#nextq')).includes('Question 2'), 'the laptop previews the next question');
  assert((await P.textContent('#projchip')).includes('results hidden'), 'the laptop says what the projector shows');

  await answer(T[0], 'A', true);
  await P.waitForFunction(() => /1\s*of\s*2 answered/.test(document.querySelector('#status').textContent), null, { timeout: 10000 });
  assert((await P.textContent('#copts .opt[data-l="A"] .ocount small')).trim() === '1', 'the laptop shows live results while voting is open');
  await A.waitForFunction(() => /1\s*of\s*2 answered/.test(document.querySelector('#status').textContent), null, { timeout: 10000 });
  assert((await A.$$('.opt .bar')).length === 0 && !(await A.innerText('#app')).includes('Correct answer'), 'the projector shows the count only, never the results or the answer');
  await P.screenshot({ path: `${OUT}/22-laptop-voting.png` });
  await A.screenshot({ path: `${OUT}/23-projector-voting.png` });

  log('Picture and QR code on the projector');
  await P.click('#ccase figure.qimg img');
  await A.waitForSelector('.zoomover.open', { timeout: 5000 });
  assert((await P.textContent('#projchip')).includes('enlarged picture'), 'a picture clicked on the laptop is enlarged on the projector');
  await A.keyboard.press('Escape');
  await gone(A, '.zoomover.open'); await gone(P, '.zoomover.open');
  assert(true, 'Escape on either window closes it on both');
  await P.click('#qrchip'); await A.waitForSelector('.qrover.open', { timeout: 5000 });
  assert(!!(await P.$('#qrchip.on')), 'the join-code chip shows the QR code on the projector');
  await A.keyboard.press('q'); await gone(A, '.qrover.open');
  assert(true, 'Q on the projector window hides it again');

  log('Closing voting, revealing');
  await answer(T[1], 'C', true);
  await A.waitForSelector('text=Voting closed', { timeout: 10000 }); await P.waitForSelector('text=Voting closed');
  assert((await A.$$('.opt .bar')).length === 5, 'after voting closes the projector shows the results');
  await P.click('[data-act="reveal"]');
  await A.waitForSelector('#left .explain');
  assert(!!(await A.$('.opt.correct[data-l="C"]')) && (await A.$$('[data-act="togglestem"]')).length === 0, 'reveal: the projector shows the answer and explanation, without links');
  await P.click('#stemBtn'); await A.waitForSelector('#left .stem');
  assert((await P.textContent('#projchip')).includes('question'), 'the laptop can put the question back on the projector');
  await P.click('#stemBtn'); await A.waitForSelector('#left .explain');
  { const all = (await P.innerText('body')) + (await A.innerText('body')) + (await T[0].innerText('body'));
    assert(!/Placeholder concept|Placeholder entry|Placeholder subtopic/.test(all), 'topics and concepts appear on neither screen nor the phones, even after the reveal'); }
  await P.screenshot({ path: `${OUT}/24-laptop-reveal.png` });
  await A.screenshot({ path: `${OUT}/25-projector-reveal.png` });

  log('Reloads');
  await A.reload();
  await A.waitForSelector('#left .explain', { timeout: 15000 });
  await P.waitForSelector('.console', { timeout: 15000 });
  assert(true, 'a projector window that reloads comes back on the same screen');
  await A.keyboard.press('Enter');
  await A.waitForFunction(() => document.querySelector('.qnum') && document.querySelector('.qnum').textContent.startsWith('Question 2'), null, { timeout: 10000 });
  await P.waitForSelector('.console #notes');
  assert(true, 'Enter on the projector window moves to the next question');
  if (!(await P.$('#notes .explain'))) await P.click('#peekBtn');
  await P.click('#notes figure.qimg img'); await P.waitForSelector('.zoomover.open'); await sleep(600);
  assert(!(await A.$('.zoomover.open')), 'the explanation picture enlarges on the laptop only before the reveal');
  await P.keyboard.press('Escape');
  await P.reload();
  await A.waitForSelector('#awaiting', { timeout: 10000 });
  assert(true, 'while the laptop reloads, the projector shows a waiting screen (no stale answers)');
  await P.click('#resumeBtn');
  await P.waitForSelector('.console', { timeout: 20000 });
  await A.waitForFunction(() => document.querySelector('.qnum') && document.querySelector('.qnum').textContent.startsWith('Question 2'), null, { timeout: 20000 });
  assert(true, 'after “Continue”, laptop and projector find each other again');

  log('Back to one screen');
  await Promise.all([A.waitForEvent('close', { timeout: 10000 }), P.click('#closeAudBtn')]);
  await P.waitForSelector('#opts .opt', { timeout: 5000 });
  assert(!(await P.$('.console')), '“Close projector window” closes it and the laptop shows the normal screen again');
  const [A2] = await Promise.all([ctx.waitForEvent('page'), P.click('#audChip')]);
  watch(A2, 'projector 2');
  await P.waitForSelector('.console', { timeout: 15000 }); await A2.waitForSelector('#left .stem');
  assert(true, 'the projector window can be opened in the middle of a question');
  await A2.close();
  await P.waitForSelector('#opts .opt', { timeout: 6000 });
  assert(true, 'closing the projector window with its × also brings the normal screen back');
  const [A3] = await Promise.all([ctx.waitForEvent('page'), P.click('#audChip')]);
  watch(A3, 'projector 3');
  await P.waitForSelector('.console', { timeout: 15000 }); await A3.waitForSelector('#left .stem');
  await P.click('[data-act="end"]'); await P.click('[data-act="end"]');
  await A3.waitForSelector('.avg', { timeout: 10000 });
  assert((await A3.$$('[data-act="csv"], [data-act="newsession"], [data-act="change"]')).length === 0 && !!(await P.$('[data-act="csv"]')), 'results: the projector shows the class results; the buttons stay on the laptop');
  assert((await A3.innerText('.hard')).includes('Placeholder concept one'), 'the projector’s results show the topic and concept too');
  await A3.screenshot({ path: `${OUT}/26-projector-results.png` });

  assert(errors === 0, 'no script errors in any window or on any phone');
  await browser.close();
  stopAll();
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
