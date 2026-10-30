"""Download photos from the iNaturalist Open Dataset bucket (public, no credentials needed)."""
import time
import urllib.request

BUCKET = "https://inaturalist-open-data.s3.amazonaws.com"


def photo_url(photo_id, ext, size):
    """size is one of: square, small (240px), medium (500px), large (1024px), original (2048px)."""
    return f"{BUCKET}/photos/{photo_id}/{size}.{ext}"


def download(photo_id, ext, size, dest, attempts=5):
    url = photo_url(photo_id, ext, size)
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data = r.read()
            dest.write_bytes(data)
            return True
        except Exception:  # network hiccups: retry with backoff
            time.sleep(2**attempt)
    return False
