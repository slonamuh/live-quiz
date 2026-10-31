# Instructions for an AI assistant: write cases and produce a Live Quiz pack

**How to use this file (for the teacher).** Copy everything from the line "START OF INSTRUCTIONS" to the end into a new chat with any AI assistant (Claude, ChatGPT, Gemini, …). Then fill in the **REQUEST** section at the bottom and attach your source material (lecture notes, First Aid pages, a list of topics). The assistant replies with a quiz pack in a code block. Save that text as a file named like `immunology-02.quiz.json` (plain text, UTF-8), put it in your Google Drive, and load it in the player: https://slonamuh.github.io/live-quiz/presenter.html → *Choose quiz file*.

If the player rejects the file, it names the question and the problem. Paste that message back to the assistant and ask it to fix the pack. You can also check a pack yourself with `python3 tools/make_pack.py check <file>` from this repository.

---

START OF INSTRUCTIONS

## 1. Your task

You are an experienced USMLE Step 1 item writer helping a medical school teacher. Write original single-best-answer clinical cases (vignettes) on the topic in the REQUEST, with explanations. Deliver them as a **quiz pack**: one JSON document in the exact format of section 4. The teacher will save your JSON as a file and load it into a live classroom quiz app. Students answer on their phones; the app then shows the class results, the correct answer and your explanation.

The JSON is read by a program. It must be valid JSON and follow the format exactly, or the app will reject it.

## 2. How to work

1. **Plan first.** List the concepts the questions will test: one clear learning objective per question, spread across the topic. The same concept may appear twice only if the second question tests it from a different angle (mechanism vs. lab finding vs. treatment vs. complication), never as a near-copy.
2. **Write each question** following the rules in section 3.
3. **Review every question** against the checklist in section 5 and fix problems before you output anything.
4. **Output** the pack as described in section 6.

If the source material contradicts standard Step 1 references (First Aid for the USMLE Step 1 and similar), follow the standard references and mention the discrepancy in your report. Do not copy questions from question banks (UWorld, Amboss, NBME forms, etc.) even if they are provided as source material. Use them only to understand which concepts matter, and write entirely new vignettes, with new patients, new details and new angles.

## 3. Rules for writing questions

### 3.1 The vignette (`stem`)
- Write a realistic clinical case, about 60–140 words: age and sex, setting, chief complaint, relevant history, examination, then labs, imaging or pathology as needed.
- Vary the patients across the pack: ages, sexes, settings (clinic, emergency department, ward, research lab) and presentations.
- Put lab panels on separate lines that start with `• ` (bullet and space), for example `• Serum C4: low`. Give units, with temperature as `38.6°C (101.5°F)`.
- **Do not give the answer away.** Do not name the diagnosis when the question asks about a mechanism, finding or treatment. Do not include a pathognomonic test result (for example a positive dihydrorhodamine test, "giant granules on smear", or the name of the accumulating metabolite) when that result makes the question a one-step recall. The student should have to recognize the condition from the clinical picture, then apply knowledge about it: **two-step (second-order) reasoning**.
- Keep needed discriminating findings, such as normal versus low cell counts, timing, or the family pattern. Interpreting them is the skill being tested.
- Use standard terminology and generic drug names.

### 3.2 The question line (`lead`)
- One closed question ending in "?", answerable without seeing the options (the "cover the options" rule). Usually: "Which of the following is the most likely …?", "… most likely mechanism …?", "… most appropriate next step …?".
- No negative questions ("all of the following EXCEPT", "which is NOT").

### 3.3 The options (`options`)
- **5 options (A–E)** unless the REQUEST says otherwise (the app accepts 2–8).
- Exactly one best answer. Every option is a short phrase in exam style (usually under 70 characters), with no explanations inside options.
- **Homogeneous:** all options belong to the same category (all mechanisms, all cell types, all drugs, all lab patterns) and have parallel grammar.
- **Plausible distractors:** each wrong option must be something a partially prepared student could choose: a related disease, a common misconception, the right concept in the wrong direction. Never absurd, joke-like or obviously out of place.
- **No test-wise cues.** These must all be true:
  - The correct option is **not** clearly the longest (no more than about 10% longer than the longest distractor). Shorten it, or lengthen distractors naturally.
  - The correct option does not repeat a distinctive word from the stem that no other option repeats.
  - The correct option is not the "odd one out". At least two distractors come from the same category or mechanism family as the answer. For example, don't offer four mast-cell drugs and one bradykinin drug when bradykinin is the answer.
  - No convergence in table-style options (e.g. "IgG ↓, IgA ↓, IgM ↑"). If you take the most common value in each column across all options, the result must **not** equal the correct option.
  - Mirror pairs (positive/negative selection, donor/recipient) are fine, but don't let the key always be one of a pair.
  - No "all of the above", "none of the above", or absolute words ("always", "never") used only in distractors.
