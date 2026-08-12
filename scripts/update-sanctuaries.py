#!/usr/bin/env python3
"""Refresh the local sanctuary directory from the spreadsheet API."""

import json
import math
import os
import re
import tempfile
import unicodedata
import urllib.request
from argparse import ArgumentParser
from pathlib import Path

SOURCE_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbyM0HLa99-FsTMaRebnTJ-3-2x_fN7JtY8Xoj-lYqxrEorfG6BBzJ1N9gCW_s_z2HmO4g/exec"
)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_PATH = PROJECT_ROOT / "static" / "data" / "sanctuaries.json"
RESERVED_SLUGS = {"emails"}
MINIMUM_RETAINED_RATIO = 0.9


# parse updater arguments
def parse_arguments():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force",
        action="store_true",
        help="accept a directory shrink larger than ten percent"
    )
    return parser.parse_args()


# normalize route slugs
def sanctuary_slug(name):
    normalized_name = unicodedata.normalize("NFKD", name)
    # remove combining accents
    unaccented_name = "".join(
        character for character in normalized_name if not unicodedata.combining(character)
    )
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", unaccented_name.lower()))


# normalize spreadsheet strings
def normalize_sanctuaries(data):
    normalized_rows = []

    # normalize every row
    for sanctuary in data:
        # preserve malformed rows for validation
        if not isinstance(sanctuary, dict):
            normalized_rows.append(sanctuary)
            continue

        normalized_rows.append({
            # trim every field
            key: value.strip() if isinstance(value, str) else value
            for key, value in sanctuary.items()
        })

    return normalized_rows


# download spreadsheet rows
def download_sanctuaries():
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"Accept": "application/json", "User-Agent": "CascadiaSanctuariesUpdater/1.0"}
    )

    # close the network response
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


# validate the downloaded directory
def validate_sanctuaries(data):
    # require a row collection
    if not isinstance(data, list):
        raise ValueError("Spreadsheet response must be a JSON array")

    # reject empty snapshots
    if not data:
        raise ValueError("Spreadsheet response did not contain any sanctuaries")

    names = set()
    slugs = set()

    # validate every row
    for index, sanctuary in enumerate(data, start=1):
        # require object rows
        if not isinstance(sanctuary, dict):
            raise ValueError(f"Sanctuary row {index} must be a JSON object")

        name = sanctuary.get("name")

        # require usable names
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"Sanctuary row {index} is missing a name")

        normalized_name = name.strip().casefold()
        slug = sanctuary_slug(name)

        # prevent ambiguous directory entries
        if normalized_name in names:
            raise ValueError(f"Duplicate sanctuary name: {name.strip()}")

        names.add(normalized_name)

        # require usable routes
        if not slug or slug in RESERVED_SLUGS:
            raise ValueError(f"Reserved or empty sanctuary route: {name.strip()}")

        # prevent ambiguous routes
        if slug in slugs:
            raise ValueError(f"Duplicate sanctuary route: {slug}")

        slugs.add(slug)

        longitude = sanctuary.get("longitude")
        latitude = sanctuary.get("latitude")
        has_longitude = longitude not in ("", None)
        has_latitude = latitude not in ("", None)

        # require coordinate pairs
        if has_longitude != has_latitude:
            raise ValueError(f"Incomplete coordinates for {name.strip()}")

        # validate mapped coordinates
        if has_longitude:
            # parse numeric coordinates
            try:
                longitude = float(longitude)
                latitude = float(latitude)
            except (TypeError, ValueError) as error:
                # reject malformed coordinates
                raise ValueError(f"Invalid coordinates for {name.strip()}") from error

            # enforce geographic ranges
            if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                raise ValueError(f"Out-of-range coordinates for {name.strip()}")


# guard unexpected data loss
def validate_snapshot_size(data, force):
    # allow the initial snapshot
    if force or not OUTPUT_PATH.exists():
        return

    with OUTPUT_PATH.open(encoding="utf-8") as snapshot_file:
        existing_data = json.load(snapshot_file)

    minimum_count = math.ceil(len(existing_data) * MINIMUM_RETAINED_RATIO)

    # reject large directory drops
    if len(data) < minimum_count:
        raise ValueError(
            f"Refusing to replace {len(existing_data)} sanctuaries with {len(data)}; "
            "review the source and rerun with --force if the reduction is intentional"
        )


# replace the snapshot atomically
def write_snapshot(data):
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # keep partial downloads out of the site
    with tempfile.NamedTemporaryFile(
        "w",
        dir=OUTPUT_PATH.parent,
        encoding="utf-8",
        prefix=f".{OUTPUT_PATH.name}.",
        suffix=".tmp",
        delete=False
    ) as temporary_file:
        temporary_path = Path(temporary_file.name)
        json.dump(data, temporary_file, ensure_ascii=False, indent=2)
        temporary_file.write("\n")

    os.replace(temporary_path, OUTPUT_PATH)
    OUTPUT_PATH.chmod(0o644)


# refresh the local data
def main():
    arguments = parse_arguments()
    sanctuaries = download_sanctuaries()
    sanctuaries = normalize_sanctuaries(sanctuaries)
    validate_sanctuaries(sanctuaries)
    validate_snapshot_size(sanctuaries, arguments.force)
    write_snapshot(sanctuaries)
    print(f"Updated {OUTPUT_PATH.relative_to(PROJECT_ROOT)} with {len(sanctuaries)} sanctuaries")


# run from the command line
if __name__ == "__main__":
    main()
