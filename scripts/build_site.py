#!/usr/bin/env python3
"""Generate clean sanctuary routes and discovery metadata from local data."""

import html
import json
import os
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path
from urllib.parse import quote, urlparse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PAGE = PROJECT_ROOT / "index.html"
DATA_PATH = PROJECT_ROOT / "static" / "data" / "sanctuaries.json"
SITEMAP_PATH = PROJECT_ROOT / "sitemap.xml"
ROBOTS_PATH = PROJECT_ROOT / "robots.txt"
LLMS_PATH = PROJECT_ROOT / "llms.txt"
SITE_URL = "https://cascadiasanctuaries.org"
GENERATOR_MARKER = '<meta name="generator" content="Cascadia route builder">'
RESERVED_SLUGS = {"emails", "node-modules", "scripts", "static"}
DIRECTORY_TITLE = "Pacific Northwest Farm Sanctuaries | Cascadia Sanctuaries"
DIRECTORY_DESCRIPTION = (
    "Explore farm animal sanctuaries across Washington, Oregon, British Columbia, "
    "Idaho, and Montana. Find locations, contact details, and ways to support."
)


# normalize route slugs
def sanctuary_slug(name):
    """Match the browser's sanctuary slug algorithm."""
    normalized_name = unicodedata.normalize("NFKD", name)
    unaccented_name = "".join(
        character for character in normalized_name if not unicodedata.combining(character)
    )
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", unaccented_name.lower()))


# read canonical route slugs
def sanctuary_route_slug(sanctuary):
    """Prefer a persisted canonical slug and derive only for legacy snapshots."""
    return str(sanctuary.get("slug") or sanctuary_slug(sanctuary["name"]))


# validate generated route paths
def validate_route_slugs(sanctuaries):
    """Reject unsafe, reserved, or duplicate route paths at the build boundary."""
    slugs = set()

    # validate every canonical route
    for sanctuary in sanctuaries:
        slug = sanctuary_route_slug(sanctuary)

        # require safe path segments
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug) or slug in RESERVED_SLUGS:
            raise ValueError(f"Unsafe or reserved sanctuary route: {slug}")

        # prevent output collisions
        if slug in slugs:
            raise ValueError(f"Duplicate sanctuary route: {slug}")

        slugs.add(slug)


# normalize public links
def normalize_url(value, context="public URL"):
    """Return an absolute HTTP URL and reject malformed configured values."""
    candidate = str(value or "").strip()

    # omit empty links
    if not candidate:
        return ""

    absolute_url = candidate if re.match(r"^https?://", candidate, re.I) else f"https://{candidate}"
    # reject malformed urls
    try:
        parsed_url = urlparse(absolute_url)
        hostname = parsed_url.hostname
        parsed_url.port
    except ValueError as error:
        raise ValueError(f"Invalid {context}: {candidate}") from error

    # allow web protocols only
    if (
        parsed_url.scheme not in {"http", "https"}
        or not parsed_url.netloc
        or not hostname
        or re.search(r"\s", parsed_url.netloc)
    ):
        raise ValueError(f"Invalid {context}: {candidate}")

    return absolute_url


# replace tag attributes
def replace_tag_attribute(page, element_id, attribute, value):
    """Replace one quoted attribute on a uniquely identified head element."""
    escaped_value = html.escape(str(value), quote=True)
    pattern = re.compile(
        rf'(<[^>]+\bid="{re.escape(element_id)}"[^>]*\b{re.escape(attribute)}=")[^"]*(")'
    )
    updated_page, replacement_count = pattern.subn(rf"\g<1>{escaped_value}\g<2>", page, count=1)

    # require stable template markers
    if replacement_count != 1:
        raise ValueError(f"Could not update {attribute} on #{element_id}")

    return updated_page


# replace page titles
def replace_title(page, title):
    """Replace the document title."""
    escaped_title = html.escape(title)
    updated_page, replacement_count = re.subn(
        r"<title>.*?</title>",
        f"<title>{escaped_title}</title>",
        page,
        count=1,
        flags=re.S
    )

    # require one title
    if replacement_count != 1:
        raise ValueError("Could not update the document title")

    return updated_page


