#!/bin/bash
# Download 'medium' (500px) versions of all candidates for contact sheets. Args: WORK dir.
W="$1"; mkdir -p "$W/thumbs"
python3 -I - "$W" <<'PY' > "$W/thumbs.urls"
import json, sys
w = sys.argv[1]
c = json.load(open(f'{w}/candidates.json'))
for slug, lst in c.items():
    for x in lst:
        print(f"{slug}\t{x['photo_id']}\t{x['ext']}")
PY
cd "$W/thumbs"
# 8 parallel curls, skipping files that already exist
cat "$W/thumbs.urls" | xargs -P 8 -n 3 sh -c 'f="$0_$1.$2"; [ -s "$f" ] || curl -sS -m 60 --retry 3 -o "$f" "https://inaturalist-open-data.s3.amazonaws.com/photos/$1/medium.$2" || echo "FAIL $0 $1" >&2'
echo "downloaded: $(ls | wc -l) files"
