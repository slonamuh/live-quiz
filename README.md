# Live Quiz

A live classroom quiz for board-style (USMLE Step 1) cases. Students join on their phones by scanning a QR code. Everyone answers anonymously, the class sees the spread of answers on the big screen, then the teacher reveals the correct answer and the explanation.

- **Player (teacher's screen):** https://slonamuh.github.io/live-quiz/presenter.html
- **Phone page (opened by the QR code):** https://slonamuh.github.io/live-quiz/

No accounts, no installation and no server to maintain. The two pages are plain HTML on GitHub Pages; phones connect directly to the teacher's browser.

---

## How a session works

1. **Open the player** and load a quiz pack (a `.quiz.json` file, for example from your Google Drive).
2. **Students scan the QR code** on the screen (or open the phone page and type the 5-letter code). They see the full case and the options on their phone.
3. **They answer anonymously**: tap an option, then *I'm sure* or *I'm guessing*. The screen shows "18 of 25 answered" and a timer; results stay hidden while voting is open.
4. **Voting closes** when everyone has answered, when the time runs out, or when you press **Enter**. The A–E bars appear (solid = sure, striped = guessing).
5. **Optional discussion round (D):** students argue with a neighbour for 1–2 minutes and vote again; round 1 stays visible as a thin grey line.
6. **Reveal (Enter):** the correct answer turns green and the explanation appears, with the most common wrong answer highlighted. Each phone privately shows whether that student was right, plus the explanation.
7. **Next question (Enter)**. At the end the screen shows the class average and the questions sorted hardest first; every student sees their own score, which nobody else can see. **Download results (CSV)** saves the anonymous statistics.

**Teaching tip (peer instruction):** after round 1, if fewer than ~30% are correct, reveal and teach; if more than ~70%, reveal and move on; in between, use the discussion round. The second vote usually improves a lot.

### Keys on the teacher's screen

| Key | Action |
| --- | --- |
| Enter / Space / → | Next step: start · close voting · reveal · next question |
| D | Discuss & revote (after round 1 closes) |
| + | 30 more seconds |
| Q | Show the QR code full screen (again: close) |
| Esc | Close an enlarged picture or the QR code |
| Ctrl + / Ctrl − | Bigger / smaller text for the room |

### Settings (in the lobby, remembered on that computer)

- **Phone page address**: fills itself in as `https://slonamuh.github.io/live-quiz/` when the player is opened from GitHub Pages.
- **Time per question** (default 90 s) and **revote time** (default 60 s), or no limit.
- **Close voting automatically** when every connected student has answered.
- **Ask "sure or guessing?"**: shows "sure but wrong", the most dangerous misconception.
- **Start at question N**: to continue a long pack in the next lecture.

---

## Before the first class (one time)

1. **GitHub Pages is on**: repository *Settings → Pages → Deploy from a branch → main → / (root)*.
2. **Google Drive for desktop** (optional but convenient): create a folder such as *Quiz packs*. It appears in the file picker, so loading a pack is two clicks.
3. **Test on the real network**: open the player, scan with two phones, one on the school Wi-Fi and one on mobile data, and answer one question. Some campus networks block direct phone-to-laptop connections; see Troubleshooting.

## Before each class

1. Open the **player** in Chrome, choose **Choose quiz file** (or **Use** next to a recent quiz).
2. Check the corner says **Live** (green).
3. Keep the laptop **plugged in and awake**, and keep the player tab open until the end.

If the player tab is reloaded or closed by accident, open it again: it offers **Continue session**, and phones reconnect by themselves with their answers kept.

---

## Making quiz packs

A quiz pack is one file per topic, e.g. `immunology-01.quiz.json`. It contains the questions, answers, explanations and pictures.

**With Claude (recommended).** The `live-quiz-packs` skill holds the whole procedure: the question-writing rules (NBME style, second-order reasoning, plausible distractors, balanced answer key, no length or lab-value giveaways), the master doc layout and the pack format. Examples:

- "Write 20 cases on hypersensitivity reactions and make a quiz pack."
- "I edited the Explanations tab of my Immunology doc — rebuild the pack."
- "Add the picture I pasted under question 7 and rebuild the pack."

**The master doc.** Each pack has a Claude doc with three tabs:

- **Questions**: cases, question lines and options only, which can be printed or shared with students.
- **Answer key**: one row per question.
- **Explanations**: answer, explanation, why each other option is wrong, take-home point.

To add a picture, paste it under the case (shown with the question) or under the explanation (shown at reveal).

**By hand or with your own tools**: see [docs/pack-format.md](docs/pack-format.md), and check a pack with
`python3 tools/make_pack.py check my-quiz.quiz.json`.

> **Never put quiz packs in this repository.** It is public, and packs contain the answers. Keep them in your Google Drive. The `.gitignore` here blocks `*.quiz.json` files (except the placeholder test fixtures).

---

## Privacy and safety

- Students do not sign in and never type a name; results on screen are anonymous. A random ID on each phone lets a student reconnect and see their own score.
- Questions travel from the teacher's browser to the phones only while the quiz runs. The phone page contains no questions, and neither does the player: both are empty until a pack is loaded.
- Answer keys stay on the teacher's computer (and Google Drive).
- The connection is set up through the free public PeerJS server (only to introduce the phones to the laptop); answers then go directly between the phone and the teacher's browser, encrypted by WebRTC.

## Troubleshooting

| What you see | What it means | What to do |
| --- | --- | --- |
| Player corner stays **Connecting…** or shows **Can't reach server** | The player cannot reach the PeerJS server. Hover over it for the exact error. | Open the player from its **https address** in **Chrome** (not as a local file, not in Safari). Check the internet connection. |
| Phone says **Waiting for the teacher's screen** | The phone reached the server but no player is open with that code. | Make sure the player tab is open and shows the same code; rescan the QR code shown now. |
| Phones join on mobile data but not on Wi-Fi | The Wi-Fi blocks direct connections. | Ask students to switch off Wi-Fi for the quiz, or ask IT to allow WebRTC. A server-based version (Firebase) is possible if this is permanent. |
| A phone shows **Reconnecting…** | The phone slept or lost signal. | Nothing; it reconnects by itself and keeps its answers. |
| The file is rejected | The pack has a problem. | The message names the question and the problem; ask Claude to fix the pack. |
| Text is small on the projector | | Ctrl + (zoom in). |

---

## What's in this repository

| Path | What it is |
| --- | --- |
| `index.html` | Phone page (built from `src/index.src.html`) |
| `presenter.html` | Player for the teacher's screen (built from `src/presenter.src.html`) |
| `src/` | Page sources |
| `tools/build_pages.py` | Builds the two pages (inlines PeerJS and the QR library) |
| `tools/make_pack.py` | Checks quiz packs and embeds pictures |
| `tests/` | End-to-end test (presenter + simulated phones) and its placeholder fixtures |
| `docs/pack-format.md` | Quiz pack format |
| `docs/developer.md` | How it works, building, testing, changing things |

## Credits

[PeerJS](https://peerjs.com) (MIT License) for the WebRTC connections and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT License) for the QR codes. Both are bundled inside the pages.
