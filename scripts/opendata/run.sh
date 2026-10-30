#!/bin/bash
# Stream the iNaturalist open-data metadata dump (tens of GB, never touches disk) and keep only what the game needs.
# Usage: scripts/opendata/run.sh <work-dir> [dump-url]
set -u
WORK="${1:?work dir}"; PIPE="$(cd "$(dirname "$0")" && pwd)"; export WORK PIPE
URL="${2:-https://inaturalist-open-data.s3.amazonaws.com/metadata/inaturalist-open-data-latest.tar.gz}"
mkdir -p "$WORK"
for f in taxon_ids.txt taxon_map.json newmin.txt; do [ -s "$WORK/$f" ] || { echo "missing $WORK/$f (run resolve_taxa.py first)"; exit 1; }; done
echo "start $(date)" >> "$WORK/run.log"
curl -sS --retry 5 --retry-all-errors -m 7000 "$URL" | tar -xzf - --to-command="$PIPE/dispatch.sh" 2>> "$WORK/run.log"
echo "curl exit ${PIPESTATUS[0]} tar exit ${PIPESTATUS[1]} end $(date)" >> "$WORK/run.log"
