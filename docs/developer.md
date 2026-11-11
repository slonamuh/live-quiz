# Developer notes

## How it works

```
 teacher's browser (index.html)                          students' phones (join/index.html)
 ┌──────────────────────────────────┐   WebRTC data channel   ┌──────────────────────┐
 │ quiz pack loaded from local file │ ◀──────────────────────▶ │ no quiz data at all; │
 │ session state, timer, tallies    │   (one per phone)        │ renders what it gets │
 └──────────────┬───────────────────┘                          └──────────┬───────────┘
                │      only to introduce the peers (signalling)           │
                └──────────────▶  PeerJS server (0.peerjs.com)  ◀──────────┘
```

- The **player** registers on the PeerJS server under the id `acsom-livequiz-<code>` (5-character session code) and accepts a data connection from each phone. It is the single source of truth: it holds the pack, the session state and all answers.
- The **phone page** reads the code from `?s=CODE`, connects to that id, and shows only what a verified player sends (see *Verifying the teacher's screen*). It never contains questions or answers, so it can be public.
- **Teacher-only fields.** A pack's `description` and each case's `topic` and `concept` are shown only in the library's **Cases** list (`casesDialog`), in the results list at the end (`buildEnd`, also in the projector window) with matching CSV columns, and in the editor. `stateFor` builds the phone messages from an explicit list of fields, so they never reach phones; no screen of a running session renders them (the classroom and two-screen tests check the screens and phones for them).
- The **player** contains no quiz content either; packs are loaded from the teacher's computer. Both pages are therefore safe on public GitHub Pages.
- **Addresses.** The player is the site's own address (`index.html`), because teachers type and bookmark it; students reach the phone page (`join/`) through the QR code or link. Two forwarders keep older addresses working: `presenter.html` (the player's old address) replaces itself with `./` plus its query and fragment, and the player, when opened with `?s=` (an old student link), replaces itself with `join/` plus query and fragment, before anything else runs. A remembered *Phone page address* equal to the old default (the folder itself, or its `index.html`) is moved to `join/` when the player starts.
- The **editor** (`editor.html`) runs only on the teacher's computer and never talks to the network. It opens a pack (file, pasted AI reply, or a "Recent quizzes" entry), edits it, and saves a `.quiz.json` file.

### Editor and player

- They share the player's IndexedDB `livequiz` (version 2, stores `packs` and `keys`); the editor opens it with the same version and upgrade code, so neither page can lock the other out. Its own draft lives in a separate database, `livequiz-editor` → `drafts` (key `current`), saved 0.6 s after each change, with the Chrome file handle when the browser allows it.
- **Edit** in the player links to `editor.html?pack=<key>`; the editor opens that "Recent quizzes" entry (or offers the unsaved draft first). **Play now** in the editor stores the pack under the player's own key formula (`packKey`, copied from the player), removes the entry it was opened from unless a saved session still uses it, and opens `./?open=<key>` (the player). The player removes `open` from the address at once, so a reload offers *Continue session* as usual.
- The editor keeps every field it does not edit (pictures, captions, unknown keys) and writes `format`, `version`, `id`, `title`, `created` first. Inside the editor, options carry their own "why not" line, so moving or removing an option keeps the explanations with it; the answer letter and the `why` keys are worked out on saving.
- Pasted replies: the first code block containing `"questions"` (or the whole text) is cut from the first `{` to the last `}`, and parsed; if that fails, once more with trailing commas removed.
- Saving: the File System Access API (`showOpenFilePicker` / `showSaveFilePicker`, Chrome) writes back to the opened file; elsewhere the file is downloaded.
- Pictures: decoded with `createImageBitmap` (or an `Image` for SVG), drawn on a canvas at most 1400 px on the long side, encoded as PNG and as JPEG (quality 0.82, on white); JPEG is kept only when the PNG is more than 1.25× larger. If the result is over 400 KB as a data URI, quality drops to 0.75 and 0.68, then the size shrinks by 15% at a time. Each picture gets a new random id (`q-…` with the case, `x-…` at the reveal); a picture no case uses any more is removed from `images`.
- Balancing: among the cases with the most common option count, the correct option of the most frequent letter is swapped with the option at the least frequent letter, latest case first and avoiding three equal answers in a row, until no letter is more than one ahead. The plan is shown before it is applied; Undo restores the cases.
- Printing: the chosen sheet is built into `#printView`, the only element shown under `@media print`, then `window.print()` runs.

