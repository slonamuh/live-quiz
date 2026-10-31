# Developer notes

## How it works

```
 teacher's browser (presenter.html)                        students' phones (index.html)
 ┌──────────────────────────────────┐   WebRTC data channel   ┌──────────────────────┐
 │ quiz pack loaded from local file │ ◀──────────────────────▶ │ no quiz data at all; │
 │ session state, timer, tallies    │   (one per phone)        │ renders what it gets │
 └──────────────┬───────────────────┘                          └──────────┬───────────┘
                │      only to introduce the peers (signalling)           │
                └──────────────▶  PeerJS server (0.peerjs.com)  ◀──────────┘
```

- The **player** registers on the PeerJS server under the id `acsom-livequiz-<code>` (5-character session code) and accepts a data connection from each phone. It is the single source of truth: it holds the pack, the session state and all answers.
- The **phone page** reads the code from `?s=CODE`, connects to that id, and shows only what a verified player sends (see *Verifying the teacher's screen*). It never contains questions or answers, so it can be public.
- The **player** contains no quiz content either; packs are loaded from the teacher's computer. Both pages are therefore safe on public GitHub Pages.

### Verifying the teacher's screen

Anyone can register `acsom-livequiz-<code>` on the public PeerJS server while the real player is offline (laptop asleep, tab reloading). Phones therefore never trust the id; they trust a key.

- When a session starts, the player creates an **ECDSA P-256 key pair** with WebCrypto. The private key is non-extractable and kept in IndexedDB (`livequiz` → `keys`) so *Continue session* keeps the same key. **New session** makes a new one.
- **Fingerprint** = the first 16 bytes of SHA-256(raw public key), base64url (22 characters). The QR code and the shared link carry it in the fragment: `…?s=CODE#k=<fingerprint>`. The fragment never reaches a web server.
- **Check code** = the first 5 bytes of the same hash in Crockford base32 (8 characters, shown as `XXXX-XXXX`). A student who types the session code by hand must also type the check code; the phone joins with `#c=<check>` and, once verified, rewrites its address to the full `#k=` so reloads use the stronger check. Typing `O`/`I`/`L` is read as `0`/`1`.
- **Handshake:** the phone sends a random nonce in `hello`; the player answers with `auth` = its public key and a signature over `livequiz-auth|CODE|nonce`. The phone checks the key against the fingerprint (or check code) and the signature. Until then it ignores every message, and it gives up after 10 s.
- **Every screen update is signed** over `CODE|nonce|seq|body`, with `seq` strictly increasing per connection, so messages cannot be forged, altered or replayed.
- **Pictures** travel unsigned (they are large), but the signed state carries each picture's SHA-256; a picture that does not match is not shown.
- After verification the phone still validates every field (types, lengths, phases, letters A–H, 2–8 options) and escapes everything it prints. A message that fails any check is dropped whole.
- If the player finds its id taken for more than 15 s, it shows **Another device is holding this session's code** with **Move to a new code** (same key, new code, QR opens). Phones on the old code show *This isn't your teacher's screen* and need the new QR code or link.

### Messages (JSON over the PeerJS data channel)

| From → to | Message | Purpose |
| --- | --- | --- |
| phone → player | `{t:'hello', sid, nonce}` | Identify the phone (random id kept in the phone's localStorage per session code) and challenge the player. The player accepts one `hello` per connection. |
| player → phone | `{t:'auth', pub, sig}` | The session's public key (raw, base64url) and its signature over `livequiz-auth|CODE|nonce` |
| phone → player | `{t:'answer', qi, round, c, sure}` | Submit an answer once per question and round |
| phone → player | `{t:'hb'}` every 5 s | Heartbeat; the player counts a phone as connected if heard from in the last 16 s |
| player → phone | `{t:'pong'}` | Heartbeat reply; a phone that hears nothing for 17 s reconnects |
| player → phone | `{t:'s', seq, body, sig}` | A signed screen update. `body` is the JSON text of `{t:'state', phase, qi, total, round, q, mine, first, remaining, reveal, final, result, …}`: the full screen for that phone, sent on every change and personalised (`mine`, `final`, `result`). `reveal` (answer and explanation) is only included in the reveal phase. Pictures are referenced as `{id, caption, hash}`. |
| player → phone | `{t:'img', id, i, n, d}` | A picture in pieces of 15,000 characters (data channels limit message size); the phone reassembles them, checks the hash, and late joiners get them too. Sent only after `auth`. |

Phases: `lobby → vote (round 1) → closed → [vote (round 2) → closed] → reveal → … → end`.

### Where state lives

- **Player:** the session (code, phase, answers) in `localStorage['livequiz-session-v2']`, so a reload offers *Continue session*. Loaded packs are stored in IndexedDB (`livequiz` → `packs`) for the "Recent quizzes" list, and the session key in `livequiz` → `keys`. Packs from storage are checked again every time they are opened. Settings are in `localStorage['livequiz-settings-v1']`.
- **Phone:** only its random id per session code; the key fingerprint lives in the page address.

## Building

```bash
npm install                    # PeerJS, qrcode-generator (+ the local relay and Playwright for tests)
python3 tools/build_pages.py   # src/*.src.html → index.html, presenter.html
```

The build inlines both libraries (no CDN needed in class), syntax-checks every script with `node --check`, and refuses to write a page that looks like it contains quiz data.

## Testing

```bash
npx playwright install chromium   # once
npm test                          # tests/e2e.js, then tests/security.js; screenshots in tests/output/
```

The test starts its own PeerJS relay on 127.0.0.1:9000 and a static server on 127.0.0.1:8080, then drives one presenter and up to four phones (light and dark mode) through two packs from `tests/fixtures/`. It covers: rejecting bad files; auto-close; hidden results while voting; revote; reveal; phone reload; presenter reload and resume; private scores; CSV export; pictures, including a late joiner; 4 and 6 options; missing explanations; recent quizzes; and the timer. Regenerate the placeholder fixtures with `python3 tests/make_fixtures.py`.

`tests/security.js` replays the attacks from the security review and checks that they fail: one connection posing as 50 students; a fake screen that claims the session code after the player closes (sending nothing, then its own key); the player recovering with *Move to a new code*; typed joins with a right, wrong and missing check code; a screen with a valid key sending markup, a bad answer letter, a picture with the wrong hash, a replayed and a wrongly signed message; and a relay address planted in the link.

### Using your own PeerJS server

For testing, both pages accept `?ph=<host>&pp=<port>&ps=<0|1>&pt=<path>`, but only when the host is `127.0.0.1` or `localhost`; any other host is ignored, so a link cannot send phones to someone else's relay. The player passes these parameters on in the QR link. To use your own public PeerJS server permanently, change `peerOpts` in both sources and rebuild.

## Limits and known risks

- The free public PeerJS server has no uptime guarantee. If it is down, sessions cannot start; already-connected phones keep working.
- Some networks block WebRTC between devices. The alternative is a hosted realtime database (for example Firebase Realtime Database), with the same pages talking to it instead of to each other. The message protocol above maps directly onto database paths.
- The teacher's browser is the hub: if the laptop sleeps, phones wait and reconnect when it wakes.
- Someone can still hold the session code while the player is away (they cannot impersonate it, only block it); the player then offers *Move to a new code*.
- A student with the link can open several connections and so answer more than once. Each connection counts as one student; there is no sign-in to prevent this.
- Tested with ~5 simulated phones. A data channel per phone is light; classes of 50–100 should be fine on a normal laptop, but have not been load-tested.

## Changing the pages

Edit `src/presenter.src.html` or `src/index.src.html`, run the build and the test, then commit `src/` and the built `index.html` / `presenter.html` together. Keep the phone page backwards-compatible: phones that loaded an older version must not break when the player sends new fields.
