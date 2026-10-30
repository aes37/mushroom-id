#!/usr/bin/env python3
"""Build the game's photo set from iNaturalist open data.

Photos come from the iNaturalist Open Data bucket on AWS
(https://github.com/inaturalist/inaturalist-open-data), which holds every
openly licensed iNaturalist photo plus tab-separated metadata. We only use:

  * research-grade observations (community-agreed identification),
  * photos the photographer licensed CC0, CC BY or CC BY-SA, so the game can be
    shared or reused, including commercially, with attribution,
  * the observation's first photo, at least 800 px on its short side, and at most
    one photo per photographer per species.

Steps:

1. Filter the big metadata files (tens of GB, streamed; see README):
     metadata/fungi_rg_obs.tsv     rows of observations.csv for research-grade fungi
     metadata/fungi_rg_photos.tsv  rows of photos.csv for those observations
     metadata/observers.csv.gz, metadata/taxa.csv.gz  (small, downloaded as-is)
2. `photos.py candidates --meta DIR --out DIR` writes a numbered contact sheet of
   candidate photos per species for a human to review.
3. Put the chosen photo ids in data/photo-picks.json.
4. `photos.py build --meta DIR` downloads the picks, resizes them to WebP in
   photos/ and writes data/photos.json with attribution for each photo.

Species and their iNaturalist taxon ids live in data/content.json ("inat");
descendant taxa (subspecies, varieties) are included automatically, minus any
listed in "inatExclude" (e.g. half-free morels, which look like Verpa).
"""
import argparse
import concurrent.futures as cf
import csv
import gzip
import http.client
import io
import json
import random
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / 'data' / 'content.json'
PICKS = ROOT / 'data' / 'photo-picks.json'
MANIFEST = ROOT / 'data' / 'photos.json'
PHOTO_DIR = ROOT / 'photos'
BUCKET = 'https://inaturalist-open-data.s3.amazonaws.com/photos'
OPEN_LICENSES = {'CC0', 'CC-BY', 'CC-BY-SA'}
MIN_SHORT_SIDE = 800
MAX_EDGE = 800
WEBP_QUALITY = 72
USER_AGENT = 'mushroom-id-photo-builder/1.0 (educational game)'

csv.field_size_limit(sys.maxsize)


def load_content():
    return json.loads(CONTENT.read_text())


FUNGI = 47170


def load_taxa(meta):
    """Returns {taxon_id: (name, ancestry_ids)} for every fungal taxon."""
    taxa = {}
    with gzip.open(meta / 'taxa.csv.gz', 'rt', newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        next(reader)
        for tid, ancestry, _rank_level, _rank, name, _active in reader:
            anc = {int(a) for a in ancestry.split('/') if a}
            if FUNGI in anc or int(tid) == FUNGI:
                taxa[int(tid)] = (name, anc)
    return taxa


def species_taxa(content, taxa):
    """Maps each game species to the set of iNat taxon ids (with descendants) it covers."""
    out = {}
    for sid, sp in content['species'].items():
        roots = set(sp['inat'])
        skip = set(sp.get('inatExclude', []))
        out[sid] = {
            tid for tid, (_, anc) in taxa.items()
            if (tid in roots or anc & roots) and not (tid in skip or anc & skip)
        }
    return out


def load_observers(meta):
    observers = {}
    with gzip.open(meta / 'observers.csv.gz', 'rt', newline='') as f:
        reader = csv.reader(f, delimiter='\t')
        next(reader)
        for row in reader:
            if len(row) >= 3:
                observers[row[0]] = (row[1], row[2])
    return observers


def candidates_by_species(meta, content, taxa):
    """All usable photos per species, one per photographer, in a stable order."""
    covered = species_taxa(content, taxa)
    taxon_to_species = {}
    for sid, tids in covered.items():
        for tid in tids:
            taxon_to_species.setdefault(tid, []).append(sid)

    obs = {}
    with open(meta / 'fungi_rg_obs.tsv', newline='') as f:
        for row in csv.reader(f, delimiter='\t'):
            if len(row) < 8 or not row[5].isdigit():
                continue
            tid = int(row[5])
            if tid in taxon_to_species and row[6] == 'research':
                obs[row[0]] = (tid, row[1])

    observers = load_observers(meta)
    found = {sid: {} for sid in content['species']}
    with open(meta / 'fungi_rg_photos.tsv', newline='') as f:
        for row in csv.reader(f, delimiter='\t'):
            if len(row) < 9:
                continue
            _puuid, pid, ouuid, observer_id, ext, lic, width, height, position = row[:9]
            if ouuid not in obs or lic not in OPEN_LICENSES or position != '0':
                continue
            if min(int(width or 0), int(height or 0)) < MIN_SHORT_SIDE:
                continue
            tid, _ = obs[ouuid]
            login, name = observers.get(observer_id, ('', ''))
            photo = {
                'id': int(pid), 'ext': ext, 'license': lic, 'taxon': taxa[tid][0],
                'author': name.strip() or login, 'login': login,
                'width': int(width), 'height': int(height),
            }
            for sid in taxon_to_species[tid]:
                # Keep one photo per photographer per species (the lowest id, for stability).
                prev = found[sid].get(observer_id)
                if prev is None or photo['id'] < prev['id']:
                    found[sid][observer_id] = photo
    return {sid: sorted(by_obs.values(), key=lambda p: p['id']) for sid, by_obs in found.items()}


def fetch(url, attempts=5):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return res.read()
        except (OSError, http.client.HTTPException):
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)


