# Photo pipeline

The game ships with its photos in `public/photos/` and the attribution manifest in
`src/data/photos.json`. Everything here is for regenerating or extending that set.

## Where the photos come from

Research-grade iNaturalist observations whose photographers chose a CC0, CC BY or
CC BY-SA licence. Only those three licences are accepted, so the photos can be
redistributed (resized copies count as redistribution) with attribution, which the
app shows on every answer and on the credits page. CC BY-NC and ND photos are
deliberately excluded so the game is not tied to non-commercial use.

Each manifest entry records the photo id, the observation uuid, the licence and the
name to credit. The photo files are named after the iNaturalist photo id, so a photo
can always be traced back to `https://www.inaturalist.org/photos/<id>`.

## Species list

`species-inat.json` maps each species id used by the game (see `src/data/species.ts`)
to the scientific names iNaturalist might file it under (current name plus older
synonyms). `opendata/extra-taxon-ids.json` adds taxon ids that only exist in newer
taxonomy (for example Collybia nuda, the current name for the Wood Blewit).

## Route A: iNaturalist API (simplest)

```bash
node scripts/fetch-candidates-api.mjs work/candidates.json 40
```

This resolves each name to a taxon, pulls the most-faved research-grade observations
with an acceptable photo licence, and writes `work/candidates.json`. It sleeps a second
between calls to respect the API's rate limit. (It was written alongside route B but
could not be run in the sandbox the bundled photos came from, where the API host was
blocked.)

## Route B: iNaturalist open-data dump (no API needed)

The AWS Open Data bucket `inaturalist-open-data` holds every CC-licensed photo plus a
monthly metadata dump (`observations.csv`, `observers.csv`, `photos.csv`, `taxa.csv`
in one ~37 GB tar.gz). `opendata/run.sh` streams the archive once through `tar`
and keeps only rows for the species in the list.

1. Get a `taxa.csv` to resolve names to ids. The dump's own taxa.csv is at the end of
   the archive, so either stream an older, smaller dump first (the April 2021 one is
   4.8 GB) or take the ids from the iNaturalist website.
2. `python3 -I scripts/opendata/resolve_taxa.py taxa.csv scripts/species-inat.json scripts/opendata/extra-taxon-ids.json work`
   writes `work/taxon_map.json`, `work/taxon_ids.txt` and `work/newmin.txt` (max taxon id
   in that taxa.csv + 1; research-grade observations of taxa created later are kept
   separately in `obs_new.tsv` as a safety net for species renamed since the taxa.csv).
3. `scripts/opendata/run.sh work` (30 to 40 minutes at 25 MB/s).
4. `python3 -I scripts/opendata/build_candidates.py work 48` joins the tables and writes
   `work/candidates.json` (CC0 / CC BY / CC BY-SA only, first photo of each observation
   preferred, at most three photos per photographer per species).

## Curating and finalising (both routes)

```bash
scripts/opendata/fetch_thumbs.sh work                      # 500px previews
python3 -I scripts/opendata/contact_sheets.py work work/sheets   # numbered contact sheets per species
# look at the sheets, then write work/selection.json: {"amanita-phalloides": [3, 7, 12], ...}
python3 -I scripts/finalize-photos.py work work/selection.json .   # downloads, resizes to 1000px, writes the manifest
```

Photos are stored at 1000px on the long side, JPEG quality 82. If the repository
gets too heavy, move `public/photos/` to a bucket or CDN and set `VITE_PHOTO_BASE`
to its URL (with a trailing slash) at build time; nothing else changes.
