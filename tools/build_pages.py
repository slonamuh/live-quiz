"""Build the published pages from src/ into the repository.

    npm install              # once: fetches PeerJS and the QR library into node_modules/
    python3 tools/build_pages.py

Writes
    index.html        the player (teacher's screen), so the site's own address opens it
    join/index.html   the phone page (…/join/), which the QR code and links open
    editor.html       the quiz editor
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

    player = read(ROOT, 'src', 'player.src.html')
    player = player.replace('/*__PEERJS__*/', peerjs, 1).replace('/*__QRCODE__*/', qrlib, 1)
    phone = read(ROOT, 'src', 'join.src.html').replace('/*__PEERJS__*/', peerjs, 1)
    editor = read(ROOT, 'src', 'editor.src.html')
    pages = (('index.html', player), (os.path.join('join', 'index.html'), phone), ('editor.html', editor), ('presenter.html', FORWARD))
    os.makedirs(os.path.join(ROOT, 'join'), exist_ok=True)
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
    print('Built', {n: os.path.getsize(os.path.join(ROOT, n)) for n, _ in pages})


if __name__ == '__main__':
    main()
