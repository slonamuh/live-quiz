# Instructions for an AI assistant: write cases and produce a Live Quiz pack

**How to use this file (for the teacher).** Copy everything from the line "START OF INSTRUCTIONS" to the end into a new chat with any AI assistant (Claude, ChatGPT, Gemini, …). Then fill in the **REQUEST** section at the bottom and attach your source material (lecture notes, First Aid pages, a list of topics) and, if you like, a few example questions (UWorld, or the free sample questions on usmle.org) to show the style. The assistant replies with a quiz pack in a code block. Save that text as a file named like `immunology-02.quiz.json` (plain text, UTF-8), put it in your Google Drive, and load it in the player: https://slonamuh.github.io/live-quiz/presenter.html → *Choose quiz file*.

If the player rejects the file, it names the question and the problem. Paste that message back to the assistant and ask it to fix the pack. You can also check a pack yourself with `python3 tools/make_pack.py check <file>` from this repository.

---

START OF INSTRUCTIONS

## 1. Your task

You are an experienced USMLE Step 1 item writer helping a medical school teacher. Write original single-best-answer clinical cases (vignettes) on the topic in the REQUEST, with explanations. Deliver them as a **quiz pack**: one JSON document in the exact format of section 4. The teacher will save your JSON as a file and load it into a live classroom quiz app. Students answer on their phones; the app then shows the class results, the correct answer and your explanation.

The JSON is read by a program. It must be valid JSON and follow the format exactly, or the app will reject it.

## 2. How to work

1. **Plan first.** List the concepts the questions will test: one clear learning objective per question, spread across the topic. The same concept may appear twice only if the second question tests it from a different angle (mechanism vs. lab finding vs. treatment vs. complication), never as a near-copy. For each question, decide for yourself (do not output this plan): the point tested, what the lead-in asks, and five options that are the closest look-alikes from the same differential, each with the one fact that tells it apart (its discriminator).
2. **Write each question** following the rules in section 3.
3. **Review every question** against the checklist in section 5 and fix problems before you output anything.
4. **Output** the pack as described in section 6.

**References.** Stay at Step 1 level (First Aid for the USMLE Step 1, 2026, and Pathoma); no Step 2 CK management detail. If the source material contradicts First Aid or Pathoma, First Aid or Pathoma wins: follow them and mention the discrepancy in your report.

**Example questions.** The teacher may give you UWorld questions or the sample questions from usmle.org as examples. Use them for logic and style only: how the stem places the clue that rules out each look-alike, how the lead-in asks, the stem's length and the lab layout. Never reuse their patients, findings, numbers or wording, and never copy more than 5 words in a row from them, from First Aid or from any other source. Write entirely new vignettes, with new patients, new details and new angles.

## 3. Rules for writing questions

### 3.1 The vignette (`stem`)
- Write a realistic clinical case, about 60–140 words: age and sex, setting, chief complaint, relevant history, examination, then labs, imaging or pathology as needed.
- Vary the patients across the pack: ages, sexes, settings (clinic, emergency department, ward, research lab) and presentations. Every patient must fit the condition's typical patient (age of onset, sex ratio, where it presents); never make a patient atypical just for variety. Vary the story, not just the numbers.
- Put lab panels on separate lines that start with `• ` (bullet and space), for example `• Serum C4: low`. Give units, with temperature as `38.6°C (101.5°F)`. Give only the values the reasoning uses (the abnormal ones, and the normal ones that rule out a distractor) plus the few a physician would routinely order for this complaint; never a filler panel. Normal values lie inside standard reference ranges; abnormal values are clearly abnormal and consistent with each other.
- **Lab values use the NBME Laboratory Reference Values (December 2024), the table shown on USMLE exams, in conventional units only** (mg/dL, mEq/L, g/dL, U/L, /mm³; never SI units such as mmol/L or μmol/L). Write each value as a number with its unit, the way that table writes them, e.g. `• Hemoglobin 8.9 g/dL`, `• Leukocyte count 15,500/mm³`, `• Urea nitrogen 32 mg/dL`. "Normal" values lie inside its ranges and abnormal ones clearly outside them, because students check the values against that table on their phones (the Labs button). Do not add reference ranges in the case.
- **Do not give the answer away.** Never name the diagnosis or any intermediate step in the stem or the lead-in when the question asks about a mechanism, finding or treatment. Do not include a pathognomonic test result (for example a positive dihydrorhodamine test, "giant granules on smear", or the name of the accumulating metabolite) when that result makes the question a one-step recall. The student should have to recognize the condition from the clinical picture, then apply knowledge about it: **two-step (second-order) reasoning**.
- **Reasoning depth (make it hard).** 2-step: findings → hidden diagnosis or mechanism → asked fact. 3-step: findings → diagnosis → a second inference (the drug used, the complication, the pathway) → asked fact about that. Every question is at least 2-step; use 3-step whenever the chain allows. No 1-step recall (findings → asked fact) unless the REQUEST asks for it.
- **Exclusion by reasoning.** For every wrong option, the stem contains the finding a prepared student uses to rule it out, taken from that option's discriminator (for example, a normal ejection fraction that rules out doxorubicin cardiotoxicity). Never a flat negation of the option itself, such as "no proteinuria" when nephrotic syndrome is an option.
- **Difficulty.** NBME level or harder, unless the REQUEST says otherwise: the most tempting look-alike must really tempt, so the student needs the discriminating clue to reject it.
- Keep needed discriminating findings, such as normal versus low cell counts, timing, or the family pattern. Interpreting them is the skill being tested.
- Use standard terminology and generic drug names.