# replace structured data
def replace_structured_data(page, structured_data):
    """Replace the JSON-LD graph in the page template."""
    serialized_data = json.dumps(structured_data, ensure_ascii=False, indent=2)
    # prevent script termination
    serialized_data = (
        serialized_data
        .replace("&", "\\u0026")
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )
    pattern = re.compile(
        r'(<script id="structured-data" type="application/ld\+json">).*?(</script>)',
        re.S
    )
    # preserve escaped json literals
    updated_page, replacement_count = pattern.subn(
        lambda match: f"{match.group(1)}\n{serialized_data}\n    {match.group(2)}",
        page,
        count=1
    )

    # require one graph
    if replacement_count != 1:
        raise ValueError("Could not update structured data")

    return updated_page


# describe the directory
def directory_structured_data(sanctuaries):
    """Build site, collection, and route-list schema for the directory page."""
    item_list = []

    # expose every canonical route
    for position, sanctuary in enumerate(sanctuaries, start=1):
        slug = sanctuary_route_slug(sanctuary)
        item_list.append({
            "@type": "ListItem",
            "position": position,
            "name": sanctuary["name"],
            "url": f"{SITE_URL}/{slug}/"
        })

    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{SITE_URL}/#website",
                "url": f"{SITE_URL}/",
                "name": "Cascadia Sanctuaries",
                "alternateName": "Cascadia Farm Sanctuaries",
                "description": (
                    "A directory of farm animal sanctuaries across Washington, Oregon, "
                    "British Columbia, Idaho, and Montana."
                ),
                "inLanguage": "en-US"
            },
            {
                "@type": "CollectionPage",
                "@id": f"{SITE_URL}/#directory",
                "url": f"{SITE_URL}/",
                "name": "Farm sanctuaries of the Pacific Northwest",
                "description": (
                    "Explore organizations giving farmed animals a safe place to land across "
                    "Washington, Oregon, British Columbia, Idaho, and Montana."
                ),
                "isPartOf": {"@id": f"{SITE_URL}/#website"},
                "about": {"@type": "Thing", "name": "Farm animal sanctuaries"},
                "primaryImageOfPage": {
                    "@type": "ImageObject",
                    "url": f"{SITE_URL}/static/media/cascadia-sanctuaries-logo.png",
                    "width": 1254,
                    "height": 1254
                },
                "spatialCoverage": [
                    {"@type": "AdministrativeArea", "name": "Washington"},
                {"@type": "AdministrativeArea", "name": "Oregon"},
                {"@type": "AdministrativeArea", "name": "British Columbia"},
                {"@type": "AdministrativeArea", "name": "Idaho"},
                {"@type": "AdministrativeArea", "name": "Montana"}
                ],
                "mainEntity": {
                    "@type": "ItemList",
                    "name": "Cascadia sanctuary directory",
                    "numberOfItems": len(item_list),
                    "itemListOrder": "https://schema.org/ItemListUnordered",
                    "itemListElement": item_list
                },
                "inLanguage": "en-US"
            }
        ]
    }


# collect social profiles
def sanctuary_same_as(sanctuary):
    """Build validated public profile URLs for one sanctuary."""
    profile_templates = {
        "facebook": "https://facebook.com/{value}",
        "instagram": "https://instagram.com/{value}",
        "twitter": "https://twitter.com/{value}",
        "tiktok": "https://tiktok.com/@{value}"
    }
    profiles = []
    website = normalize_url(sanctuary.get("website"))

    # include official websites
    if website:
        profiles.append(website)

    # include configured profiles
    for field, template in profile_templates.items():
        value = str(sanctuary.get(field) or "").strip().lstrip("@")

        # omit empty profiles
        if value:
            profiles.append(template.format(value=value))

    youtube = normalize_url(sanctuary.get("youtube"))

    # include youtube links
    if youtube:
        profiles.append(youtube)

    return profiles


