# Course sets for self-study

Quiz files (`.quiz.json`) in this folder appear in the **Course sets** list of the self-study page
(https://slonamuh.github.io/live-quiz/study/).

- **This folder is public.** Anyone can download these files, answers included. Put a set here only if it is
  meant for open practice, never one you will use as a graded test.
- **Adding a set on GitHub:** open this folder, *Add file → Upload files*, drop the `.quiz.json`, commit.
  It appears for students within about 20 minutes (their list is refreshed from GitHub's folder listing).
- **File names:** letters, digits, `-`, `_` and `.` only, e.g. `gram-positive-mixed-40.quiz.json`.
- `index.json` (titles, descriptions, numbers of cases) is written by `python3 tools/build_pages.py`, which also
  checks every set. Until it is rebuilt, a newly uploaded set is listed under its file name; the title shows once
  it is opened.
- To change a set, replace its file. Students who were part-way through it start it again.
