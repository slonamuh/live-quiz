"""Create and check quiz packs (.quiz.json) for the Live Quiz player.

Check a pack:
    python3 tools/make_pack.py check my-quiz.quiz.json

Embed pictures (files referenced by path in the pack's "images") as data URIs:
    python3 tools/make_pack.py embed my-quiz.quiz.json      # rewrites the file in place

Use from Python:
    from make_pack import make_pack, write_pack
    pack = make_pack('immunology-02', 'Immunology 2', questions, images={'q3': 'pictures/q3.png'})
    write_pack(pack, 'immunology-02.quiz.json')

The format is described in docs/pack-format.md.
Quiz packs contain the answers: keep them in your own storage (e.g. Google Drive), never in this public repository.
"""
import base64
import datetime
import io
import json
import os
import sys
from collections import Counter

LETTERS = 'ABCDEFGH'
IMAGE_PREFIXES = tuple(f'data:image/{t};base64,' for t in ('png', 'jpeg', 'gif', 'webp', 'svg+xml'))


def image_data_uri(path, max_side=1400):
    """Resize a picture and embed it. Diagrams stay PNG; photos become JPEG when that is much smaller."""
    from PIL import Image  # pip install pillow
    im = Image.open(path)
    im.load()
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    png = io.BytesIO()
    im.save(png, 'PNG', optimize=True)
    png = png.getvalue()
    fmt, data = 'png', png
    if not has_alpha:
        jpg = io.BytesIO()
        im.convert('RGB').save(jpg, 'JPEG', quality=82, optimize=True, progressive=True)
        jpg = jpg.getvalue()
        if len(png) > len(jpg) * 1.25:
            fmt, data = 'jpeg', jpg
    return f'data:image/{fmt};base64,' + base64.b64encode(data).decode()


def validate(pack):
    """Return (errors, warnings, answer_distribution). Errors make the player reject the pack."""
    errs, warns = [], []
    qs = pack.get('questions') or []
    if not qs:
        errs.append('the pack has no questions')
    images = pack.get('images') or {}
    for k, v in images.items():
        if not isinstance(v, str) or not v.startswith(IMAGE_PREFIXES):
            errs.append(f'image {k!r} is not an embedded picture (run: make_pack.py embed)')
        elif len(v) > 600_000:
            warns.append(f'image {k!r} is large ({len(v) // 1024} KB) and will be slow to reach phones')
    for i, q in enumerate(qs, 1):
        opts = q.get('options') or []
        if not 2 <= len(opts) <= 8:
            errs.append(f'Q{i}: needs 2 to 8 options')
            continue
        letters = LETTERS[:len(opts)]
        if q.get('answer') not in letters:
            errs.append(f'Q{i}: the answer must be one of {", ".join(letters)}')
        if len(set(opts)) != len(opts) or any(not str(o).strip() for o in opts):
            errs.append(f'Q{i}: options must be non-empty and different')
        for key in ('stem', 'lead'):
            if not str(q.get(key, '')).strip():
                errs.append(f'Q{i}: "{key}" is missing')
        for key in ('image', 'explainImage'):
            if q.get(key) and q[key] not in images:
                errs.append(f'Q{i}: picture {q[key]!r} is not in "images"')
        if not q.get('explain'):
            warns.append(f'Q{i}: no explanation')
        missing = [l for l in letters if l != q.get('answer') and not (q.get('why') or {}).get(l)]
        if missing:
            warns.append(f'Q{i}: no "why not" for {", ".join(missing)}')
        if q.get('answer') in letters:
            # Flag only a meaningful length cue: the key is the longest option by at least 10%
            # and is a phrase (25+ characters), not a short name such as an organism or a cell type.
            lengths = [len(o) for o in opts]
            c = letters.index(q['answer'])
            others = max(l for j, l in enumerate(lengths) if j != c)
            if lengths[c] >= 25 and lengths[c] >= others * 1.10:
                warns.append(f'Q{i}: the correct option is clearly the longest (test-wise cue)')
    dist = Counter(q.get('answer') for q in qs)
    if len(qs) >= 10 and dist and max(dist.values()) - min(dist.get(l, 0) for l in LETTERS[:5]) > 2:
        warns.append(f'answer letters are unbalanced: {dict(sorted(dist.items()))}')
    return errs, warns, dist


def make_pack(pack_id, title, questions, images=None, created=None):
    """Assemble a pack. `images` maps an id to a file path (embedded) or an existing data URI."""
    pack = {'format': 'acsom-live-quiz', 'version': 1, 'id': pack_id, 'title': title,
            'created': created or datetime.date.today().isoformat(), 'questions': questions}
    if images:
        pack['images'] = {k: (v if str(v).startswith('data:image/') else image_data_uri(v))
                          for k, v in images.items()}
    return pack


def write_pack(pack, path):
    errs, warns, dist = validate(pack)
    if errs:
        raise SystemExit('The pack has errors:\n  ' + '\n  '.join(errs))
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False, indent=1)
    return warns, dist


def _cli():
    if len(sys.argv) != 3 or sys.argv[1] not in ('check', 'embed'):
        sys.exit(__doc__)
    cmd, path = sys.argv[1], sys.argv[2]
    with open(path, encoding='utf-8') as f:
        pack = json.load(f)
    if cmd == 'embed':
        base = os.path.dirname(os.path.abspath(path))
        pack['images'] = {k: (v if str(v).startswith('data:image/') else image_data_uri(os.path.join(base, v)))
                          for k, v in (pack.get('images') or {}).items()}
        warns, dist = write_pack(pack, path)
    else:
        errs, warns, dist = validate(pack)
        if errs:
            sys.exit('NOT OK — the player will reject this pack:\n  ' + '\n  '.join(errs))
    print(f'OK: {len(pack["questions"])} questions, answers {dict(sorted(dist.items()))}, '
          f'{os.path.getsize(path) // 1024} KB')
    for w in warns:
        print('  warning:', w)


if __name__ == '__main__':
    _cli()
