"""Build the two published pages from src/ into the repository root.

    npm install              # once: fetches PeerJS and the QR library into node_modules/
    python3 tools/build_pages.py

Writes index.html (phone page) and presenter.html (player). Both are fully
self-contained: the libraries are inlined, so the pages work without any CDN.
Neither page may contain quiz content; the build fails if it finds pack data.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = os.path.join(ROOT, 'node_modules')


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

    pres = read(ROOT, 'src', 'presenter.src.html')
    pres = pres.replace('/*__PEERJS__*/', peerjs, 1).replace('/*__QRCODE__*/', qrlib, 1)
    phone = read(ROOT, 'src', 'index.src.html').replace('/*__PEERJS__*/', peerjs, 1)
    for name, html in (('presenter.html', pres), ('index.html', phone)):
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
    print('Built', {n: os.path.getsize(os.path.join(ROOT, n)) for n in ('presenter.html', 'index.html')})


if __name__ == '__main__':
    main()
