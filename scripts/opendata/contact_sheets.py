"""Build numbered contact sheets per species from thumbs/. Args: WORK, OUTDIR, [slugs...]"""
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
work, outdir = sys.argv[1], sys.argv[2]
slugs = sys.argv[3:]
c = json.load(open(f'{work}/candidates.json'))
os.makedirs(outdir, exist_ok=True)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except Exception:
    font = ImageFont.load_default()
CELL_W, CELL_H, COLS = 300, 225, 6
for slug in (slugs or sorted(c)):
    lst = c[slug]
    rows = (len(lst) + COLS - 1) // COLS
    if rows == 0: continue
    sheet = Image.new('RGB', (COLS * CELL_W, rows * CELL_H), (20, 20, 20))
    d = ImageDraw.Draw(sheet)
    for i, x in enumerate(lst):
        p = f"{work}/thumbs/{slug}_{x['photo_id']}.{x['ext']}"
        cx, cy = (i % COLS) * CELL_W, (i // COLS) * CELL_H
        try:
            im = Image.open(p).convert('RGB')
            im.thumbnail((CELL_W - 4, CELL_H - 4))
            sheet.paste(im, (cx + 2 + (CELL_W - 4 - im.width) // 2, cy + 2 + (CELL_H - 4 - im.height) // 2))
        except Exception as e:
            d.text((cx + 10, cy + 100), 'missing', fill=(255, 80, 80), font=font)
        d.rectangle([cx + 4, cy + 4, cx + 44, cy + 32], fill=(0, 0, 0))
        d.text((cx + 8, cy + 4), str(i), fill=(255, 255, 0), font=font)
    sheet.save(f'{outdir}/{slug}.jpg', quality=82)
    print(slug, len(lst), 'candidates ->', f'{outdir}/{slug}.jpg')
