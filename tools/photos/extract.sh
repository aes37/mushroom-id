#!/bin/bash
# Extract research-grade fungi observations and their photo metadata from the
# iNaturalist Open Dataset (https://github.com/inaturalist/inaturalist-open-data).
#
# Usage: tools/photos/extract.sh WORK_DIR
#
# Streams ~35 GB of compressed metadata from the public S3 bucket without storing it;
# the filtered output is a few hundred MB. Takes roughly 20-30 minutes.
set -euo pipefail
WORK=${1:?usage: extract.sh WORK_DIR}
HERE=$(cd "$(dirname "$0")" && pwd)
B=https://inaturalist-open-data.s3.amazonaws.com
mkdir -p "$WORK"
cd "$WORK"

curl -sSf -o taxa.csv.gz "$B/taxa.csv.gz"
curl -sSf -o observers.csv.gz "$B/observers.csv.gz"

# All taxa in kingdom Fungi (taxon 47170).
zcat taxa.csv.gz | awk -F'\t' 'NR > 1 && ($1 == "47170" || $2 ~ /(^|\/)47170(\/|$)/) { print $1 }' > fungi_taxa.txt

size() { curl -sSfI "$B/$1" | tr -d '\r' | awk 'tolower($1) == "content-length:" { print $2 }'; }

python3 "$HERE/rangecat.py" "$B/observations.csv.gz" "$(size observations.csv.gz)" | zcat | awk -F'\t' -v OFS='\t' '
  FNR == NR { fungi[$1] = 1; next }
  ($6 in fungi) && $7 == "research" { print $1, $2, $3, $4, $6, $8 }
' fungi_taxa.txt - > fungi_obs.tsv

python3 "$HERE/rangecat.py" "$B/photos.csv.gz" "$(size photos.csv.gz)" | zcat | awk -F'\t' -v OFS='\t' '
  FNR == NR { obs[$1] = 1; next }
  ($3 in obs) { print $2, $3, $4, $5, $6, $7, $8, $9 }
' fungi_obs.tsv - > fungi_photos.tsv

wc -l fungi_obs.tsv fungi_photos.tsv