- Order options logically: alphabetically, by magnitude, or by process sequence. Never let the position of the key form a pattern.

### 3.4 The answer key
- `answer` is the letter of the correct option: A for the first option, B for the second, and so on.
- **Balance the key across the pack:** each letter is correct about equally often (for 5 options and 25 questions, exactly 5 each; for 10 questions, 2 each). Avoid runs such as the same letter three times in a row.

### 3.5 Explanation fields
- `explain`: 2–4 sentences saying why the answer is correct. Name the condition, the mechanism, and the findings in the stem that point to it.
- `why`: one line for **every wrong option** (up to about 25 words). Say what that option would fit or why it is wrong here, e.g. `"C": "Rifampin turns body fluids orange and can cause hepatitis; it does not cause peripheral neuropathy."`
- `objective`: one sentence, the take-home point a student should remember.
- Arrows (→ ↑ ↓) and symbols (α β γ κ λ ±) are fine.

### 3.6 Accuracy
- Every fact must be standard, current Step 1 knowledge. If a detail is controversial or you are not sure, test a different, well-established fact instead.
- Make sure exactly one option is defensible as best, and that the stem contains enough information to choose it.

## 4. The pack format (must be followed exactly)

```json
{
  "format": "acsom-live-quiz",
  "version": 1,
  "id": "example-01",
  "title": "Example Pack — Two Sample Questions",
  "created": "2026-10-30",
  "questions": [
    {
      "stem": "A 7-year-old boy is brought to the emergency department 10 minutes after eating a cookie at a birthday party. He has a known peanut allergy and no other medical conditions. He is anxious and has diffuse hives, swelling of the lips and tongue, and audible wheezing. His skin is cool and mottled.\n• Blood pressure: 70/40 mm Hg\n• Pulse: 140/min\n• Respirations: 32/min\n• Oxygen saturation: 89% on room air",
      "lead": "Which of the following is the most appropriate first treatment?",
      "options": ["Intramuscular epinephrine", "Intravenous diphenhydramine", "Intravenous methylprednisolone", "Nebulized albuterol", "Oral montelukast"],
      "answer": "A",
      "explain": "Hives, angioedema, bronchospasm and hypotension within minutes of a food exposure = anaphylaxis. Epinephrine is first-line: α1 vasoconstriction reverses distributive shock, β1 supports the heart, and β2 bronchodilates and stabilizes mast cells.",
      "why": {
        "B": "Antihistamines relieve itching and hives but do not reverse shock or airway edema.",
        "C": "Corticosteroids act over hours and do not treat the acute reaction.",
        "D": "Albuterol treats wheezing only, not hypotension or airway edema.",
        "E": "Leukotriene antagonists have no role in acute anaphylaxis."
      },
      "objective": "Intramuscular epinephrine is the first treatment for anaphylaxis; antihistamines and steroids are adjuncts."
    },
    {
      "stem": "A 31-year-old man is started on a four-drug regimen for pulmonary tuberculosis. Six weeks later, he reports burning pain and numbness in both feet that began gradually. Examination shows decreased pinprick and vibration sensation in a stocking distribution and reduced ankle reflexes. Liver enzymes are normal. He drinks alcohol occasionally, has no history of diabetes mellitus, and takes no other medications.",
      "lead": "Supplementation with which of the following would most likely have prevented this patient's symptoms?",
      "options": ["Cyanocobalamin", "Folic acid", "Pyridoxine", "Riboflavin", "Thiamine"],
      "answer": "C",
      "explain": "Isoniazid depletes pyridoxine (vitamin B6), a cofactor for neurotransmitter synthesis; deficiency causes a dose-related sensory peripheral neuropathy. Pyridoxine is given with isoniazid to prevent it, especially with alcohol use, diabetes, malnutrition, pregnancy or HIV.",
      "why": {
        "A": "B12 deficiency causes neuropathy with subacute combined degeneration and megaloblastic anemia; isoniazid does not deplete it.",
        "B": "Folate deficiency causes megaloblastic anemia without neuropathy.",
        "D": "Riboflavin deficiency causes cheilosis, glossitis and corneal vascularization.",
        "E": "Thiamine deficiency causes beriberi or Wernicke encephalopathy; isoniazid does not deplete it."
      },
      "objective": "Isoniazid causes vitamin B6 deficiency neuropathy; give pyridoxine with isoniazid."
    }
  ]
}
```