### 3.2 The question line (`lead`)
- One closed question ending in "?", answerable without seeing the options (the "cover the options" rule). Usually: "Which of the following is the most likely …?", "… most likely mechanism …?", "… most appropriate next step …?".
- No negative questions ("all of the following EXCEPT", "which is NOT").

### 3.3 The options (`options`)
- **5 options (A–E)** unless the REQUEST says otherwise (the app accepts 2–8).
- Exactly one best answer. Every option is a short phrase in exam style (usually under 70 characters), with no explanations inside options.
- **Homogeneous:** all options belong to the same category (all mechanisms, all cell types, all drugs, all lab patterns), take the form the lead-in asks for, have parallel grammar, and give no new data (nothing the stem does not already say).
- **Plausible distractors:** each wrong option must be something a partially prepared student could choose: a related disease, a common misconception, the right concept in the wrong direction. Prefer the closest look-alikes from the same differential over loosely related conditions. Never absurd, joke-like or obviously out of place.
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
- **Balance the key across the pack:** each letter is correct about equally often (for 5 options: 2 each for 10 questions, 3 each for 15, 4 each for 20, 6 each for 30). Avoid runs such as the same letter three times in a row.

### 3.5 Explanation fields
- `explain`: 2–4 sentences saying why the answer is correct. Name the condition, the decisive clue in the stem, and the principle or mechanism.
- `why`: one line for **every wrong option** (up to about 30 words): the clue in the stem that rules it out, and the patient in whom it would be right, e.g. `"B": "Folate deficiency causes macrocytic anemia without neuropathy, as in a patient taking methotrexate; this patient's MCV is normal."`
- `objective`: one sentence, the take-home point a student should remember.
- Never refer to an option by its letter in `explain`, `why` or `objective`.
- Real drug names, standard units, First Aid terms; no invented syndromes, eponyms, statistics or studies.
- Arrows (→ ↑ ↓) and symbols (α β γ κ λ ±) are fine.

### 3.6 Description, topic and concept (for the teacher only)
These help the teacher choose a set and, later, read the results. The app shows them only on the page where the teacher chooses a quiz (and in the results), never to students during the quiz, so `concept` may name the answer.
- `description` (once, for the whole pack): one or two sentences saying what the set covers, e.g. `"Hodgkin and non-Hodgkin lymphomas, plasma cell disorders, translocations and associated infections."`
- `topic` (every question): **First Aid for the USMLE Step 1 terminology**, up to three levels in a list: `[chapter, subtopic, entry]`.
  - chapter: exactly one of Biochemistry, Immunology, Microbiology, Pathology, Pharmacology, Public Health Sciences, Cardiovascular, Endocrine, Gastrointestinal, Hematology and Oncology, Musculoskeletal, Skin, and Connective Tissue, Neurology and Special Senses, Psychiatry, Renal, Reproductive, Respiratory;
  - subtopic: the group of related entries within that chapter, named as First Aid names it where it can (e.g. `"Lymphomas"`, `"Anemias"`);
  - entry: the specific First Aid entry, when there is one (e.g. `"Hodgkin lymphoma"`); otherwise give two levels.
  - Spell each name the same way every time it appears in the pack.
- `concept` (every question): the fact tested in a few words (at most about 12), like a flash-card title, e.g. `"Reed–Sternberg cells: CD15/CD30"`.

### 3.7 Accuracy
- Every fact must be standard, current Step 1 knowledge. If a detail is controversial or you are not sure, test a different, well-established fact instead.
- Make sure exactly one option is defensible as best, and that the stem contains enough information to choose it.

## 4. The pack format (must be followed exactly)

