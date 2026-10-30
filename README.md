# Mushroom ID

A daily mushroom identification training game. Each day you get 20 pairs of documented
lookalike mushrooms (chanterelle vs jack-o'-lantern, meadow mushroom vs destroying angel, and so on).
For each pair you're asked "which one is X?" and pick the left or right photo, or "Don't know".

* **Scoring:** +1 for a correct pick, −1 for a wrong one, 0 for "Don't know". When in doubt, throw it out.
* **Daily set:** the 20 questions are seeded from the date, so everyone gets the same set on the same
  (local) day, like Wordle. Progress, streaks and stats are kept in `localStorage`.
* **Ranks:** from 🛒 *Supermarket Forager* (0 or less) up to 🔮 *Mycological Oracle* (a perfect 20).
  A 💀 marks any mix-up between a deadly species and its lookalike.
* **Learning:** after each answer you see both names, their edibility and how to tell them apart.
  There's also a practice mode (random sets, no stats) and a field guide of every pair with sources.

> **Safety:** this is a game, not an identification guide. Never eat a wild mushroom based on photos
> or an app.

## Running it

It's a static site with no build step and no dependencies. Serve the folder over HTTP (opening
`index.html` from disk won't work, because browsers block `fetch` and ES modules on `file://`):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To publish, upload the folder to any static host (GitHub Pages,
Netlify, Cloudflare Pages, S3...). For GitHub Pages, point Pages at the branch's root folder.

Run the tests (Node 18+):

```bash
npm test
```

## Project layout

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/app.js` | The UI (vanilla JS modules) |
| `js/game.js`, `js/rng.js` | Pure game logic: seeded daily quiz, scoring, ranks, stats, share text |
| `data/content.json` | Hand-curated species, lookalike pairs, identification tips and sources |
| `data/photo-picks.json` | The iNaturalist photo ids chosen for each species (reviewed by eye) |
| `data/photos.json` | Generated: photo files plus attribution for each |
| `photos/` | Generated: resized WebP photos (max 900 px) |
| `scripts/photos.py` | Builds `photos/` and `data/photos.json` from iNaturalist open data |
| `tests/` | `node --test` unit tests |

Edit `data/content.json` to change tips or add pairs. Each species lists the iNaturalist taxon ids
(`inat`) that its photos may come from. Changing the pairs or photos changes future daily puzzles,
and saved games that reference a removed photo are discarded.

## Photos and licensing

All photos come from **research-grade iNaturalist observations** whose photographers chose a
**CC0, CC BY or CC BY-SA** licence. Non-commercial (NC) and all-rights-reserved photos were excluded,
so the game can be shared, hosted or even monetised as long as attribution is kept. Each photo's
author, licence and a link to its iNaturalist page are shown under the photo in the game and on the
in-app *Photo credits* page (`#/credits`). Photos were resized and converted to WebP; no other
changes were made. CC BY-SA photos remain under CC BY-SA.

The photos are stored in this repo (about 300 files at roughly 60 KB each). If the set grows a lot,
move `photos/` to a bucket or CDN and change the `file` paths in `data/photos.json`.

### Regenerating the photo set

The script reads the [iNaturalist Open Data](https://github.com/inaturalist/inaturalist-open-data)
metadata on AWS. The two big files are tens of GB, so filter them while streaming:

```bash
mkdir -p meta && cd meta
B=https://inaturalist-open-data.s3.amazonaws.com
curl -sO $B/taxa.csv.gz
curl -sO $B/observers.csv.gz
# ids of every fungal taxon (kingdom Fungi = 47170)
zcat taxa.csv.gz | awk -F'\t' 'NR>1 && ($1==47170 || $2 ~ /(^|\/)47170(\/|$)/) {print $1}' > fungi_ids.txt
# research-grade fungal observations
curl -s $B/observations.csv.gz | zcat \
  | awk -F'\t' 'NR==FNR{f[$1]=1;next} ($6 in f) && $7=="research"' fungi_ids.txt - > fungi_rg_obs.tsv
cut -f1 fungi_rg_obs.tsv > fungi_rg_obs_uuids.txt
# photos belonging to those observations
curl -s $B/photos.csv.gz | zcat \
  | awk -F'\t' 'NR==FNR{o[$1]=1;next} ($3 in o)' fungi_rg_obs_uuids.txt - > fungi_rg_photos.tsv
cd ..
```

Then:

```bash
pip install pillow
python3 scripts/photos.py candidates --meta meta --out review   # contact sheets per species
# edit data/photo-picks.json with the ids you want to keep
python3 scripts/photos.py build --meta meta                     # writes photos/ and data/photos.json
```

`build` refuses any photo that isn't an open-licensed, research-grade, primary observation photo.

## Sources

The lookalike pairs, edibility ratings and tips were researched from mycological societies (NAMA,
regional societies), university extension services, poison centres and health agencies, peer-reviewed
case reports, and specialist guides such as MushroomExpert.com and First Nature. Every pair lists its
sources in `data/content.json` and in the in-app field guide.
