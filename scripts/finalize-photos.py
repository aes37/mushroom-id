"""Download chosen photos at 'large' size, resize to max 1000px, write to public/photos/<slug>/<photo_id>.jpg
and build src/data/photos.json. Args: WORK, selection.json ({slug: [candidate indexes]}), REPO"""
import json, sys, os, subprocess, io
from PIL import Image, ImageOps
work, sel_path, repo = sys.argv[1:4]
c = json.load(open(f'{work}/candidates.json'))
sel = json.load(open(sel_path))
LIC = {'CC0': 'cc0', 'CC-BY': 'cc-by', 'CC-BY-SA': 'cc-by-sa'}
manifest = {}
os.makedirs(f'{work}/large', exist_ok=True)
MAX = 1000
for slug, idxs in sel.items():
    out_dir = f'{repo}/public/photos/{slug}'
    os.makedirs(out_dir, exist_ok=True)
    manifest[slug] = []
    for i in idxs:
        x = c[slug][i]
        src = f"{work}/large/{x['photo_id']}.{x['ext']}"
        if not os.path.exists(src) or os.path.getsize(src) == 0:
            url = f"https://inaturalist-open-data.s3.amazonaws.com/photos/{x['photo_id']}/large.{x['ext']}"
            r = subprocess.run(['curl', '-sS', '-m', '120', '--retry', '3', '-o', src, url])
            if r.returncode != 0 or os.path.getsize(src) == 0:
                print('DOWNLOAD FAILED', slug, i, url, file=sys.stderr); continue
        im = Image.open(src)
        im = ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        fname = f"{x['photo_id']}.jpg"
        im.save(f'{out_dir}/{fname}', 'JPEG', quality=82, optimize=True, progressive=True)
        manifest[slug].append({
            'file': f'{slug}/{fname}', 'w': im.width, 'h': im.height, 'photoId': x['photo_id'], 'obs': x['obs'],
            'by': x['name'].strip() or x['login'], 'login': x['login'], 'license': LIC[x['license']],
            'observedOn': x['observed_on'] or None,
        })
        if manifest[slug][-1]['observedOn'] is None: del manifest[slug][-1]['observedOn']
    print(slug, len(manifest[slug]), 'photos', file=sys.stderr)
json.dump(manifest, open(f'{repo}/src/data/photos.json', 'w'), indent=1, ensure_ascii=False)
print('manifest written:', sum(len(v) for v in manifest.values()), 'photos')
