# Mushroom ID

A daily mushroom-identification training game. Each day brings 20 pairs of lookalike mushrooms (chanterelle vs jack-o'-lantern, death cap vs green brittlegill, morel vs false morel, and so on). Two photos appear side by side: pick the one that matches the name, or admit you don't know.

- **Same 20 pairs for everyone each day**, like Wordle. The round is generated from a seed based on the local date.
- **Scoring:** +1 right, 0 don't know, −1 wrong. A wrong ID in the field costs more than admitting you're unsure.
- After each answer you see both species, their edibility, and how to tell them apart, with sources.
- At the end you get a score, a mushroom rank (from ☠️ Toadstool up to 🏆 Golden Chanterelle), a shareable emoji grid (💀 marks mix-ups involving a deadly species) and a full review.
- Stats and streaks are kept in the browser's local storage. There's also an unlimited practice mode.

> **For training only.** Never eat a wild mushroom based on a photo, an app or this game.

## Running it

It's a static site with no build step and no dependencies. Serve the repository root with any static file server:

```bash
npm start            # python3 -m http.server 8000
```

then open <http://localhost:8000>. (Opening `index.html` directly from disk won't work because browsers block ES modules on `file://`.)

Run the tests (Node 20+):

```bash
npm test
```

### Hosting on GitHub Pages

In the repository settings, open **Pages**, choose **Deploy from a branch**, and select `main` with the `/ (root)` folder. The site will be published at `https://<owner>.github.io/mushroom-id/`.

## How it's organised

| Path | What |
| --- | --- |
| `index.html`, `css/`, `js/app.js` | The game UI |
| `js/game.js` | Pure game logic: date seeding, round generation, scoring, ranks, share text (unit-tested) |
| `data/species.js` | Species: names, edibility and short notes |
| `data/pairs.js` | Lookalike pairs with "how to tell them apart" tips and sources |
| `data/photos.js` | Photo attribution data (generated) |
| `img/` | Resized photos (WebP, named by iNaturalist photo ID) |
| `credits.html` | Attribution for every photo |
| `tools/photos/` | Scripts used to find, curate and process the photos |

## Content

The game covers 37 well-documented lookalike pairs across 60 species, from classic forager confusions (chanterelle vs jack-o'-lantern, morel vs false morel, death cap vs green brittlegill or paddy straw mushroom, velvet shank vs deadly galerina) to regional ones (matsutake vs Smith's amanita in the Pacific Northwest, oyster vs ghost fungus in Australia).

Every "how to tell them apart" tip and edibility label was checked against field guides and toxicology sources (mainly MushroomExpert.com, First Nature, Wild Food UK, NAMA and university extension pages), then independently re-checked by a second reviewer looking for errors and features that don't actually separate the two species. Sources are linked under each tip in the game. Tips are deliberately short and are not a substitute for a field guide or an expert.

## Photos and licensing

All photos are research-grade iNaturalist observations taken from the [iNaturalist Open Dataset](https://github.com/inaturalist/inaturalist-open-data) on AWS. Only photos licensed **CC0**, **CC BY** or **CC BY-SA** are used (no non-commercial or no-derivatives licenses), so the game can be used and shared freely as long as attribution is kept. Each photo is credited in the game after you answer, and all of them are listed on the credits page with links to the original. Photos have been resized and re-encoded but are otherwise unaltered.

To rebuild or extend the photo set:

1. `tools/photos/extract.sh WORK_DIR` streams the dataset's metadata (~35 GB compressed, nothing large is stored) and keeps research-grade fungi observations and their photos.
2. Add species to `tools/photos/taxa.json` (species key → iNaturalist taxon IDs), then run `python3 tools/photos/candidates.py WORK_DIR [species…]` to pick 20 openly licensed candidates per species and build numbered contact sheets in `WORK_DIR/sheets/`.
3. Choose the best photos by eye (clear, correctly identified, showing useful features) and add them to `tools/photos/selection.json`.
4. `python3 tools/photos/build.py` downloads the chosen photos, writes `img/*.webp` and regenerates `data/photos.js`.

The Python scripts need Python 3.9+ and Pillow.
