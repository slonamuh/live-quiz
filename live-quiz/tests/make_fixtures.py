"""Generate the test fixtures in tests/fixtures/ (placeholder content only — no real exam questions).

    python3 tests/make_fixtures.py      # needs: pip install pillow
"""
import json
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
from make_pack import make_pack, write_pack  # noqa: E402

FIX = os.path.join(HERE, 'fixtures')
os.makedirs(FIX, exist_ok=True)
random.seed(7)

# 1) A 25-question placeholder quiz with a balanced key (5 per letter).
KEY = 'BDAECDBEACEACBDADECBECADB'
qs = []
for i, a in enumerate(KEY, 1):
    qs.append({
        'stem': f'Placeholder case {i}. A patient presents with findings used only to test the quiz player.\n'
                f'• Test value one: normal\n• Test value two: abnormal',
        'lead': f'Which option is correct for placeholder question {i}?',
        'options': [f'Option {l} for question {i}' for l in 'ABCDE'],
        'answer': a,
        'explain': f'Option {a} is correct for placeholder question {i}.',
        'why': {l: f'Option {l} is a placeholder distractor.' for l in 'ABCDE' if l != a},
        'objective': 'Placeholder take-home point.',
    })
write_pack(make_pack('sample-25', 'Sample quiz (25 questions)', qs, created='2026-10-30'),
           os.path.join(FIX, 'sample-25.quiz.json'))

# 2) A pack with pictures, six options and a question without explanation.
tmp = os.path.join(HERE, 'output'); os.makedirs(tmp, exist_ok=True)
im = Image.new('RGB', (1800, 1200), (238, 205, 222)); dr = ImageDraw.Draw(im)
for _ in range(2600):
    x, y, r = random.randint(0, 1800), random.randint(0, 1200), random.randint(6, 22)
    dr.ellipse([x - r, y - r, x + r, y + r], fill=(random.randint(80, 150), random.randint(40, 90), random.randint(120, 190)))
im.filter(ImageFilter.GaussianBlur(1.2)).save(os.path.join(tmp, 'histo.png'))
ch = Image.new('RGB', (900, 500), 'white'); d2 = ImageDraw.Draw(ch)
d2.line([(60, 440), (860, 440)], fill='black', width=3); d2.line([(60, 440), (60, 40)], fill='black', width=3)
d2.line([(80, 430), (200, 120), (320, 430)], fill=(35, 80, 184), width=5)
d2.line([(80, 430), (260, 430), (380, 430)], fill=(185, 58, 39), width=5)
ch.save(os.path.join(tmp, 'chart.png'))
o5 = ['Alpha option', 'Beta option', 'Gamma option', 'Delta option', 'Epsilon option']
pic_qs = [
    dict(stem='Test case one with a picture under it.', lead='Which option is correct?', options=o5, answer='C',
         explain='Gamma is correct in this test.', why={'A': 'a', 'B': 'b', 'D': 'd', 'E': 'e'},
         objective='Pictures reach phones.', image='histo', imageCaption='Test histology image'),
    dict(stem='Test case two has six options.', lead='Pick F.', options=o5 + ['Zeta option'], answer='F',
         explain='Zeta is the sixth option.', why={'A': 'a', 'B': 'b', 'C': 'c', 'D': 'd', 'E': 'e'},
         objective='Six options work.', explainImage='chart', explainCaption='Explanation chart'),
    dict(stem='Test case three has four options and no explanation.', lead='Pick B.', options=o5[:4], answer='B'),
]
write_pack(make_pack('pictures', 'Test pack with pictures', pic_qs, created='2026-10-30',
                     images={'histo': os.path.join(tmp, 'histo.png'), 'chart': os.path.join(tmp, 'chart.png')}),
           os.path.join(FIX, 'pictures.quiz.json'))

# 3) Files the player must reject with a clear message.
with open(os.path.join(FIX, 'broken.quiz.json'), 'w') as f:
    json.dump({'title': 'Broken', 'questions': [{'stem': 'x', 'lead': 'y', 'options': ['only one'], 'answer': 'A'}]}, f)
with open(os.path.join(FIX, 'not-json.quiz.json'), 'w') as f:
    f.write('this is not a quiz pack')
print('fixtures:', sorted(os.listdir(FIX)))
