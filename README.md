# Mushroom Lookalikes

Daily mushroom identification training. Twenty pairs of look-alike mushrooms a day:
one of each pair is named, you tap the photo that shows it (or admit you don't know),
and every answer comes with a field tip on how to tell the two apart. At the end you
get a score, a mushroom-themed rank and a Wordle-style share grid.

Everyone gets the same puzzle on the same day (local time), so scores are comparable.
There is also an unlimited practice mode with random pairs.

**This is a game, not a field guide.** Never eat a wild mushroom on the strength of an
app, a photo, or a single feature.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve the build locally
```

No backend. Progress and streaks live in the browser's localStorage. The build uses a
relative base path, so `dist/` can be dropped onto any static host or opened from a
subfolder. A GitHub Pages workflow (`.github/workflows/deploy.yml`) deploys on pushes
to `main`; enable Pages with the "GitHub Actions" source once that is wanted.

## How the game works

- **Species and pairs** live in `src/data/species.ts` and `src/data/pairs.ts`. Each
  species has an edibility class (deadly, poisonous, inedible, edible with caution,
  edible, choice), a note, key field marks and a region. Each pair has a field tip and
  a difficulty.
- **Daily puzzle**: the day number (puzzle #1 = 30 Oct 2026) seeds a small PRNG
  (`src/game/rng.ts`) that picks 20 pairs without repeating a species where possible,
  decides which species to ask for, which photo of each to show, and the left/right
  layout (`src/game/generate.ts`). Adding pairs or photos changes future puzzles, so
  do that deliberately.
- **Scoring**: one point per correct answer. "I don't know" scores nothing but never
  counts as a dangerous mistake. Wrong answers on pairs containing a deadly species are
  reported separately (and show as ☠️ in the share grid), because that is the mistake
  that matters in the field (`src/game/score.ts`).
- **Ranks**: Spore, Lost in the Woods, Toadstool Tourist, Curious Beginner, Weekend
  Forager, Seasoned Forager, Master Forager and Mycologist (20/20).

## Photos and licensing

All photos are from research-grade iNaturalist observations and are used under the
licence their photographer chose: CC0, CC BY 4.0 or CC BY-SA 4.0 only. No NC or ND
photos are included, so the set can be reused commercially as long as attribution is
kept. Each photo is credited in the app (under the photo once revealed, and on the
Photo credits page) with the photographer, the licence and a link to the observation.
`src/data/photos.json` is the manifest: photo id, observation uuid, licence, credit
name and dimensions for every file in `public/photos/`.

Photos are resized to 1000 px on the long side. If the repository gets too heavy, move
`public/photos/` to a bucket or CDN and set `VITE_PHOTO_BASE=https://.../photos/` at
build time.

See `scripts/README.md` for how the photo set was built and how to extend it.

## Accuracy

Species notes and tips were written from standard references (regional field guides,
the Wikipedia species accounts, mycological society material) and cross-checked where
claims were uncertain. iNaturalist research grade means the community agreed on the
identification; it is not infallible. If a photo looks wrong, the credits page links to
the observation so it can be checked and swapped.
