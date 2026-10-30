"""Resolve species ids -> iNat taxon ids from a taxa.csv dump (tab separated: taxon_id, ancestry, rank_level, rank, name, active).
Matches species-rank names and their infraspecific descendants only (no complexes, no sibling species).
Usage: resolve_taxa.py taxa.csv species-inat.json extra-taxon-ids.json WORK
Writes WORK/taxon_map.json, WORK/taxon_ids.txt and WORK/newmin.txt (max taxon id + 1)."""
import csv, json, sys, collections
taxa_csv, species_json, extra_json, work = sys.argv[1:5]
import os; os.makedirs(work, exist_ok=True)
names = json.load(open(species_json)); extra = json.load(open(extra_json))
want = {n: slug for slug, ns in names.items() for n in ns}
rows = []
maxid = 0
with open(taxa_csv, newline='') as f:
    r = csv.reader(f, delimiter='\t'); header = next(r); idx = {h: i for i, h in enumerate(header)}
    for row in r:
        maxid = max(maxid, int(row[idx['taxon_id']]))
        rows.append((int(row[idx['taxon_id']]), row[idx['ancestry']], float(row[idx['rank_level']] or 0), row[idx['rank']], row[idx['name']]))
tmap = {}
for tid, anc, lvl, rank, name in rows:
    if name in want and rank == 'species':
        tmap[tid] = want[name]
species_ids = set(tmap)
for tid, anc, lvl, rank, name in rows:
    if tid in species_ids or lvl >= 10: continue
    for p in reversed(anc.split('/')):
        if p and int(p) in species_ids:
            tmap[tid] = tmap[int(p)]; break
for slug, ids in extra.items():
    for i in ids: tmap[i] = slug
cnt = collections.Counter(tmap.values())
print({s: cnt.get(s, 0) for s in names})
json.dump({str(k): v for k, v in sorted(tmap.items())}, open(f'{work}/taxon_map.json', 'w'), indent=0)
open(f'{work}/taxon_ids.txt', 'w').write(''.join(f'{k}\n' for k in sorted(tmap)))
open(f'{work}/newmin.txt', 'w').write(str(maxid + 1))