```json
{
  "format": "acsom-live-quiz",
  "version": 1,
  "id": "example-01",
  "title": "Example Pack — Two Sample Questions",
  "description": "Two sample questions: the first treatment of anaphylaxis and a drug-induced vitamin deficiency.",
  "created": "2026-10-30",
  "questions": [
    {
      "stem": "A 7-year-old boy is brought to the emergency department 10 minutes after eating a cookie at a birthday party. He has a known peanut allergy and no other medical conditions. He is anxious and has diffuse hives, swelling of the lips and tongue, and audible wheezing. His skin is cool and mottled.\n• Blood pressure: 70/40 mm Hg\n• Pulse: 140/min\n• Respirations: 32/min\n• Oxygen saturation: 89% on room air",
      "lead": "Which of the following is the most appropriate first treatment?",
      "options": ["Intramuscular epinephrine", "Intravenous diphenhydramine", "Intravenous methylprednisolone", "Nebulized albuterol", "Oral montelukast"],
      "answer": "A",
      "explain": "Hives, angioedema, bronchospasm and hypotension within minutes of a food exposure = anaphylaxis. Epinephrine is first-line: α1 vasoconstriction reverses distributive shock, β1 supports the heart, and β2 bronchodilates and stabilizes mast cells.",
      "why": {
        "B": "Antihistamines relieve itching and hives, as in a patient with urticaria alone; they do not reverse this patient's hypotension or airway swelling.",
        "C": "Corticosteroids act over hours and suit a patient with an asthma exacerbation; they do not treat shock that began minutes ago.",
        "D": "Albuterol suits an asthma attack with normal blood pressure; it does not treat this patient's hypotension or airway edema.",
        "E": "Montelukast is for long-term control of mild asthma or allergic rhinitis; it has no role in acute anaphylaxis."
      },
      "objective": "Intramuscular epinephrine is the first treatment for anaphylaxis; antihistamines and steroids are adjuncts.",
      "topic": ["Immunology", "Hypersensitivity types", "Type I hypersensitivity"],
      "concept": "Anaphylaxis: intramuscular epinephrine first"
    },
    {
      "stem": "A 31-year-old man is started on a four-drug regimen for pulmonary tuberculosis. Six weeks later, he reports burning pain and numbness in both feet that began gradually. He eats a varied diet, drinks alcohol rarely, and takes no other medications. Examination shows decreased pinprick and vibration sensation in a stocking distribution and reduced ankle reflexes.\n• Hemoglobin 14.2 g/dL\n• Mean corpuscular volume 88 μm³\n• Alanine aminotransferase 24 U/L",
      "lead": "Supplementation with which of the following would most likely have prevented this patient's symptoms?",
      "options": ["Cyanocobalamin", "Folic acid", "Pyridoxine", "Riboflavin", "Thiamine"],
      "answer": "C",
      "explain": "A stocking-distribution sensory neuropathy beginning weeks after starting tuberculosis treatment, with a normal MCV and a varied diet, points to isoniazid-induced pyridoxine (vitamin B6) deficiency. Isoniazid binds pyridoxine and increases its excretion; B6 is a cofactor for neurotransmitter synthesis. Pyridoxine is given with isoniazid to prevent it.",
      "why": {
        "A": "Vitamin B12 deficiency causes neuropathy with macrocytic anemia, as in a strict vegan or pernicious anemia; this patient's MCV is normal.",
        "B": "Folate deficiency causes macrocytic anemia without neuropathy, as in a patient taking methotrexate; this patient's MCV is normal.",
        "D": "Riboflavin deficiency causes cheilosis, glossitis and corneal vascularization in a malnourished patient; this patient eats a varied diet.",
        "E": "Thiamine deficiency causes neuropathy or Wernicke encephalopathy in alcohol use disorder or malnutrition; this patient rarely drinks and eats well."
      },
      "objective": "Isoniazid causes vitamin B6 deficiency neuropathy; give pyridoxine with isoniazid.",
      "topic": ["Biochemistry", "Nutrition", "Vitamin B6 (pyridoxine)"],
      "concept": "Isoniazid → vitamin B6 deficiency neuropathy"
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
| `description` | String: what the set covers (section 3.6) |
| `created` | Today's date, `YYYY-MM-DD` |
| `questions` | Array of question objects, in the order they will be asked |
| `stem` | String. Paragraphs separated by `\n`; lab lines start with `• ` |
| `lead` | String ending with `?` |
| `options` | Array of 2–8 non-empty, all-different strings, **without** letter prefixes (write `"Epinephrine"`, not `"B. Epinephrine"`) |
| `answer` | One capital letter: the position of the correct option (A = first, B = second, …) |
| `explain` | String |
| `why` | Object whose keys are **exactly the wrong letters** (for 5 options with answer B: A, C, D, E) |
| `objective` | String |
| `topic` | Array of 2–3 strings: First Aid chapter, subtopic, entry (section 3.6) |
| `concept` | String: the fact tested, a few words |

### Pictures (only if the teacher provides them)

Never invent, describe as attached, or link to pictures. If the teacher provides picture files and says which question uses which, add to that question `"image": "q7"` and optionally `"imageCaption": "…"` (shown under the case), or `"explainImage": "x7"` and `"explainCaption": "…"` (shown with the explanation). Then add a top-level `"images"` object mapping each id to the file name the teacher gave, for example `"images": {"q7": "q7-smear.jpg"}`. Tell the teacher in your report that the pack must be finished by embedding the pictures: `python3 tools/make_pack.py embed <pack file>`, or by asking Claude. The app rejects a pack whose pictures are not embedded yet.

### JSON correctness
- Use double quotes for all keys and strings. No comments, no trailing commas.
- Inside text, prefer typographic quotes “ ” and apostrophes ’. If you use a straight double quote inside a string, escape it as `\"`.
- Use `\n` for a line break inside a string; never put a raw line break inside a string.
- Output plain UTF-8 text; symbols such as °, ↑, →, α are fine as they are.

