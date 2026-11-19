"""Build the published pages from src/ into the repository.

    npm install              # once: fetches PeerJS and the QR library into node_modules/
    python3 tools/build_pages.py

Writes
    index.html        the player (teacher's screen), so the site's own address opens it
    join/index.html   the phone page (…/join/), which the QR code and links open
    editor.html       the quiz editor
    study/index.html  self-study for one student on one device (…/study/)
    sets/index.json   the list of course sets in sets/ (title, description, number of cases), for self-study
    presenter.html    the player's old address: forwards to ./ (keeps ?open=, ?audience=, …)
All are fully self-contained: the libraries are inlined, so the pages work
without any CDN. No page may contain quiz content; the build fails if it finds
pack data.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = os.path.join(ROOT, 'node_modules')


# The player used to live at presenter.html: bookmarks, docs and old editor links still point there.
FORWARD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Live Quiz — Player</title>
<script>location.replace('./' + location.search + location.hash);</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem">
<p>The player has moved to <a href="./">the site's main address</a>. Please update your bookmark.</p>
</body>
</html>
"""


def sets_index():
    """sets/ holds the course sets students can open in self-study (public: they include the answers)."""
    import json
    import make_pack
    d = os.path.join(ROOT, 'sets')
    os.makedirs(d, exist_ok=True)
    out = []
    for name in sorted(os.listdir(d)):
        if not name.endswith('.quiz.json'):
            continue
        if not re.fullmatch(r'[A-Za-z0-9_.-]+\.quiz\.json', name):
            sys.exit(f'sets/{name}: use only letters, digits, "-", "_" and "." in set file names')
        with open(os.path.join(d, name), encoding='utf-8') as f:
            pack = json.load(f)
        errs = make_pack.validate(pack)[0]
        if errs:
            sys.exit(f'sets/{name}: ' + '; '.join(errs[:3]))
        out.append({'file': name, 'title': pack.get('title') or name, 'description': pack.get('description') or '', 'n': len(pack['questions'])})
    with open(os.path.join(d, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'sets': out}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    return len(out)


def read(*parts):
    with open(os.path.join(*parts), encoding='utf-8') as f:
        return f.read()


def main():
    try:
        peerjs = read(NM, 'peerjs', 'dist', 'peerjs.min.js')
        qrlib = read(NM, 'qrcode-generator', 'qrcode.js')
    except FileNotFoundError:
        sys.exit('Libraries not found — run "npm install" in the repository first.')
    for name, src in (('peerjs', peerjs), ('qrcode-generator', qrlib)):
        if '</script' in src.lower():
            sys.exit(f'{name} contains "</script" and cannot be inlined safely')
    peerjs = '/*! PeerJS | MIT License | peerjs.com */\n' + peerjs.replace('//# sourceMappingURL=peerjs.min.js.map', '')
    qrlib = '/*! qrcode-generator | MIT License | Kazuhiko Arase */\n' + qrlib

    # shared parts: the look (every page; the dark palette on the phone pages), the pack checker (player, self-study)
    # and the lab values sheet (phones, self-study)
    sh = lambda name: read(ROOT, 'src', 'shared', name)
    theme, theme_dark, pack, labs_js, labs_css = sh('theme.css'), sh('theme-dark.css'), sh('pack.js'), sh('labs.js'), sh('labs.css')
    def shared(html):
        for k, v in (('THEME', theme), ('THEMEDARK', theme_dark), ('PACK', pack), ('LABS', labs_js), ('LABSCSS', labs_css)):
            html = html.replace('/*__' + k + '__*/', v, 1)
        return html
    player = shared(read(ROOT, 'src', 'player.src.html'))
    player = player.replace('/*__PEERJS__*/', peerjs, 1).replace('/*__QRCODE__*/', qrlib, 1)
    phone = shared(read(ROOT, 'src', 'join.src.html')).replace('/*__PEERJS__*/', peerjs, 1)
    editor = shared(read(ROOT, 'src', 'editor.src.html'))
    study = shared(read(ROOT, 'src', 'study.src.html'))
    pages = (('index.html', player), (os.path.join('join', 'index.html'), phone), ('editor.html', editor), (os.path.join('study', 'index.html'), study), ('presenter.html', FORWARD))
    for folder in ('join', 'study'):
        os.makedirs(os.path.join(ROOT, folder), exist_ok=True)
    for name, html in pages:
        if '/*__' in html:
            sys.exit(f'{name}: a placeholder was not replaced')
        # The pages are public: refuse to publish anything that looks like pack data.
        if re.search(r'"(explain|objective|answer)"\s*:', html):
            sys.exit(f'{name}: looks like it contains quiz data — pages must stay content-free')
        # Syntax-check every inline script.
        for k, script in enumerate(re.findall(r'<script>(.*?)</script>', html, flags=re.S)):
            tmp = os.path.join(ROOT, f'.check_{k}.js')
            with open(tmp, 'w', encoding='utf-8') as f:
                f.write(script)
            r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
            os.remove(tmp)
            if r.returncode:
                sys.exit(f'{name}: script {k} has a syntax error:\n{r.stderr}')
        with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as f:
            f.write(html)
    print('Built', {n: os.path.getsize(os.path.join(ROOT, n)) for n, _ in pages}, '· course sets:', sets_index())


if __name__ == '__main__':
    main()
