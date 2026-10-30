#!/bin/bash
# tar --to-command handler: one archive member on stdin, its name in $TAR_FILENAME.
# Needs WORK (work dir containing taxon_ids.txt, taxon_map.json, newmin.txt) and PIPE (this directory).
W="$WORK"; P="$PIPE"
log(){ echo "$(date +%T) $*" >> "$W/dispatch.log"; }
case "$TAR_FILENAME" in
  */observations.csv)
    log "observations start"
    NEWMIN=$(cat "$W/newmin.txt")
    mawk -F'\t' -v W="$W" -v T="$NEWMIN" '
      NR==FNR { s[$1]; next }
      FNR==1 { next }
      $7=="research" {
        if ($6 in s) { print > (W "/obs_sel.tsv") }
        else if ($6+0 >= T) { print $1 "\t" $6 > (W "/obs_new.tsv") }
      }' "$W/taxon_ids.txt" -
    log "observations done: $(wc -l < "$W/obs_sel.tsv") selected"
    ;;
  */observers.csv) log "observers start"; cat > "$W/observers.csv"; log "observers done" ;;
  */photos.csv)
    log "photos start"
    python3 -I "$P/make_uuid_set.py" "$W" 4000 2>> "$W/dispatch.log"
    mawk -F'\t' 'NR==FNR { u[$1]; next } FNR==1 || ($3 in u)' "$W/uuids.txt" - > "$W/photos_sel.tsv"
    log "photos done $(wc -l < "$W/photos_sel.tsv")"
    ;;
  */taxa.csv) log "taxa start"; cat > "$W/taxa.csv"; log "taxa done" ;;
  *) cat > /dev/null ;;
esac
exit 0