# describe one sanctuary
def sanctuary_structured_data(sanctuary, canonical_url, description):
    """Build page and organization schema for a sanctuary profile route."""
    organization = {
        "@type": "Organization",
        "@id": f"{canonical_url}#sanctuary",
        "name": sanctuary["name"],
        "mainEntityOfPage": {"@id": f"{canonical_url}#webpage"}
    }
    website = normalize_url(sanctuary.get("website"))
    same_as = sanctuary_same_as(sanctuary)
    city = str(sanctuary.get("city") or "").strip()
    state = str(sanctuary.get("state") or "").strip()
    street_address = str(sanctuary.get("address") or "").strip()

    # prefer official websites
    organization["url"] = website or canonical_url

    # add available addresses
    if city or state or street_address:
        organization["address"] = {
            "@type": "PostalAddress",
            "streetAddress": street_address,
            "addressLocality": city,
            "addressRegion": state
        }

    latitude = sanctuary.get("latitude")
    longitude = sanctuary.get("longitude")

    # add available coordinates
    if latitude not in (None, "") and longitude not in (None, ""):
        organization["geo"] = {
            "@type": "GeoCoordinates",
            "latitude": latitude,
            "longitude": longitude
        }

    # add public profiles
    if same_as:
        organization["sameAs"] = same_as

    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                "@id": f"{SITE_URL}/#website",
                "url": f"{SITE_URL}/",
                "name": "Cascadia Sanctuaries",
                "inLanguage": "en-US"
            },
            {
                "@type": "WebPage",
                "@id": f"{canonical_url}#webpage",
                "url": canonical_url,
                "name": f"{sanctuary['name']} | Cascadia Sanctuaries",
                "description": description,
                "isPartOf": {"@id": f"{SITE_URL}/#website"},
                "mainEntity": {"@id": f"{canonical_url}#sanctuary"},
                "inLanguage": "en-US"
            },
            organization
        ]
    }


# render shared icons
def detail_icon(icon_id):
    """Render one icon from the page's inline sprite."""
    return f'<svg aria-hidden="true"><use href="#icon-{icon_id}"></use></svg>'


# format phone numbers
def format_phone(value):
    """Format North American phone numbers for static route content."""
    digits = re.sub(r"\D", "", str(value or ""))

    # format ten-digit numbers
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}–{digits[6:]}"

    return str(value or "")


# render contact links
def static_detail_link(href, icon_id, label):
    """Render a safe contact link for static sanctuary content."""
    # omit empty links
    if not href or not label:
        return ""

    return (
        f'<a class="detail-link" href="{html.escape(href, quote=True)}" '
        'target="_blank" rel="noopener noreferrer">'
        f'{detail_icon(icon_id)}<span>{html.escape(str(label))}</span>{detail_icon("external")}</a>'
    )


# prerender sanctuary profiles
def render_sanctuary_body(page, sanctuary):
    """Expose sanctuary profile content before the SPA initializes."""
    city_state = ", ".join(
        value for value in [str(sanctuary.get("city") or "").strip(), str(sanctuary.get("state") or "").strip()]
        if value
    )
    address = ", ".join(
        value for value in [str(sanctuary.get("address") or "").strip(), city_state]
        if value
    )
    facts = []

    # include founding details
    if sanctuary.get("founded"):
        facts.append(
            '<div class="detail-fact"><span class="detail-fact-label">Founded</span>'
            f'<span class="detail-fact-value">{html.escape(str(sanctuary["founded"]))}</span></div>'
        )

    # include resident details
    if sanctuary.get("residents"):
        facts.append(
            '<div class="detail-fact"><span class="detail-fact-label">Residents</span>'
            f'<span class="detail-fact-value">{html.escape(str(sanctuary["residents"]))}</span></div>'
        )

    maps_url = (
        f"https://www.google.com/maps/search/?api=1&query={quote(address)}"
        if address
        else ""
    )
    website = normalize_url(sanctuary.get("website"))
    email_address = str(sanctuary.get("email") or "").strip()
    phone = str(sanctuary.get("phone") or "").strip()
    phone_digits = re.sub(r"\D", "", phone)
    contact_links = "".join([
        static_detail_link(maps_url, "map-pin", address),
        static_detail_link(website, "globe", sanctuary.get("website")),
        static_detail_link(f"mailto:{email_address}" if email_address else "", "mail", email_address),
        static_detail_link(f"tel:+1{phone_digits}" if phone_digits else "", "phone", format_phone(phone))
    ])
    facts_html = f'<div class="detail-facts">{"".join(facts)}</div>' if facts else ""
    profile_html = (
        '<p class="detail-kicker">Sanctuary profile</p>'
        f'<h2>{html.escape(sanctuary["name"])}</h2>'
        f'<p class="detail-place">{html.escape(city_state or "Cascadia")}</p>'
        f'{facts_html}'
        f'<div class="detail-links">{contact_links}</div>'
    )
    page = page.replace('<main class="map-stage">', '<main class="map-stage has-open-detail">', 1)
    page = page.replace(
        '<aside class="detail-panel" id="detail-panel" aria-live="polite" aria-hidden="true">',
        '<aside class="detail-panel is-open" id="detail-panel" aria-live="polite" aria-hidden="false">',
        1
    )
    page = page.replace(
        '<div id="detail-content"></div>',
        f'<div id="detail-content">{profile_html}</div>',
        1
    )
    return page


