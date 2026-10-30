"""Subsample selected observations per species and write uuids.txt for the photos filter."""
import sys, json, random, collections
work = sys.argv[1]
cap = int(sys.argv[2]) if len(sys.argv) > 2 else 4000
tmap = json.load(open(f'{work}/taxon_map.json'))
by = collections.defaultdict(list)
n = 0
with open(f'{work}/obs_sel.tsv') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) < 7: continue
        slug = tmap.get(p[5])
        if not slug: continue
        by[slug].append(p[0]); n += 1
rnd = random.Random(20261030)
out = open(f'{work}/uuids.txt', 'w')
tot = 0
for slug, us in sorted(by.items()):
    if len(us) > cap:
        us = rnd.sample(us, cap)
    for u in us: out.write(u + '\n')
    tot += len(us)
    print(slug, len(by[slug]), '->', len(us), file=sys.stderr)
print('total obs', n, 'kept', tot, file=sys.stderr)
