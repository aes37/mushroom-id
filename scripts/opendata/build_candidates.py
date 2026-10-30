"""Join filtered dump tables into per-species photo candidates.
Inputs in WORK: obs_sel.tsv, photos_sel.tsv, observers.csv, taxon_map.json.
Output: candidates.json  {slug: [ {photo_id, ext, license, w, h, obs, observer_id, login, name, observed_on, position, lat, lon} ]}
Only CC0 / CC-BY / CC-BY-SA photos are kept."""
import csv, json, sys, random, collections
work = sys.argv[1]
max_per = int(sys.argv[2]) if len(sys.argv) > 2 else 48
tmap = json.load(open(f'{work}/taxon_map.json'))
obs = {}
with open(f'{work}/obs_sel.tsv') as f:
    for line in f:
        p = line.rstrip('\n').split('\t')
        if len(p) < 8: continue
        slug = tmap.get(p[5])
        if slug: obs[p[0]] = (slug, p[1], p[7], p[2], p[3])  # slug, observer_id, observed_on, lat, lon
observers = {}
with open(f'{work}/observers.csv', newline='') as f:
    r = csv.reader(f, delimiter='\t'); next(r)
    for row in r:
        observers[row[0]] = (row[1], row[2] if len(row) > 2 else '')
OK = {'CC0', 'CC-BY', 'CC-BY-SA'}
cands = collections.defaultdict(list)
lic_count = collections.Counter()
with open(f'{work}/photos_sel.tsv', newline='') as f:
    r = csv.reader(f, delimiter='\t'); header = next(r); idx = {h: i for i, h in enumerate(header)}
    for row in r:
        lic = row[idx['license']]
        lic_count[lic] += 1
        if lic not in OK: continue
        o = obs.get(row[idx['observation_uuid']])
        if not o: continue
        slug, observer_id, observed_on, lat, lon = o
        login, name = observers.get(observer_id, (observer_id, ''))
        try:
            w = int(row[idx['width']] or 0); h = int(row[idx['height']] or 0)
        except ValueError:
            w = h = 0
        cands[slug].append({
            'photo_id': int(row[idx['photo_id']]), 'ext': row[idx['extension']] or 'jpg', 'license': lic,
            'w': w, 'h': h, 'obs': row[idx['observation_uuid']], 'observer_id': observer_id, 'login': login,
            'name': name, 'observed_on': observed_on, 'position': int(row[idx['position']] or 0), 'lat': lat, 'lon': lon,
        })
print('licenses seen:', dict(lic_count), file=sys.stderr)
rnd = random.Random(42)
out = {}
for slug in sorted(cands):
    c = cands[slug]
    # Prefer the first photo of an observation (usually the overview shot), decent resolution, and spread observers.
    c.sort(key=lambda x: (x['position'] != 0, -(min(x['w'], x['h']) >= 1000), -(min(x['w'], x['h']) >= 700), rnd.random()))
    seen_obs = set(); seen_user = collections.Counter(); pick = []
    for x in c:
        if x['obs'] in seen_obs: continue
        if seen_user[x['login']] >= 3: continue
        seen_obs.add(x['obs']); seen_user[x['login']] += 1
        pick.append(x)
        if len(pick) >= max_per: break
    out[slug] = pick
    print(f'{slug:30s} total={len(c):6d} picked={len(pick)}', file=sys.stderr)
json.dump(out, open(f'{work}/candidates.json', 'w'), indent=1)