# prerender email utility
def render_email_body(page, sanctuaries):
    """Expose the email utility before the SPA initializes."""
    email_addresses = ", ".join(
        str(sanctuary.get("email") or "").strip()
        for sanctuary in sanctuaries
        if str(sanctuary.get("email") or "").strip()
    )
    page = page.replace(
        '<div class="site-shell" id="directory-app">',
        '<div class="site-shell" id="directory-app" hidden>',
        1
    )
    page = page.replace('<div class="email-view" id="email-view" hidden>', '<div class="email-view" id="email-view">', 1)
    page = page.replace('<p id="email-list">Loading…</p>', f'<p id="email-list">{html.escape(email_addresses)}</p>', 1)
    return page


# customize route pages
def render_page(template, title, description, canonical_url, structured_data, robots):
    """Render one route page from the shared SPA template."""
    page = replace_title(template, title)
    page = replace_tag_attribute(page, "page-description", "content", description)
    page = replace_tag_attribute(page, "page-robots", "content", robots)
    page = replace_tag_attribute(page, "open-graph-title", "content", title)
    page = replace_tag_attribute(page, "open-graph-description", "content", description)
    page = replace_tag_attribute(page, "open-graph-url", "content", canonical_url)
    page = replace_tag_attribute(page, "twitter-title", "content", title)
    page = replace_tag_attribute(page, "twitter-description", "content", description)
    page = replace_tag_attribute(page, "canonical-url", "href", canonical_url)
    page = replace_structured_data(page, structured_data)

    # mark generated route shells
    if GENERATOR_MARKER not in page:
        page = page.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n    {GENERATOR_MARKER}', 1)

    return page


# write text atomically
def write_text(path, content):
    """Replace a generated text file without exposing partial output."""
    path.parent.mkdir(parents=True, exist_ok=True)

    # stage complete content
    with tempfile.NamedTemporaryFile(
        "w",
        dir=path.parent,
        encoding="utf-8",
        prefix=f".{path.name}.",
        suffix=".tmp",
        delete=False
    ) as temporary_file:
        temporary_path = Path(temporary_file.name)
        temporary_file.write(content)

    os.replace(temporary_path, path)
    path.chmod(0o644)


# find generated routes
def generated_route_directories():
    """Return directories owned by this generator without mutating them."""
    generated_directories = set()

    # inspect top-level route directories
    for candidate in PROJECT_ROOT.iterdir():
        index_path = candidate / "index.html"

        # ignore source and unrelated directories
        if not candidate.is_dir() or not index_path.is_file():
            continue

        # record owned route outputs
        if GENERATOR_MARKER in index_path.read_text(encoding="utf-8"):
            generated_directories.add(candidate)

    return generated_directories


# render route discovery files
def render_discovery_files(sanctuaries):
    """Render the canonical sitemap, robots policy, and approved AI index."""
    urls = [f"{SITE_URL}/"]

    # include sanctuary profiles
    for sanctuary in sanctuaries:
        urls.append(f"{SITE_URL}/{sanctuary_route_slug(sanctuary)}/")

    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]

    # serialize canonical urls
    for url in urls:
        sitemap_lines.extend(["  <url>", f"    <loc>{html.escape(url)}</loc>", "  </url>"])

    sitemap_lines.append("</urlset>")

    llms_lines = [
        "# Cascadia Sanctuaries",
        "",
        "> A directory of farm animal sanctuaries in Washington, Oregon, British Columbia, Idaho, and Montana.",
        "",
        "Cascadia Sanctuaries helps people find sanctuary locations, contact details, official websites, and public social profiles. Directory information is maintained from a local data snapshot and may change when organizations update their details.",
        "",
        "## Primary pages",
        "",
        f"- [Farm sanctuaries of the Pacific Northwest]({SITE_URL}/): Interactive map and complete directory.",
        "",
        "## Sanctuary profiles",
        ""
    ]

    # list canonical sanctuary profiles
    for sanctuary in sanctuaries:
        slug = sanctuary_route_slug(sanctuary)
        city_state = ", ".join(
            value for value in [str(sanctuary.get("city") or "").strip(), str(sanctuary.get("state") or "").strip()]
            if value
        )
        suffix = f" — {city_state}" if city_state else ""
        llms_lines.append(f"- [{sanctuary['name']}]({SITE_URL}/{slug}/){suffix}")

    llms_lines.extend([
        "",
        "## Usage notes",
        "",
        "- Treat each sanctuary's official website as the authoritative source for current visiting, volunteering, donation, and contact information.",
        "- Link to the canonical profile URL shown above when referencing this directory.",
        "- The directory covers the Pacific Northwest region commonly called Cascadia; inclusion does not imply ownership or endorsement by listed organizations.",
        ""
    ])
    return {
        SITEMAP_PATH: "\n".join(sitemap_lines) + "\n",
        ROBOTS_PATH: "User-agent: *\nAllow: /\n\nSitemap: https://cascadiasanctuaries.org/sitemap.xml\n",
        LLMS_PATH: "\n".join(llms_lines)
    }


