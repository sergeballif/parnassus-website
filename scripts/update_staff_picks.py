#!/usr/bin/env python3
"""Update the Staff Picks from the published Google Sheet.

Reads the published CSV, keeps the TOP 12 rows under the header, cleans the text,
downloads a cover for each ISBN, and writes _data/staff_picks.json.

Sheet columns (header names are case-insensitive; order doesn't matter):
  First name | Title | Author | ISBN | Blurb | Image URL (optional)

Usage:
  STAFF_PICKS_CSV_URL=<published CSV link> python3 scripts/update_staff_picks.py
  python3 scripts/update_staff_picks.py --csv-file picks.csv      (test with a local file)

If the sheet can't be read or has no usable rows, nothing is changed and the script
exits with an error, so the site keeps showing the last good picks.
Python 3.8+, standard library only.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

MAX_PICKS = 12
LIMITS = {"picker": 30, "title": 120, "author": 80, "blurb": 280}
MAX_COVER_BYTES = 3 * 1024 * 1024
MIN_COVER_BYTES = 2000          # smaller than this is a "no cover" placeholder image

# {isbn13} / {isbn} are filled in. Tried in order; the first real image wins.
COVER_SOURCES = [
    "https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false",
    "https://images-us.bookshop.org/ingram/{isbn13}.jpg",
]

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "_data" / "staff_picks.json"
COVER_DIR = ROOT / "assets" / "covers"
UA = "parnassus-staff-picks/1.0 (+https://parnassusak.com)"

HEADER_ALIASES = {
    "picker": "picker", "firstname": "picker", "name": "picker", "pickedby": "picker", "staff": "picker",
    "title": "title", "booktitle": "title",
    "author": "author", "by": "author",
    "isbn": "isbn", "isbn13": "isbn", "isbn10": "isbn",
    "blurb": "blurb", "description": "blurb", "why": "blurb", "review": "blurb",
    "imageurl": "image_url", "image": "image_url", "cover": "image_url", "coverurl": "image_url",
}


def log(msg):
    print(msg, flush=True)


def clean_text(value, limit):
    """Plain text only: no control characters, no stray whitespace, length-capped."""
    value = re.sub(r"[\x00-\x1f\x7f]", " ", value or "")
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) > limit:
        value = value[: limit - 1].rstrip() + "…"
    return value


def clean_picker(value):
    value = clean_text(value, LIMITS["picker"] + 10)
    value = re.sub(r"['’]s\s+pick$", "", value, flags=re.I).strip()
    return value[: LIMITS["picker"]]


def isbn13_from(isbn):
    """Return a valid ISBN-13 (digits) from an ISBN-10/13 string, or ''."""
    s = re.sub(r"[\s-]", "", isbn or "").upper()
    if re.fullmatch(r"\d{13}", s):
        total = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(s[:12]))
        return s if (10 - total % 10) % 10 == int(s[12]) else ""
    if re.fullmatch(r"\d{9}[\dX]", s):
        total = sum((10 - i) * (10 if c == "X" else int(c)) for i, c in enumerate(s))
        if total % 11 != 0:
            return ""
        core = "978" + s[:9]
        check = (10 - sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(core)) % 10) % 10
        return core + str(check)
    return ""


def clean_url(value):
    value = (value or "").strip()
    if re.fullmatch(r"https://[^\s\"'<>]{4,300}", value):
        return value
    return ""


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(MAX_COVER_BYTES + 1), resp.headers.get("Content-Type", "")


def image_ext(data):
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return ""


def load_csv_text(args):
    if args.csv_file:
        return Path(args.csv_file).read_text(encoding="utf-8-sig")
    url = os.environ.get("STAFF_PICKS_CSV_URL", "").strip()
    if not url:
        log("STAFF_PICKS_CSV_URL is not set; leaving the staff picks as they are.")
        sys.exit(0)
    if not url.startswith("https://"):
        sys.exit("STAFF_PICKS_CSV_URL must start with https://")
    data, _ = fetch(url)
    return data.decode("utf-8-sig")


def parse_rows(text):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return []
    header = [HEADER_ALIASES.get(re.sub(r"[^a-z0-9]", "", h.lower()), "") for h in rows[0]]
    if "title" not in header:
        sys.exit("The sheet's first row must be a header that includes a Title column.")
    picks = []
    for number, row in enumerate(rows[1:], start=2):
        record = {}
        for key, cell in zip(header, row):
            if key and key not in record:
                record[key] = cell
        if not any((c or "").strip() for c in row):
            continue                                    # blank row: ignore
        title = clean_text(record.get("title"), LIMITS["title"])
        if not title:
            log("Row %d has no title; skipped." % number)
            continue
        isbn_raw = record.get("isbn", "")
        isbn = isbn13_from(isbn_raw)
        if isbn_raw.strip() and not isbn:
            log("Row %d: ISBN %r is not valid; showing the pick without a cover." % (number, isbn_raw.strip()))
        picks.append({
            "picker": clean_picker(record.get("picker")),
            "title": title,
            "author": clean_text(record.get("author"), LIMITS["author"]),
            "isbn": isbn,
            "blurb": clean_text(record.get("blurb"), LIMITS["blurb"]),
            "_image_url": clean_url(record.get("image_url")),
        })
        if len(picks) == MAX_PICKS:
            break
    return picks


def get_cover(pick):
    """Download (or reuse) a cover. Returns the site path like /assets/covers/x.jpg, or ''."""
    key = pick["isbn"] or re.sub(r"[^a-z0-9]+", "-", pick["title"].lower()).strip("-")[:40]
    tag = hashlib.sha1(pick["_image_url"].encode()).hexdigest()[:8]
    prefix = "%s-%s." % (key, tag)
    for existing in COVER_DIR.glob(prefix + "*"):
        if existing.stat().st_size >= MIN_COVER_BYTES:
            return "/assets/covers/" + existing.name
    candidates = []
    if pick["_image_url"]:
        candidates.append(pick["_image_url"])
    if pick["isbn"]:
        candidates += [s.format(isbn=pick["isbn"], isbn13=pick["isbn"]) for s in COVER_SOURCES]
    for url in candidates:
        try:
            data, _ctype = fetch(url, timeout=20)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            log("  cover not available from %s (%s)" % (url.split("?")[0], exc))
            continue
        ext = image_ext(data)
        if not ext or not (MIN_COVER_BYTES <= len(data) <= MAX_COVER_BYTES):
            log("  ignored a non-image or placeholder from %s" % url.split("?")[0])
            continue
        COVER_DIR.mkdir(parents=True, exist_ok=True)
        (COVER_DIR / (prefix + ext)).write_bytes(data)
        return "/assets/covers/%s%s" % (prefix, ext)
    return ""


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv-file", help="read this local CSV instead of downloading the sheet")
    args = parser.parse_args()

    try:
        text = load_csv_text(args)
    except (urllib.error.URLError, OSError, UnicodeDecodeError) as exc:
        sys.exit("Could not read the sheet: %s" % exc)

    picks = parse_rows(text)
    if not picks:
        sys.exit("No usable rows found in the sheet; leaving the staff picks unchanged.")
    log("%d pick(s) found." % len(picks))

    keep = set()
    for pick in picks:
        log("Pick: %s" % pick["title"])
        cover = get_cover(pick)
        pick["cover"] = cover
        if cover:
            keep.add(cover.rsplit("/", 1)[1])
        else:
            log("  no cover found; the site will show a plain cover instead.")
        del pick["_image_url"]

    new_json = json.dumps(picks, indent=2, ensure_ascii=False) + "\n"
    old_json = DATA_FILE.read_text(encoding="utf-8") if DATA_FILE.exists() else ""
    if new_json != old_json:
        DATA_FILE.write_text(new_json, encoding="utf-8")
        log("Updated %s" % DATA_FILE.relative_to(ROOT))
    else:
        log("Staff picks unchanged.")

    if COVER_DIR.exists():                              # tidy covers no longer in use
        for f in COVER_DIR.iterdir():
            if f.is_file() and f.name != ".gitkeep" and f.name not in keep:
                f.unlink()


if __name__ == "__main__":
    main()
