#!/usr/bin/env python3
"""Stream a large public S3 object to stdout using parallel, retried HTTP range requests.

Usage: rangecat.py URL SIZE_IN_BYTES

A single long download of a 20 GB file tends to get reset part-way; fetching it in
ordered 64 MB ranges (a few in parallel) makes the stream both resumable and faster.
"""
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CHUNK = 64 * 1024 * 1024
WORKERS = 6


def main():
    url, size = sys.argv[1], int(sys.argv[2])

    def fetch(offset):
        end = min(offset + CHUNK, size) - 1
        for attempt in range(12):
            try:
                req = urllib.request.Request(url, headers={"Range": f"bytes={offset}-{end}"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                if len(data) == end - offset + 1:
                    return data
            except Exception as e:  # retry any network error
                print(f"retrying range at {offset} ({e})", file=sys.stderr)
            time.sleep(min(2**attempt, 30))
        raise SystemExit(f"giving up on range at {offset}")

    offsets = list(range(0, size, CHUNK))
    out = sys.stdout.buffer
    with ThreadPoolExecutor(WORKERS) as ex:
        pending, i = [], 0
        while i < len(offsets) or pending:
            while i < len(offsets) and len(pending) < WORKERS * 2:
                pending.append(ex.submit(fetch, offsets[i]))
                i += 1
            out.write(pending.pop(0).result())
            out.flush()


if __name__ == "__main__":
    main()
