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
- The **phone page** reads the code from `?s=CODE`, connects to that id, and only renders the state messages it receives. It never contains questions or answers, so it can be public.
- The **player** contains no quiz content either; packs are loaded from the teacher's computer. Both pages are therefore safe on public GitHub Pages.

### Messages (JSON over the PeerJS data channel)

| From → to | Message | Purpose |
| --- | --- | --- |
| phone → player | `{t:'hello', sid}` | Identify the phone (random id kept in the phone's localStorage per session code) |
| phone → player | `{t:'answer', qi, round, c, sure}` | Submit an answer once per question and round |
| phone → player | `{t:'hb'}` every 5 s | Heartbeat; the player counts a phone as connected if heard from in the last 16 s |
| player → phone | `{t:'pong'}` | Heartbeat reply; a phone that hears nothing for 17 s reconnects |
| player → phone | `{t:'state', phase, qi, total, round, q, mine, first, remaining, reveal, final, result, …}` | The full screen for that phone. Sent on every change; personalised (`mine`, `final`, `result`). `reveal` (answer and explanation) is only included in the reveal phase. |
| player → phone | `{t:'img', id, i, n, d}` | A picture in pieces of 15,000 characters (data channels limit message size); the phone reassembles them, and late joiners get them too |

Phases: `lobby → vote (round 1) → closed → [vote (round 2) → closed] → reveal → … → end`.

### Where state lives

- **Player:** the session (code, phase, answers) in `localStorage['livequiz-session-v2']`, so a reload offers *Continue session*. Loaded packs are stored in IndexedDB (`livequiz` → `packs`) for the "Recent quizzes" list. Settings are in `localStorage['livequiz-settings-v1']`.
- **Phone:** only its random id per session code.

## Building

```bash
npm install                    # PeerJS, qrcode-generator (+ the local relay and Playwright for tests)
python3 tools/build_pages.py   # src/*.src.html → index.html, presenter.html
```

The build inlines both libraries (no CDN needed in class), syntax-checks every script with `node --check`, and refuses to write a page that looks like it contains quiz data.

## Testing

```bash
npx playwright install chromium   # once
npm test                          # node tests/e2e.js; screenshots in tests/output/
```

The test starts its own PeerJS relay on 127.0.0.1:9000 and a static server on 127.0.0.1:8080, then drives one presenter and up to four phones (light and dark mode) through two packs from `tests/fixtures/`. It covers: rejecting bad files; auto-close; hidden results while voting; revote; reveal; phone reload; presenter reload and resume; private scores; CSV export; pictures, including a late joiner; 4 and 6 options; missing explanations; recent quizzes; and the timer. Regenerate the placeholder fixtures with `python3 tests/make_fixtures.py`.

### Using your own PeerJS server

Both pages accept `?ph=<host>&pp=<port>&ps=<0|1>&pt=<path>` to use a different PeerJS server. The player passes these parameters on in the QR link. The test uses this to stay offline.

## Limits and known risks

- The free public PeerJS server has no uptime guarantee. If it is down, sessions cannot start; already-connected phones keep working.
- Some networks block WebRTC between devices. The alternative is a hosted realtime database (for example Firebase Realtime Database), with the same pages talking to it instead of to each other. The message protocol above maps directly onto database paths.
- The teacher's browser is the hub: if the laptop sleeps, phones wait and reconnect when it wakes.
- Tested with ~5 simulated phones. A data channel per phone is light; classes of 50–100 should be fine on a normal laptop, but have not been load-tested.

## Changing the pages

Edit `src/presenter.src.html` or `src/index.src.html`, run the build and the test, then commit `src/` and the built `index.html` / `presenter.html` together. Keep the phone page backwards-compatible: phones that loaded an older version must not break when the player sends new fields.