def photo_url(photo, size):
    return f"{BUCKET}/{photo['id']}/{size}.{photo['ext']}"


def cmd_candidates(args):
    content = load_content()
    taxa = load_taxa(args.meta)
    cands = candidates_by_species(args.meta, content, taxa)
    out = Path(args.out)
    (out / 'cache').mkdir(parents=True, exist_ok=True)
    summary = {}
    for sid, photos in cands.items():
        rng = random.Random(f'{sid}:{args.seed}')
        sample = photos if len(photos) <= args.per_species else rng.sample(photos, args.per_species)
        summary[sid] = {'available': len(photos), 'sample': sample}
        print(f'{sid:32s} {len(photos):6d} usable photos', flush=True)
    (out / 'candidates.json').write_text(json.dumps(summary, indent=1))

    def get(photo):
        path = out / 'cache' / f"{photo['id']}.jpg"
        if not path.exists():
            path.write_bytes(fetch(photo_url(photo, 'medium')))
        return path

    with cf.ThreadPoolExecutor(8) as pool:
        for sid, info in summary.items():
            paths = list(pool.map(get, info['sample']))
            if paths:
                contact_sheet(paths, out / f'{sid}.jpg', cols=args.cols)


def contact_sheet(paths, dest, cols=5, tile=260):
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tile, rows * tile), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(paths):
        img = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        img.thumbnail((tile - 6, tile - 6))
        x, y = (i % cols) * tile, (i // cols) * tile
        sheet.paste(img, (x + (tile - img.width) // 2, y + (tile - img.height) // 2))
        draw.rectangle([x + 2, y + 2, x + 30, y + 22], fill='black')
        draw.text((x + 6, y + 6), str(i), fill='yellow')
    sheet.save(dest, quality=82)


def cmd_build(args):
    content = load_content()
    picks = json.loads(PICKS.read_text())
    taxa = load_taxa(args.meta)
    cands = candidates_by_species(args.meta, content, taxa)
    PHOTO_DIR.mkdir(exist_ok=True)

    jobs = []
    for sid in content['species']:
        by_id = {p['id']: p for p in cands.get(sid, [])}
        for pid in picks.get(sid, []):
            if pid not in by_id:
                sys.exit(f'{sid}: photo {pid} is not an eligible open-licensed research-grade photo')
            jobs.append((sid, by_id[pid]))

    def build_one(job):
        sid, photo = job
        dest = PHOTO_DIR / f"{photo['id']}.webp"
        if not dest.exists():
            img = Image.open(io.BytesIO(fetch(photo_url(photo, 'large'))))
            img = ImageOps.exif_transpose(img).convert('RGB')
            img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            img.save(dest, 'WEBP', quality=WEBP_QUALITY, method=6)
        with Image.open(dest) as img:
            w, h = img.size
        return sid, {
            'id': str(photo['id']),
            'file': f"photos/{photo['id']}.webp",
            'w': w,
            'h': h,
            'author': photo['author'],
            'license': photo['license'],
            'source': f"https://www.inaturalist.org/photos/{photo['id']}",
            'taxon': photo['taxon'],
        }

    manifest = {sid: [] for sid in content['species'] if picks.get(sid)}
    with cf.ThreadPoolExecutor(8) as pool:
        for sid, entry in pool.map(build_one, jobs):
            manifest[sid].append(entry)

    keep = {f"{e['id']}.webp" for entries in manifest.values() for e in entries}
    for stale in PHOTO_DIR.glob('*.webp'):
        if stale.name not in keep:
            stale.unlink()
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
    total = sum(len(v) for v in manifest.values())
    size = sum(p.stat().st_size for p in PHOTO_DIR.glob('*.webp'))
    print(f'{total} photos, {size / 1e6:.1f} MB')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('candidates', help='write contact sheets of candidate photos')
    c.add_argument('--meta', type=Path, required=True)
    c.add_argument('--out', required=True)
    c.add_argument('--per-species', type=int, default=20)
    c.add_argument('--cols', type=int, default=5)
    c.add_argument('--seed', default='1')
    c.set_defaults(func=cmd_candidates)
    b = sub.add_parser('build', help='download picked photos and write data/photos.json')
    b.add_argument('--meta', type=Path, required=True)
    b.set_defaults(func=cmd_build)
    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
