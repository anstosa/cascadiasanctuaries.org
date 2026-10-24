# Cascadia Sanctuaries

**Helping people discover and support farmed animal sanctuaries across the Pacific Northwest**

[Explore the directory](https://cascadiasanctuaries.org/) · [Sanctuary data](static/data/sanctuaries.json) · [Build script](scripts/build_site.py) · [Data updater](scripts/update-sanctuaries.py)

## At a glance

| | |
| --- | --- |
| **Product** | A searchable map and directory of farmed animal sanctuaries in Washington, Oregon, British Columbia, Idaho, and Montana. |
| **User experience** | Browse and search sanctuaries, select map markers, open individual profiles, and follow publicly listed websites, contact details, and social links. |
| **Technical approach** | Static published pages, client-side map browsing with MapLibre/CARTO, a checked-in JSON data snapshot, and Python-driven route generation. |
| **Engineering priorities** | Keep directory browsing usable when maps fail, give each sanctuary a stable URL, and prevent accidental data loss during updates. |

## The problem

Finding a farmed animal sanctuary should not require knowing its name before searching. Directory users need a geographically useful overview, individual organization profiles, and working paths to the sanctuaries' own public channels. The same content also needs to be accessible from searches and direct links, not only through a JavaScript-driven map.

Cascadia Sanctuaries combines those needs into a single directory. A responsive interface pairs search and individual profiles with an interactive map. Sanctuary records are held in a locally published snapshot so the site remains browsable independently of the spreadsheet service used to refresh the data.

## Architecture and key decisions

### Searchable map without dependence on map rendering

The directory uses MapLibre and CARTO Positron tiles for its map experience. Search and sanctuary profiles remain accessible if the map renderer does not start. Responsive layouts adjust the available space for the profile and center the selected marker in the visible map area.

### Clean, crawlable organization pages

Each sanctuary has a dedicated route such as [Ballydídean Farm Sanctuary](https://cascadiasanctuaries.org/ballydidean-farm-sanctuary/). The [site builder](scripts/build_site.py) generates the root directory, sanctuary route pages, a separate email-directory route, and discovery documents including `sitemap.xml`, `robots.txt`, and `llms.txt`.

Route-specific titles, descriptions, canonical URLs, and structured metadata make profiles useful to human and automated visitors. The email directory is separately marked not to be indexed.

### Stable identifiers and guarded updates

The [data updater](scripts/update-sanctuaries.py) reads from a spreadsheet-backed JSON endpoint, normalizes fields, and validates records before regeneration.

- Existing canonical slugs are preserved by matching stable identity information when an organization's name changes.
- Unsafe, duplicate, or reserved route slugs are rejected.
- Public URLs and map coordinates are validated.
- An unexpected directory reduction or loss of existing routes triggers a safety check; the explicit `--force` option is available for reviewed changes.
- The builder renders proposed route outputs and checks route ownership before publishing generated pages and removing obsolete generated routes.

These controls reduce the risk that a bad external snapshot silently wipes directory entries or breaks bookmarked URLs. They do not independently verify each organization's current real-world status.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | Main directory document and web application shell |
| [`static/data/sanctuaries.json`](static/data/sanctuaries.json) | Published sanctuary snapshot |
| [`scripts/update-sanctuaries.py`](scripts/update-sanctuaries.py) | Fetch, normalize, validate, and refresh directory data |
| [`scripts/build_site.py`](scripts/build_site.py) | Generate route pages and search/discovery metadata |
| [`llms.txt`](llms.txt) | Public, AI-readable directory and route index |
| [`sitemap.xml`](sitemap.xml) | Discoverable profile URLs |

## Updating the directory

Python 3 is used for the site-generation utilities.

To rebuild pages from the existing local snapshot:

```sh
python3 scripts/build_site.py
```

To request a refreshed snapshot from the configured spreadsheet endpoint and rebuild:

```sh
python3 scripts/update-sanctuaries.py
```

The updater intentionally rejects unusually large losses of existing entries or canonical routes. Its `--force` option should only be used after reviewing the source data and intended removals.

The repository's publishing branch is `gh-pages`. Changes to source data and generated profile pages should be reviewed together before publishing.

## Scope and attribution

Directory information comes from a maintained local snapshot of public organization details and may become stale as organizations change websites, addresses, or programs. Inclusion does not by itself establish an independent audit, accreditation, or endorsement.

Created by Ansel Santosa in connection with [Ballydídean Farm Sanctuary](https://ballydidean.farm), with the aim of making the regional sanctuary community easier to find and support.