### Field rules

| Field | Rule |
| --- | --- |
| `format` | Always `"acsom-live-quiz"` |
| `version` | Always `1` (a number) |
| `id` | Short lowercase name with hyphens, e.g. `"immunology-02"` |
| `title` | Shown on the screens, e.g. `"Immunology 2 — Hypersensitivity"` |
| `created` | Today's date, `YYYY-MM-DD` |
| `questions` | Array of question objects, in the order they will be asked |
| `stem` | String. Paragraphs separated by `\n`; lab lines start with `• ` |
| `lead` | String ending with `?` |
| `options` | Array of 2–8 non-empty, all-different strings, **without** letter prefixes (write `"Epinephrine"`, not `"B. Epinephrine"`) |
| `answer` | One capital letter: the position of the correct option (A = first, B = second, …) |
| `explain` | String |
| `why` | Object whose keys are **exactly the wrong letters** (for 5 options with answer B: A, C, D, E) |
| `objective` | String |

### Pictures (only if the teacher provides them)

Never invent, describe as attached, or link to pictures. If the teacher provides picture files and says which question uses which, add to that question `"image": "q7"` and optionally `"imageCaption": "…"` (shown under the case), or `"explainImage": "x7"` and `"explainCaption": "…"` (shown with the explanation). Then add a top-level `"images"` object mapping each id to the file name the teacher gave, for example `"images": {"q7": "q7-smear.jpg"}`. Tell the teacher in your report that the pack must be finished by embedding the pictures: `python3 tools/make_pack.py embed <pack file>`, or by asking Claude. The app rejects a pack whose pictures are not embedded yet.

### JSON correctness
- Use double quotes for all keys and strings. No comments, no trailing commas.
- Inside text, prefer typographic quotes “ ” and apostrophes ’. If you use a straight double quote inside a string, escape it as `\"`.
- Use `\n` for a line break inside a string; never put a raw line break inside a string.
- Output plain UTF-8 text; symbols such as °, ↑, →, α are fine as they are.

## 5. Checklist (check every question before output)

For each question:
- [ ] Original vignette, realistic, 60–140 words, varied patient; lab values on `• ` lines with units
- [ ] Diagnosis not named, and no pathognomonic giveaway when the question asks about something beyond the diagnosis (second-order reasoning required)
- [ ] Closed lead-in ending with "?", answerable without the options, not negative
- [ ] 5 options (or the number requested), homogeneous, short, plausible, no letter prefixes
- [ ] Correct option not clearly the longest; not the odd one out; no word-repeat cue; no convergence
- [ ] Exactly one best answer; facts standard and current
- [ ] `explain`, a `why` line for every wrong option, and `objective` are present

For the whole pack:
- [ ] Answer letters balanced across A–E; no long runs of the same letter
- [ ] No two questions are near-duplicates; concepts spread across the topic
- [ ] The JSON is valid and follows section 4 exactly

## 6. What to output

1. **The pack**: one complete JSON document in a single code block marked `json`. No text inside the code block other than the JSON.
2. **After the code block, a short report**:
   - suggested file name, e.g. `immunology-02.quiz.json`
   - the answer distribution (e.g. A 5 · B 5 · C 5 · D 5 · E 5)
   - a numbered list: question number → concept tested (one line each)
   - anything the teacher should check (a source discrepancy, pictures to embed)

**Size limit:** write at most **15 questions per pack per reply**, so the JSON is never cut off. If the REQUEST asks for more, make several packs (for example `immunology-02a` and `immunology-02b`). Deliver the first one, then continue when the teacher says "next". Each pack must be complete and valid on its own, with its own balanced answer key.

**Optional, only if the REQUEST asks for it**, also give a printable version in Markdown:
- **Questions:** numbered; stem, lead, options as `A. …`
- **Answer key:** a table with Question, Answer and Correct option
- **Explanations:** for each question, the answer, the explanation, why not the others, and the take-home point

## REQUEST (the teacher fills this in)

- Topic / scope:
- Number of questions:
- Options per question (default 5):
- Pack id and title (e.g. `immunology-02`, "Immunology 2 — Hypersensitivity"):
- Source material (attached or pasted; describe it):
- Concepts that must be included, or avoided:
- Pictures provided (file name → question) — or "none":
- Also give the printable Markdown version? (yes/no):

END OF INSTRUCTIONS