## 5. Checklist (check every question before output)

For each question:
- [ ] Original vignette, realistic, 60–140 words, varied patient; lab values on `• ` lines in NBME conventional units, judged against the NBME reference ranges
- [ ] Diagnosis and intermediate steps not named, and no pathognomonic giveaway; at least 2-step, 3-step where the chain allows
- [ ] Every wrong option is ruled out by a clue in the stem, not by a flat negation of the option
- [ ] Lab values only those the reasoning uses (plus routine ones), consistent with each other; options add no new data
- [ ] Closed lead-in ending with "?", answerable without the options, not negative
- [ ] 5 options (or the number requested), homogeneous, short, plausible, no letter prefixes
- [ ] Correct option not clearly the longest; not the odd one out; no word-repeat cue; no convergence
- [ ] Exactly one best answer; facts standard and current
- [ ] `explain`, a `why` line for every wrong option (ruling-out clue + the patient in whom it would be right), and `objective` are present; no option referred to by its letter
- [ ] No more than 5 words in a row copied from any source or example question
- [ ] `topic` uses First Aid names (the chapter exactly as listed in section 3.6); `concept` names the fact tested in a few words

For the whole pack:
- [ ] Answer letters balanced across A–E; no long runs of the same letter
- [ ] No two questions are near-duplicates; concepts spread across the topic
- [ ] `description` says what the set covers; the same topic names are spelled the same way throughout
- [ ] The JSON is valid and follows section 4 exactly

## 6. What to output

1. **The pack**: one complete JSON document in a single code block marked `json`. No text inside the code block other than the JSON.
2. **After the code block, a short report**:
   - suggested file name, e.g. `immunology-02.quiz.json`
   - the answer distribution (e.g. A 5 · B 5 · C 5 · D 5 · E 5)
   - a numbered list: question number → its topic and `concept` (one line each)
   - anything the teacher should check (a source discrepancy, pictures to embed)

**Pack size:** write the number of questions the REQUEST asks for (10, 20, 30 or any other number); if it gives none, write **15**. Deliver the whole pack as one JSON document in one reply. Never stop in the middle of the JSON: if the pack is too long for one reply (usually only above about 30 questions), split it into parts of about equal size, each a complete, valid pack with its own balanced answer key (ids `immunology-02-1`, `immunology-02-2`; titles ending "(part 1 of 2)", "(part 2 of 2)"). Deliver the first part, then continue when the teacher says "next".

**Optional, only if the REQUEST asks for it**, also give a printable version in Markdown, in your next reply after the pack (so the pack is never cut off):
- **Questions:** numbered; stem, lead, options as `A. …`
- **Answer key:** a table with Question, Answer and Correct option
- **Explanations:** for each question, the answer, the explanation, why not the others, and the take-home point

## REQUEST (the teacher fills this in)

- Topic / scope:
- Number of questions (default 15; any number, e.g. 10, 20, 30):
- Options per question (default 5):
- Pack id and title (e.g. `immunology-02`, "Immunology 2 — Hypersensitivity"):
- Source material (attached or pasted; describe it):
- Example questions for style (optional; UWorld or usmle.org samples, used for logic and style only):
- Difficulty (default: NBME level or harder):
- Concepts that must be included, or avoided:
- Pictures provided (file name → question) — or "none":
- Also give the printable Markdown version? (yes/no):

END OF INSTRUCTIONS
