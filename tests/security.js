// Security test: replays the attacks from the security review against the real pages and checks they now fail.
//
//   npm test        (runs tests/e2e.js, then this file; screenshots go to tests/output/)
//
// Like e2e.js it starts its own PeerJS relay (127.0.0.1:9000) and web server (127.0.0.1:8080).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output'); fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8080';
const PQ = 'ph=127.0.0.1&pp=9000&ps=0';
const RELAY = { host: '127.0.0.1', port: 9000, secure: false, path: '/' };
const log = (...a) => console.log(...a);
function assert(c, m) { if (!c) throw new Error('ASSERT: ' + m); log('  ✓', m); }

const children = [];
function start(cmd, args) { const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' }); children.push(p); return p; }
function up(url) { return new Promise(r => http.get(url, res => { res.resume(); r(true); }).on('error', () => r(false))); }
async function waitUp(url) { for (let i = 0; i < 50; i++) { if (await up(url)) return; await new Promise(r => setTimeout(r, 200)); } throw new Error('server did not start: ' + url); }
function stopAll() { for (const c of children) { try { c.kill(); } catch (e) {} } }

let pageErrors = 0;
async function phone(browser, url, tag) {
  const s = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  s.on('pageerror', e => { pageErrors++; log(`[${tag} pageerror]`, e.message); });
  await s.goto(url); return s;
}
async function lobby(P) { await P.waitForSelector('.net.ok', { timeout: 20000 }); return { code: (await P.textContent('#code')).trim(), url: (await P.textContent('#join .url')).trim(), check: (await P.textContent('#check')).trim() }; }
const UNTRUSTED = 'text=This isn’t your teacher’s screen';
const pwned = s => s.evaluate(() => document.title.indexOf('PWNED') >= 0 || !!window.__pwned || !!document.querySelector('img[src="x"]'));

// Code that runs inside an attacker's browser tab. The phone page without a code (the join form) already carries PeerJS.
async function attackerTab(browser) {
  const A = await (await browser.newContext()).newPage();
  await A.goto(`${BASE}/index.html`); await A.waitForSelector('#jc');
  await A.evaluate(() => {
    const enc = t => new TextEncoder().encode(t);
    const b64u = buf => { const b = new Uint8Array(buf); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
    window.__evil = {
      enc, b64u,
      async keys() {
        const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
        const raw = await crypto.subtle.exportKey('raw', k.publicKey);
        const h = await crypto.subtle.digest('SHA-256', raw);
        return { k, pub: b64u(raw), fp: b64u(h.slice(0, 16)) };
      },
      sign: async (k, text) => b64u(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.privateKey, enc(text)))
    };
  });
  return A;
}
const XSS = '<img src=x onerror="document.title=\'PWNED\';window.__pwned=1">';

(async () => {
  start(process.execPath, [path.join(ROOT, 'node_modules/peer/dist/bin/peerjs.js'), '--port', '9000', '--host', '127.0.0.1', '--path', '/']);
  start('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', ROOT]);
  await waitUp('http://127.0.0.1:9000/'); await waitUp(BASE + '/index.html');
  const browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });

  log('Links carry the teacher’s key');
  const Pctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  let P = await Pctx.newPage();
  P.on('pageerror', e => { pageErrors++; log('[presenter pageerror]', e.message); });
  await P.goto(`${BASE}/presenter.html?${PQ}`);
  await P.setInputFiles('#file', path.join(ROOT, 'tests/fixtures/sample-25.quiz.json'));
  const L1 = await lobby(P);
  assert(/#k=[A-Za-z0-9_-]{22}$/.test(L1.url), 'QR / shared link ends with #k=<fingerprint of the session key>');
  assert(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(L1.check), 'lobby shows an 8-character check code for typed joins');
  assert(!!(await P.$('#copyBtn')), 'lobby has a Copy link button');
  const V = await phone(browser, L1.url, 'victim');
  await V.waitForSelector('text=teacher’s screen verified', { timeout: 25000 });
  assert(true, 'a phone opening the link verifies the screen and joins');

  log('Vote stuffing (PoC 1): one connection pretends to be 50 students');
  await P.click('#startBtn'); await V.waitForSelector('.opt');
  const A1 = await attackerTab(browser);
  await A1.evaluate(({ code, RELAY }) => new Promise(res => {
    const peer = new peerjs.Peer(RELAY);
    peer.on('open', () => {
      const c = peer.connect('acsom-livequiz-' + code.toLowerCase(), { reliable: true, serialization: 'json' });
      c.on('open', () => { for (let i = 0; i < 50; i++) { c.send({ t: 'hello', sid: 'fakestudent' + String(i).padStart(3, '0'), nonce: 'n'.repeat(22) }); c.send({ t: 'answer', qi: 0, round: 1, c: 'E', sure: true }); } setTimeout(res, 1500); });
    });
  }), { code: L1.code, RELAY });
  await P.waitForTimeout(1500);
  const status1 = ((await P.textContent('#status')).replace(/\s+/g, ' ').match(/\d+ of \d+ answered/) || ['?'])[0];
  assert(status1 === '1 of 2 answered', `the screen counts that connection once (“${status1}”), not 50 times`);
  await A1.context().close();

  log('Fake screen (PoC 2): the player tab closes and an attacker claims its session code');
  await P.close();                                                   // laptop sleeps / tab closed; the context keeps its storage
  const B = await attackerTab(browser);
  await B.evaluate(({ code, RELAY, XSS }) => new Promise(res => {
    let n = 0;
    const peer = new peerjs.Peer('acsom-livequiz-' + code.toLowerCase(), RELAY);
    peer.on('open', () => res());
    peer.on('connection', c => c.on('data', async m => {
      if (!m || m.t !== 'hello') return;
      n++;
      // The old exploit: an unsigned state with script in a field the phone used to print raw.
      c.send({ t: 'state', phase: 'vote', qi: 0, total: 25, round: 2, confidence: true,
        q: { stem: 'Network check: please re-enter your school email and password.', lead: 'Continue?', options: ['Yes', 'No'] }, mine: null, first: { c: XSS, sure: true } });
      if (n === 1) return;                                           // first visit: never prove anything (phone must give up)
      // Later visits: prove ownership of a key, just not the teacher's key.
      const K = await __evil.keys();
      c.send({ t: 'auth', pub: K.pub, sig: await __evil.sign(K.k, 'livequiz-auth|' + code + '|' + m.nonce) });
      const body = JSON.stringify({ t: 'state', phase: 'lobby', title: 'Fake quiz ' + XSS, qi: -1, total: 25 });
      c.send({ t: 's', seq: 1, body, sig: await __evil.sign(K.k, code + '|' + m.nonce + '|1|' + body) });
    }));
  }), { code: L1.code, RELAY, XSS });
  log('  attacker now holds the session code', L1.code);
  await V.waitForSelector(UNTRUSTED, { timeout: 60000 });
  assert(!(await pwned(V)), 'a screen that sends no proof is refused; no script ran on the phone');
  assert(!(await V.$('text=Network check')) && !(await V.$('text=Fake quiz')), 'nothing the fake screen sent is shown');
  await V.waitForTimeout(13000);                                     // the phone retries; now the fake screen proves its own key
  await V.waitForSelector(UNTRUSTED);
  assert(!(await pwned(V)) && !(await V.$('text=Fake quiz')), 'a screen with a different key is refused too');
  await V.screenshot({ path: `${OUT}/05-phone-fake-screen.png` });

  log('The real player comes back: its code is taken');
  P = await Pctx.newPage();
  P.on('pageerror', e => { pageErrors++; log('[presenter pageerror]', e.message); });
  await P.goto(`${BASE}/presenter.html?${PQ}`);
  await P.click('#resumeBtn');
  await P.waitForSelector('#newCodeBtn', { timeout: 40000 });
  assert(true, 'after 15 s the player says another device holds the code and offers “Move to a new code”');
  await P.screenshot({ path: `${OUT}/06-code-taken.png` });
  await P.click('#newCodeBtn');
  await P.waitForSelector('.net.ok', { timeout: 20000 });
  await P.keyboard.press('q');                                       // the QR code opens with the new code; close it
  const code2 = (await P.textContent('.qrover .code')).trim();
  assert(code2 && code2 !== L1.code, `the session moves to a new code (${L1.code} → ${code2})`);
  const url2 = (await P.textContent('.qrover .url')).trim();
  const check2 = (await P.textContent('.qrover .check b')).trim();
  const W = await phone(browser, url2, 'rescan');
  await W.waitForSelector('.opt', { timeout: 25000 });
  assert(true, 'a phone using the new link rejoins the question in progress');
  await B.context().close(); await W.context().close();

  log('Typed join with the check code');
  const T = await phone(browser, `${BASE}/index.html?${PQ}`, 'typed');
  await T.fill('#jc', code2); await T.fill('#jk', check2.replace('-', '').toLowerCase());
  await T.click('#jf button[type=submit]');
  await T.waitForSelector('.opt', { timeout: 25000 });
  assert(/^#k=[A-Za-z0-9_-]{22}$/.test(await T.evaluate(() => location.hash)), 'right check code joins; the address is upgraded to the full key');
  await T.reload(); await T.waitForSelector('.opt', { timeout: 25000 });
  assert(true, 'the upgraded address still works after a reload');
  const Tbad = await phone(browser, `${BASE}/index.html?${PQ}`, 'typed-wrong');
  const wrong = check2.replace('-', '').slice(0, 7) + (check2.slice(-1) === 'Z' ? 'Y' : 'Z');
  await Tbad.fill('#jc', code2); await Tbad.fill('#jk', wrong);
  await Tbad.click('#jf button[type=submit]');
  await Tbad.waitForSelector(UNTRUSTED, { timeout: 25000 });
  assert(!(await Tbad.$('.opt')), 'a wrong check code is refused and shows no question');
  await Tbad.context().close();
  const Tshort = await phone(browser, `${BASE}/index.html?${PQ}`, 'typed-short');
  await Tshort.fill('#jc', code2); await Tshort.click('#jf button[type=submit]');
  assert((await Tshort.textContent('#jerr')).includes('8 characters'), 'the join form asks for the check code');
  await Tshort.context().close();
  await T.context().close(); await P.close();

  log('A screen with the right key still cannot inject code (strict checks and escaping)');
  const E = await attackerTab(browser);
  const fp = await E.evaluate(({ RELAY, XSS }) => new Promise(async res => {
    const K = window.__K = await __evil.keys();
    const peer = new peerjs.Peer('acsom-livequiz-zzzzz', RELAY);
    peer.on('open', () => res(K.fp));
    peer.on('connection', c => c.on('data', async m => {
      if (!m || m.t !== 'hello') return;
      const send = async (seq, obj, signOver) => { const body = JSON.stringify(obj); c.send({ t: 's', seq, body, sig: await __evil.sign(K.k, 'ZZZZZ|' + m.nonce + '|' + seq + '|' + (signOver || body)) }); };
      window.__send = send;
      c.send({ t: 'auth', pub: K.pub, sig: await __evil.sign(K.k, 'livequiz-auth|ZZZZZ|' + m.nonce) });
      await send(1, { t: 'state', phase: 'lobby', title: 'Title ' + XSS, qi: -1, total: 3 });
      window.__sendImg = (id, url) => { const parts = url.match(/.{1,15000}/g); parts.forEach((d, i) => c.send({ t: 'img', id, i, n: parts.length, d })); };
      window.__ready = true;
    }));
  }), { RELAY, XSS });
  const X = await phone(browser, `${BASE}/index.html?s=ZZZZZ&${PQ}#k=${fp}`, 'x');
  await X.waitForSelector('text=teacher’s screen verified', { timeout: 25000 });
  await E.waitForFunction(() => window.__ready);
  assert((await X.textContent('.center b')).includes('<img src=x'), 'markup in the quiz title is shown as text');
  await E.evaluate(XSS => __send(2, { t: 'state', phase: 'vote', qi: 0, total: 3, round: 2, confidence: true,
    q: { stem: 'Stem', lead: 'Lead', options: ['One', 'Two'] }, mine: null, first: { c: XSS, sure: true } }), XSS);
  await X.waitForTimeout(1500);
  assert(!(await X.$('.opt')) && !(await pwned(X)), 'a malformed answer letter (the PoC 2 field) makes the whole message rejected');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await E.evaluate(({ XSS, png }) => { __sendImg('pic', png); return __send(3, { t: 'state', phase: 'vote', qi: 0, total: 3, round: 1, confidence: false,
    q: { stem: 'Stem ' + XSS, lead: 'Lead ' + XSS, options: ['<b>bold</b>', XSS], image: { id: 'pic', caption: XSS, hash: 'not-the-real-hash' } }, mine: null }); }, { XSS, png });
  await X.waitForSelector('.opt');
  assert((await X.textContent('.opt[data-l="A"] .x')) === '<b>bold</b>' && !(await X.$('.opt b')), 'question and options print markup as text');
  await X.waitForSelector('text=Picture could not be verified');
  assert(!(await X.$('figure.qimg img')), 'a picture that does not match the hash in the signed message is not shown');
  await E.evaluate(() => __send(1, { t: 'state', phase: 'lobby', title: 'Replayed', qi: -1, total: 3 }));
  await E.evaluate(() => __send(4, { t: 'state', phase: 'lobby', title: 'Tampered', qi: -1, total: 3 }, '{"something":"else"}'));
  await X.waitForTimeout(1500);
  assert(!!(await X.$('.opt')) && !(await X.$('text=Replayed')) && !(await X.$('text=Tampered')), 'replayed and wrongly signed messages are ignored');
  assert(!(await pwned(X)), 'no injected script ran at any point');
  await X.screenshot({ path: `${OUT}/07-phone-escaped.png`, fullPage: true });
  await E.context().close(); await X.context().close();

  log('Relay address in the link is ignored unless it is this computer');
  const ctx = await browser.newContext();
  const seen = [];
  await ctx.route('**/*', r => /^https?:\/\/127\.0\.0\.1[:/]/.test(r.request().url()) ? r.continue() : (seen.push(r.request().url()), r.abort()));
  if (ctx.routeWebSocket) await ctx.routeWebSocket(/.*/, ws => { seen.push(ws.url()); ws.close(); });
  const R1 = await ctx.newPage();
  await R1.goto(`${BASE}/index.html?s=ABCDE&ph=evil.example&pp=443&ps=1#k=${'A'.repeat(22)}`);
  const R2 = await ctx.newPage();
  await R2.goto(`${BASE}/presenter.html?ph=evil.example&pp=443&ps=1`);
  await R2.setInputFiles('#file', path.join(ROOT, 'tests/fixtures/sample-25.quiz.json'));
  await R2.waitForSelector('#code');
  await R1.waitForTimeout(4000);
  assert(seen.length > 0 && !seen.some(u => u.includes('evil.example')), 'phone page and player never contact a relay named in the link (' + [...new Set(seen.map(u => new URL(u).host))].join(', ') + ')');
  assert(!(await R2.textContent('#join .url')).includes('evil.example'), 'the player does not pass that relay on to phones');
  await ctx.close();

  assert(pageErrors === 0, 'no script errors on any page');
  await browser.close(); stopAll();
  log('ALL PASSED');
})().catch(e => { console.error('FAILED', e); stopAll(); process.exit(1); });
