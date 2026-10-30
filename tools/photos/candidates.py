#!/usr/bin/env python3
"""Pick candidate photos for each species from the iNaturalist Open Dataset and build
numbered contact sheets for picking the best ones by eye.

Usage: python3 tools/photos/candidates.py WORK_DIR [species ...]

WORK_DIR must contain the files produced by extract.sh:
  fungi_obs.tsv     observation_uuid, observer_id, latitude, longitude, taxon_id, observed_on
  fungi_photos.tsv  photo_id, observation_uuid, observer_id, extension, license, width, height, position
  taxa.csv.gz, observers.csv.gz   (copied from the dataset)

Writes WORK_DIR/candidates.json and WORK_DIR/sheets/<species>.jpg.
"""
import csv
import gzip
import json
import random
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import s3

ALLOWED_LICENSES = {"CC0", "CC-BY", "CC-BY-SA"}
PER_SPECIES = 20
TILE = 200
COLS = 5
HERE = Path(__file__).resolve().parent


def load_taxon_names(work, wanted):
    names = {}
    with gzip.open(work / "taxa.csv.gz", "rt", newline="", encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if row[0].isdigit() and int(row[0]) in wanted:
                names[int(row[0])] = row[4]
    return names


def load_observer_names(work, wanted):
    names = {}
    with gzip.open(work / "observers.csv.gz", "rt", newline="", encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if row[0].isdigit() and int(row[0]) in wanted:
                login, name = row[1], (row[2] if len(row) > 2 else "")
                names[int(row[0])] = name.strip() or login
    return names


def collect(work, taxa_map):
    taxon_to_species = {t: s for s, ts in taxa_map.items() for t in ts}
    taxon_names = load_taxon_names(work, set(taxon_to_species))

    obs = {}
    with open(work / "fungi_obs.tsv", encoding="utf-8") as f:
        for line in f:
            uuid, _observer, _lat, _lon, taxon, date = line.rstrip("\n").split("\t")
            if taxon.isdigit() and int(taxon) in taxon_to_species:
                obs[uuid] = (int(taxon), date)

    found = defaultdict(list)
    with open(work / "fungi_photos.tsv", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) != 8:
                continue
            pid, uuid, observer, ext, lic, w, h, pos = parts
            # Only the observation's first photo: observers usually lead with their best shot.
            if lic not in ALLOWED_LICENSES or pos != "0" or uuid not in obs:
                continue
            w, h = int(w or 0), int(h or 0)
            if min(w, h) < 700 or max(w, h) / max(1, min(w, h)) > 1.8:
                continue
            taxon, date = obs[uuid]
            found[taxon_to_species[taxon]].append(
                {"id": int(pid), "ext": ext, "license": lic, "observer": int(observer),
                 "taxon": taxon_names.get(taxon, str(taxon)), "obs": uuid, "w": w, "h": h, "date": date}
            )
    return found


def choose(photos, n, rng):
    recent = [p for p in photos if p["date"] >= "2014"]
    pool = recent if len(recent) >= n else photos
    rng.shuffle(pool)
    picked, observers = [], set()
    for p in pool:  # one photo per observer, for variety
        if p["observer"] not in observers:
            picked.append(p)
            observers.add(p["observer"])
        if len(picked) == n:
            break
    return picked


def contact_sheet(species, photos, thumbs_dir, out_path):
    rows = (len(photos) + COLS - 1) // COLS
    sheet = Image.new("RGB", (COLS * TILE, rows * TILE), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=22)
    except TypeError:  # Pillow < 10.1
        font = ImageFont.load_default()
    for i, p in enumerate(photos):
        x, y = (i % COLS) * TILE, (i // COLS) * TILE
        try:
            im = Image.open(thumbs_dir / f"{p['id']}.jpg").convert("RGB")
            im.thumbnail((TILE - 4, TILE - 4))
            sheet.paste(im, (x + (TILE - im.width) // 2, y + (TILE - im.height) // 2))
        except OSError:
            draw.text((x + 60, y + 90), "missing", fill="red", font=font)
        draw.rectangle([x + 2, y + 2, x + 34, y + 28], fill="black")
        draw.text((x + 6, y + 3), str(i + 1), fill="yellow", font=font)
    sheet.save(out_path, quality=82)


def main():
    work = Path(sys.argv[1])
    only = set(sys.argv[2:])
    taxa_map = json.loads((HERE / "taxa.json").read_text(encoding="utf-8"))
    if only:
        taxa_map = {k: v for k, v in taxa_map.items() if k in only}

    found = collect(work, taxa_map)
    rng = random.Random(20261030)
    candidates = {s: choose(found.get(s, []), PER_SPECIES, rng) for s in taxa_map}
    names = load_observer_names(work, {p["observer"] for ps in candidates.values() for p in ps})
    for ps in candidates.values():
        for p in ps:
            p["by"] = names.get(p["observer"], f"iNaturalist user {p['observer']}")

    out = work / "candidates.json"
    existing = json.loads(out.read_text(encoding="utf-8")) if out.exists() and only else {}
    existing.update(candidates)
    out.write_text(json.dumps(existing, indent=1), encoding="utf-8")

    thumbs = work / "thumbs"
    sheets = work / "sheets"
    thumbs.mkdir(exist_ok=True)
    sheets.mkdir(exist_ok=True)
    jobs = [p for ps in candidates.values() for p in ps if not (thumbs / f"{p['id']}.jpg").exists()]
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(lambda p: s3.download(p["id"], p["ext"], "small", thumbs / f"{p['id']}.jpg"), jobs))
    for s, ps in candidates.items():
        print(f"{s:26s} {len(found.get(s, [])):5d} usable, {len(ps):2d} candidates")
        if ps:
            contact_sheet(s, ps, thumbs, sheets / f"{s}.jpg")


if __name__ == "__main__":
    main()