### Projector window (two screens)

- **Open projector window** opens `./?audience=<id>` (the player's own path) as a pop-up named `livequiz-audience`. `<id>` (12 random characters) is kept in the tab's `sessionStorage`, so the laptop tab and its projector window still match after either reloads. Where `screen.isExtended` is true and `getScreenDetails()` is allowed, the pop-up is moved to the other screen (an external one if there is one).
- The projector window runs the same page in **view mode** (`runApp(..., 'view')`): no PeerJS, no keys, no storage writes, no timers that change anything. It draws the existing projector screens from the state it receives, with the controls, links and settings left out, and a separate join screen in the lobby. It has no quiz until the laptop sends one.
- They talk over `BroadcastChannel('livequiz-view')`, which only links windows of the same browser profile and site; every message carries the id, and each side ignores other ids.

| From → to | Message | Purpose |
| --- | --- | --- |
| projector → laptop | `{t:'beat', id, has}` every second | "I am open, and I have pack `has`". The laptop treats the projector as open while beats arrive (15 s grace) and the pop-up it opened is not closed. A beat with a different `has` gets the pack. |
| laptop → projector | `{t:'pack', id, key, quiz}` | The whole pack (checked again with `checkPack` on arrival); a new key replaces the view instance without reloading, so full screen is kept. |
| laptop → projector | `{t:'view', id, key, S, online, net, join, check, confidence, qr, stem, zoom}` | The screen state: the session without phone ids (`answers` only for the current question, all of them at the end; `n` = students), the join link and check code, QR / question-or-explanation / enlarged-picture state. Sent after every change (at most every 80 ms) and on every beat. |
| projector → laptop | `{t:'key', id, key}` · `{t:'act', id, act}` · `{t:'zoom', id, img}` | Keys (Enter, Space, →, Page Down, D, +, Q, Esc), the clicks it allows (`qr`, `unzoom`, `togglestem`), and a picture to enlarge (accepted only if that picture is on the projector). |
| laptop → projector | `{t:'bye', id}` · `{t:'close', id}` | The laptop window is leaving (reload, other quiz, editor): show the waiting screen. / Close yourself. |
| projector → laptop | `{t:'gone', id}` | The projector window is closing or reloading. |

- While the projector is open and a question is on, the laptop draws the **presenter view** (`buildConsole` / `updateConsole`) instead of the projector screen; in the lobby and at the end it keeps its usual screens. When the projector stops beating or closes, the laptop goes back to the one-screen view at once, which is the safe choice if the projector mirrors the laptop.
- The answer is marked on the laptop before the reveal only when `screen.isExtended === true`, or after **Show answer**. With one screen the laptop shows a warning about mirroring.
- The explanation picture is never sent to the projector before the reveal; any picture enlarged on the laptop is mirrored only if `onProjector(id)` is true at that moment.
- No answers, keys or phone ids leave the laptop window except as the counts and letters in `view.S.answers`, which stay inside the same browser.

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

- **Projector window:** nothing; it gets everything from the laptop window. The laptop tab keeps the link id in `sessionStorage['livequiz-view-id']`.
- **Player:** the session (code, phase, answers) in `localStorage['livequiz-session-v2']`, so a reload offers *Continue session*. Loaded packs are stored in IndexedDB (`livequiz` → `packs`) for the "Recent quizzes" list, and the session key in `livequiz` → `keys`. Packs from storage are checked again every time they are opened. Settings are in `localStorage['livequiz-settings-v1']`.
- **Phone:** only its random id per session code; the key fingerprint lives in the page address.
- **Editor:** the unsaved draft in IndexedDB `livequiz-editor`; quizzes handed to the player in `livequiz` → `packs`.

## Building

```bash
npm install                    # PeerJS, qrcode-generator (+ the local relay and Playwright for tests)
python3 tools/build_pages.py   # src/player → index.html, src/join → join/index.html, src/editor → editor.html, + presenter.html forwarder
```

The build inlines both libraries (no CDN needed in class), syntax-checks every script with `node --check`, and refuses to write a page that looks like it contains quiz data.

## Testing

```bash
npx playwright install chromium   # once
npm test                          # tests/e2e.js, tests/security.js, tests/editor.js, then tests/audience.js; screenshots in tests/output/
```

The test starts its own PeerJS relay on 127.0.0.1:9000 and a static server on 127.0.0.1:8080, then drives one presenter and up to four phones (light and dark mode) through two packs from `tests/fixtures/`. It covers: the old `presenter.html` address and an old student link forwarding to the right pages; an old remembered phone page address moved to `join/`; rejecting bad files; auto-close; hidden results while voting; revote; reveal; phone reload; presenter reload and resume; private scores; CSV export; pictures, including a late joiner; 4 and 6 options; missing explanations; recent quizzes; and the timer. Regenerate the placeholder fixtures with `python3 tests/make_fixtures.py`.

`tests/security.js` replays the attacks from the security review and checks that they fail: one connection posing as 50 students; a fake screen that claims the session code after the player closes (sending nothing, then its own key); the player recovering with *Move to a new code*; typed joins with a right, wrong and missing check code; a screen with a valid key sending markup, a bad answer letter, a picture with the wrong hash, a replayed and a wrongly signed message; and a relay address planted in the link.

`tests/editor.js` drives the editor: a new quiz written from scratch; the giveaway checks; adding, duplicating, moving and deleting cases; removing and moving options (the answer and the "why not" lines follow); saving by download and checking the file with `tools/make_pack.py`; pasting a whole AI reply with a trailing comma and markup in it; a file with pictures and unknown fields saved unchanged; the draft surviving a closed tab; Edit from the lobby and from Recent quizzes; Play now (and its refusal when a case is incomplete); and saving back to the opened file with a stubbed File System Access API. Version 2 adds: a 2600 px photo chosen through the file picker (resized to 1400 px JPEG under 400 KB, checked with Pillow), a flat diagram dropped on the reveal box (kept PNG), a picture pasted while typing, captions, removing a picture (and its data); balancing 9-of-10 answers on A to 2 of each letter with every "why not" line kept with its option, and Undo; moving one answer to a chosen letter; dragging a case to a new place; and the three print sheets (questions only has no answers anywhere).

`tests/audience.js` drives the two-screen mode with two phones: opening the projector window from the lobby (same code and link on the projector, no settings there); Page Down on the projector window starting the quiz; no controls, answer or results on the projector while voting, while the laptop shows live results, the answer (after **Show answer**, since the test browser has one screen and must warn about mirroring), the notes and the next case; a picture enlarged on both and closed with Esc on either; the QR code shown and hidden; results after voting closes and the explanation after the reveal, with the laptop switching the projector back to the case; the projector window reloading; Enter on the projector moving on; the explanation picture staying on the laptop before the reveal; the laptop reloading (projector waits, both reconnect after *Continue*); closing the projector window from the laptop and with its ×; opening it mid-question; and the results screen without buttons on the projector.

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

Edit `src/player.src.html`, `src/join.src.html` or `src/editor.src.html`, run the build and the tests, then commit `src/` and the built `index.html`, `join/index.html`, `editor.html` and `presenter.html` together. Keep the phone page backwards-compatible: phones that loaded an older version must not break when the player sends new fields.
