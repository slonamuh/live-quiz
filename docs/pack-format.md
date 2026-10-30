# Quiz pack format (version 1)

A quiz pack is one UTF-8 JSON file, by convention named `<topic>-<NN>.quiz.json` (for example `immunology-01.quiz.json`). The player loads it from the teacher's computer; it is never uploaded anywhere. Packs contain the answers, so keep them out of this public repository.

## Example

```json
{
  "format": "acsom-live-quiz",
  "version": 1,
  "id": "example-01",
  "title": "Example pack",
  "created": "2026-10-30",
  "images": {
    "rash": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  },
  "questions": [
    {
      "stem": "A 7-year-old boy develops hives, lip swelling and wheezing minutes after eating a peanut cookie.\n• Blood pressure: 70/40 mm Hg\n• Pulse: 140/min",
      "lead": "Which of the following should be given first?",
      "options": ["Diphenhydramine", "Epinephrine", "Methylprednisolone", "Montelukast", "Ranitidine"],
      "answer": "B",
      "explain": "Anaphylaxis with hypotension: intramuscular epinephrine first (α1 vasoconstriction, β1 cardiac support, β2 bronchodilation).",
      "why": {
        "A": "Antihistamines relieve itching and hives but do not treat shock or airway edema.",
        "C": "Corticosteroids act over hours.",
        "D": "Leukotriene antagonists have no role in acute anaphylaxis.",
        "E": "H2 blockers are adjuncts at most."
      },
      "objective": "Epinephrine is first-line for anaphylaxis.",
      "image": "rash",
      "imageCaption": "Urticarial rash"
    }
  ]
}
```

## Fields

**Pack**

| Field | Required | Meaning |
| --- | --- | --- |
| `format`, `version` | recommended | `"acsom-live-quiz"`, `1` |
| `id` | recommended | Short name; together with the content it identifies the pack in "Recent quizzes" |
| `title` | recommended | Shown on the screens and in the CSV (defaults to the file name) |
| `created` | optional | Date, for your records |
| `images` | optional | Map of picture id → embedded picture (`data:image/png|jpeg|gif|webp|svg+xml;base64,...`) |
| `questions` | **required** | List of questions, shown in this order |

**Question**

| Field | Required | Meaning |
| --- | --- | --- |
| `stem` | **required** | The case. `\n` separates paragraphs; lines that start with `• ` become a bullet list (good for lab values). |
| `lead` | **required** | The question line, shown in bold. |
| `options` | **required** | 2 to 8 answer options. Letters A–H are assigned by position. Keep them short, as on the exam. |
| `answer` | **required** | Letter of the correct option. |
| `explain` | recommended | Explanation shown at reveal (2–4 sentences). |
| `why` | recommended | Map of each *wrong* letter → one line on why it is wrong. |
| `objective` | recommended | Take-home sentence. |
| `image`, `imageCaption` | optional | Picture id (from `images`) shown under the case, and its caption. |
| `explainImage`, `explainCaption` | optional | Picture shown with the explanation at reveal. |

## Rules the player enforces

A pack is rejected, with a message naming the question, if: there are no questions; a question has no `stem` or `lead`; it has fewer than 2 or more than 8 options, or an empty option; `answer` is not one of its letters; a picture id is missing from `images`; or a picture is not an embedded image. Missing explanations are allowed (the lobby shows a warning, and the reveal simply shows the answer).

## Pictures

Pictures are embedded in the pack and sent to the phones in small pieces while the quiz runs, so keep them small: about 1400 px on the long side and under ~400 KB embedded. `tools/make_pack.py` does this for you: diagrams stay PNG (sharp lines), photos become JPEG quality 82 when that is much smaller.

```bash
# images in the pack can be file paths relative to the pack; this replaces them with embedded pictures
python3 tools/make_pack.py embed my-quiz.quiz.json
```

## Checking a pack

```bash
python3 tools/make_pack.py check my-quiz.quiz.json
```

It reports what the player would reject, plus writing warnings: missing explanations or "why not" lines, an unbalanced answer key, and a correct option that is clearly the longest (a test-wise cue).
