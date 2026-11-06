# Live Quiz

A live classroom quiz for board-style (USMLE Step 1) cases. Students join on their phones by scanning a QR code. Everyone answers anonymously, the class sees the spread of answers on the big screen, then the teacher reveals the correct answer and the explanation.

- **Player (teacher's screen):** https://slonamuh.github.io/live-quiz/presenter.html
- **Phone page (opened by the QR code):** https://slonamuh.github.io/live-quiz/
- **Editor (write and fix quizzes):** https://slonamuh.github.io/live-quiz/editor.html

No accounts, no installation and no server to maintain. The pages are plain HTML on GitHub Pages; phones connect directly to the teacher's browser.

---

## How a session works

1. **Open the player** and load a quiz pack (a `.quiz.json` file, for example from your Google Drive).
2. **Students join** in one of three ways, and see the full case and the options on their phone:
   - **scan the QR code** on the screen;
   - **open the link** you shared (press **Copy link** in the lobby and paste it into the class chat or LMS);
   - **type the codes**: open the phone page and enter the 5-character session code *and* the 8-character check code shown under the QR code.
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
| Q | Show the QR code full screen, with the link and both codes (again: close) |
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

**The quiz file is the master copy.** Make every change in that file (in the editor below) and keep it in the Quiz packs folder on Google Drive. Docs, AI chats and printouts are only ways to draft or share a quiz; once a quiz file exists, don't edit the doc it came from and rebuild the file, or changes made in the editor are lost.

**In the editor.** Open https://slonamuh.github.io/live-quiz/editor.html (or press **Edit** next to a quiz in the player). You can:

- start a **new quiz**, **open a file**, **paste an AI assistant's reply** (the whole reply: the editor finds the quiz in it), or pick one of the **Recent quizzes**;
- write or fix each case: case text, question line, options (tick the correct one), a "why not" line under each wrong option, the explanation and the take-home point; add, duplicate, move or delete cases and options; drag cases in the list to reorder them;
- add **pictures**: paste, drop or choose a file in a case's two picture boxes (shown with the case, or at the reveal). Pictures are resized to at most 1400 px and kept under about 400 KB: PNG for diagrams, JPEG for photos;
- **balance the answer letters**: the editor shows how often each letter is correct and can even them out by swapping each moved answer with another option (with a preview and Undo); one case's answer can also be moved to a chosen letter;
- see **checks** as you type: what stops the player from loading the quiz (red) and common giveaways (amber: the correct answer is the longest option, a word from the case repeated only in the correct answer, an option named by its letter, letters left at the start of options, unbalanced answer letters);
- **Save** (Ctrl+S). In Chrome this writes back to the file you opened, including one in your Google Drive for desktop folder; **Save as…** makes a copy. In other browsers the file is downloaded;
- **Print…**: questions only (for students), questions with the answer key, or everything with the explanations; choose "Save as PDF" to make a PDF;
- **Play now**: open the quiz in the player straight away, without saving a file first.

Unsaved changes are kept in the browser, so closing the tab by accident loses nothing.

**With Claude.** The `live-quiz-packs` skill holds the whole procedure: the question-writing rules (NBME style, at least two reasoning steps, a clue in the case that rules out each wrong option, balanced answer key, no length or lab-value giveaways) and the pack format. Examples:

- "Write 20 cases on hypersensitivity reactions and make a quiz pack."
- "Here is my immunology-02.quiz.json: make cases 4 and 9 harder."
- "Add this picture to case 7 of my quiz file."

Claude can also lay the cases out in a doc with three tabs (Questions, Answer key, Explanations) for reading or printing. That doc is a copy: change the quiz file, not the doc.

**With any other AI assistant (ChatGPT, Gemini, …)**: give it [docs/llm-instructions.md](docs/llm-instructions.md), the complete instructions for writing cases to our standards and returning a ready-to-load pack. Fill in the REQUEST section at the end.

**By hand or with your own tools**: see [docs/pack-format.md](docs/pack-format.md), and check a pack with
`python3 tools/make_pack.py check my-quiz.quiz.json`.

> **Never put quiz packs in this repository.** It is public, and packs contain the answers. Keep them in your Google Drive. The `.gitignore` here blocks `*.quiz.json` files (except the placeholder test fixtures).

---

## Privacy and safety

- Students do not sign in and never type a name; results on screen are anonymous. A random ID on each phone lets a student reconnect and see their own score.
- Questions travel from the teacher's browser to the phones only while the quiz runs. The phone page contains no questions, and neither does the player: both are empty until a pack is loaded.
- Answer keys stay on the teacher's computer (and Google Drive).
- The connection is set up through the free public PeerJS server (only to introduce the phones to the laptop); answers then go directly between the phone and the teacher's browser, encrypted by WebRTC.
- **Phones check that they reached your screen.** Each session has its own digital key; the QR code and the link carry its fingerprint (the part after `#k=`), and the check code is a short version of it. A phone shows nothing from a screen that cannot prove it holds that key, so nobody can pose as your screen, even by taking over the session code while your laptop is asleep.
- Share the link only with your class: anyone who has it can join and answer.

## Troubleshooting

| What you see | What it means | What to do |
| --- | --- | --- |
| Player corner stays **Connecting…** or shows **Can't reach server** | The player cannot reach the PeerJS server. Hover over it for the exact error. | Open the player from its **https address** in **Chrome** (not as a local file, not in Safari). Check the internet connection. |
| Player shows **This browser can't secure the session here** | The player was opened without https or in an old browser. | Open it from its https address in Chrome. |
| Phone says **Waiting for the teacher's screen** | The phone reached the server but no player is open with that code. | Make sure the player tab is open and shows the same code; rescan the QR code shown now. |
| Phone says **This isn't your teacher's screen** | The phone reached something that could not prove it is your player: an old QR code or link, a mistyped check code, or someone holding your session code. | Students scan the QR code on the projector again or reopen your current link. If the player shows **Another device is holding this session's code**, press **Move to a new code** and have everyone rescan. |
| Player shows **Another device is holding this session's code** | The code is still registered elsewhere, e.g. the player is open in another tab or on another computer, or someone took it while your laptop was asleep. | Close the other tab if there is one; otherwise press **Move to a new code** (the quiz continues where it was) and have students rescan. |
| Phone says **This browser can't join safely** | A very old browser without the security features the check needs. | Use an up-to-date Chrome or Safari. |
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
| `editor.html` | Quiz editor (built from `src/editor.src.html`) |
| `src/` | Page sources |
| `tools/build_pages.py` | Builds the three pages (inlines PeerJS and the QR library) |
| `tools/make_pack.py` | Checks quiz packs and embeds pictures |
| `tests/` | End-to-end test (presenter + simulated phones), security test (replays known attacks), editor test, and placeholder fixtures |
| `docs/llm-instructions.md` | Instructions to give any AI assistant so it writes cases and returns a quiz pack |
| `docs/pack-format.md` | Quiz pack format |
| `docs/developer.md` | How it works, building, testing, changing things |

## Credits

[PeerJS](https://peerjs.com) (MIT License) for the WebRTC connections and [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT License) for the QR codes. Both are bundled inside the pages.
