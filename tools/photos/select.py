#!/usr/bin/env python3
"""Record the photos picked from a contact sheet in tools/photos/selection.json.

Usage: python3 tools/photos/select.py WORK_DIR SPECIES 3,7,12,...

The numbers are the 1-based labels on WORK_DIR/sheets/SPECIES.jpg, in the order you want
them stored. Re-running for a species replaces its selection.
"""
import json
import sys
from pathlib import Path

SELECTION = Path(__file__).resolve().parent / "selection.json"
FIELDS = ("id", "ext", "license", "by", "taxon", "obs")


def main():
    work, species, picks = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    candidates = json.loads((work / "candidates.json").read_text(encoding="utf-8"))[species]
    numbers = [int(n) for n in picks.split(",")]
    if len(set(numbers)) != len(numbers) or not all(1 <= n <= len(candidates) for n in numbers):
        raise SystemExit(f"Picks must be distinct numbers from 1 to {len(candidates)}")
    chosen = [candidates[n - 1] for n in numbers]
    selection = json.loads(SELECTION.read_text(encoding="utf-8")) if SELECTION.exists() else {}
    selection[species] = [{k: p[k] for k in FIELDS} for p in chosen]
    SELECTION.write_text(json.dumps(dict(sorted(selection.items())), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{species}: {len(chosen)} photos")


if __name__ == "__main__":
    main()