# build all site outputs
def build_site(sanctuaries=None, snapshot_path=None):
    """Render every output before publishing the complete generated site."""
    # use the checked-in snapshot by default
    if sanctuaries is None:
        sanctuaries = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    validate_route_slugs(sanctuaries)
    source_template = SOURCE_PAGE.read_text(encoding="utf-8")
    root_page = replace_structured_data(source_template, directory_structured_data(sanctuaries))
    generated_pages = {}

    # generate sanctuary routes
    for sanctuary in sanctuaries:
        slug = sanctuary_route_slug(sanctuary)
        canonical_url = f"{SITE_URL}/{slug}/"
        city_state = ", ".join(
            value for value in [str(sanctuary.get("city") or "").strip(), str(sanctuary.get("state") or "").strip()]
            if value
        )
        description = (
            f"Find {sanctuary['name']}{f' in {city_state}' if city_state else ''}, including "
            "location, contact details, and ways to support the sanctuary."
        )
        route_page = render_page(
            root_page,
            f"{sanctuary['name']} | Cascadia Sanctuaries",
            description,
            canonical_url,
            sanctuary_structured_data(sanctuary, canonical_url, description),
            "index, follow, max-image-preview:large, max-snippet:-1"
        )
        route_page = render_sanctuary_body(route_page, sanctuary)
        generated_pages[PROJECT_ROOT / slug / "index.html"] = route_page

    email_description = "Contact information for farm animal sanctuaries across Cascadia."
    email_page = render_page(
        root_page,
        "Sanctuary Email Directory | Cascadia Sanctuaries",
        email_description,
        f"{SITE_URL}/emails/",
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "url": f"{SITE_URL}/emails/",
            "name": "Sanctuary Email Directory",
            "description": email_description,
            "isPartOf": {"@id": f"{SITE_URL}/#website"},
            "inLanguage": "en-US"
        },
        "noindex, follow"
    )
    email_page = render_email_body(email_page, sanctuaries)
    generated_pages[PROJECT_ROOT / "emails" / "index.html"] = email_page
    discovery_files = render_discovery_files(sanctuaries)
    owned_directories = generated_route_directories()
    planned_directories = {route_path.parent for route_path in generated_pages}

    # protect unrelated route directories
    for route_path in generated_pages:
        route_directory = route_path.parent

        # reject unexpected directory ownership
        if route_directory.exists() and route_directory not in owned_directories:
            raise ValueError(f"Refusing to overwrite existing directory: {route_directory.name}")

    # serialize a requested snapshot only after rendering succeeds
    snapshot_content = None
    if snapshot_path is not None:
        snapshot_content = json.dumps(sanctuaries, ensure_ascii=False, indent=2) + "\n"

    # publish validated route outputs without deleting current routes
    for route_path, route_page in generated_pages.items():
        write_text(route_path, route_page)

    # publish shared artifacts after all route shells succeed
    if snapshot_path is not None:
        write_text(snapshot_path, snapshot_content)

    write_text(SOURCE_PAGE, root_page)

    # publish validated discovery outputs
    for discovery_path, discovery_content in discovery_files.items():
        write_text(discovery_path, discovery_content)

    # remove stale owned routes last
    for stale_directory in owned_directories - planned_directories:
        shutil.rmtree(stale_directory)

    print(f"Generated {len(sanctuaries)} sanctuary routes, email route, sitemap, and llms.txt")


# run from the command line
if __name__ == "__main__":
    build_site()
