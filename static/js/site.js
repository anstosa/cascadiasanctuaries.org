"use strict";

const SANCTUARIES_DATA_URL = "/static/data/sanctuaries.json";
const DEFAULT_CENTER = [-120.4, 46.7];
const DEFAULT_ZOOM = 4.5;
const MARKER_RADIUS = 15;
const SELECTED_ZOOM = 8;
const DIRECTORY_PATH = "/";
const EMAILS_PATH = "/emails/";
const SITE_URL = "https://cascadiasanctuaries.org";
const DIRECTORY_TITLE = "Pacific Northwest Farm Sanctuaries | Cascadia Sanctuaries";
const DIRECTORY_DESCRIPTION =
  "Explore farm animal sanctuaries across Washington, Oregon, British Columbia, Idaho, and Montana. Find locations, contact details, and ways to support.";

const state = {
  bounds: null,
  directoryFitActive: true,
  map: null,
  mapReady: false,
  markers: [],
  previousCamera: null,
  sanctuaries: [],
  selected: null
};

const elements = {
  app: document.querySelector("#directory-app"),
  clearSearch: document.querySelector("#clear-search"),
  detailContent: document.querySelector("#detail-content"),
  detailPanel: document.querySelector("#detail-panel"),
  discoveryPanel: document.querySelector(".discovery-panel"),
  emailList: document.querySelector("#email-list"),
  emailView: document.querySelector("#email-view"),
  mapStatus: document.querySelector("#map-status"),
  mapStage: document.querySelector(".map-stage"),
  canonicalUrl: document.querySelector("#canonical-url"),
  openGraphDescription: document.querySelector("#open-graph-description"),
  openGraphTitle: document.querySelector("#open-graph-title"),
  openGraphUrl: document.querySelector("#open-graph-url"),
  pageDescription: document.querySelector("#page-description"),
  pageRobots: document.querySelector("#page-robots"),
  resultCount: document.querySelector("#result-count"),
  search: document.querySelector("#sanctuary-search"),
  searchForm: document.querySelector("#search-form"),
  searchResults: document.querySelector("#search-results"),
  structuredData: document.querySelector("#structured-data"),
  twitterDescription: document.querySelector("#twitter-description"),
  twitterTitle: document.querySelector("#twitter-title")
};

// escape untrusted content
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// normalize web links
function normalizeWebsite(value) {
  const candidate = String(value ?? "").trim();
  const href = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  // parse the web url
  try {
    const url = new URL(href);

    // allow web protocols only
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.href;
  } catch {
    // reject malformed urls
    return "";
  }
}

// validate map coordinates
function hasCoordinates(sanctuary) {
  const longitude = sanctuary.longitude;
  const latitude = sanctuary.latitude;
  return (
    longitude !== "" &&
    latitude !== "" &&
    longitude !== null &&
    latitude !== null &&
    Number.isFinite(Number(longitude)) &&
    Number.isFinite(Number(latitude))
  );
}

// format phone numbers
function formatPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  // format north american numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}–${digits.slice(6)}`;
  }

  return String(value ?? "");
}

// render shared icons
function icon(id) {
  return `<svg aria-hidden="true"><use href="#icon-${id}"></use></svg>`;
}

// build detail links
function detailLink({ href, iconId, label }) {
  // omit empty links
  if (!href || !label) {
    return "";
  }

  return `
    <a class="detail-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
      ${icon(iconId)}
      <span>${escapeHtml(label)}</span>
      ${icon("external")}
    </a>
  `;
}

// build social links
function socialLinks(sanctuary) {
  const platforms = [
    {
      label: "Instagram",
      href: sanctuary.instagram ? `https://instagram.com/${sanctuary.instagram}` : "",
      icon: "/static/media/instagram-brands.813fd06b51b26e101fbbdde32e64af13.svg"
    },
    {
      label: "Facebook",
      href: sanctuary.facebook ? `https://facebook.com/${sanctuary.facebook}` : "",
      icon: "/static/media/facebook-f-brands.8adca75361b744d17bbeb17b9c804d9d.svg"
    },
    {
      label: "Twitter",
      href: sanctuary.twitter ? `https://twitter.com/${sanctuary.twitter}` : "",
      icon: "/static/media/twitter-brands.7b0966c673ac146ae16dfeaa6ecc2eb1.svg"
    },
    {
      label: "TikTok",
      href: sanctuary.tiktok ? `https://tiktok.com/@${sanctuary.tiktok}` : "",
      icon: "/static/media/tiktok-brands.2cd5bfa897010051ff6d10c8a1c370ae.svg"
    },
    {
      label: "YouTube",
      href: sanctuary.youtube ? normalizeWebsite(sanctuary.youtube) : "",
      icon: "/static/media/youtube-brands.87350b41a36870581ed6bbca31d713b0.svg"
    }
  ];

  // render configured platforms
  return platforms
    .filter((platform) => platform.href)
    .map(
      (platform) => `
        <a
          class="detail-social-link"
          href="${escapeHtml(platform.href)}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${escapeHtml(platform.label)}"
          title="${escapeHtml(platform.label)}"
        >
          <img src="${platform.icon}" alt="">
        </a>
      `
    )
    .join("");
}

// build stable sanctuary slugs
function sanctuarySlug(sanctuary) {
  return String(sanctuary.slug ?? sanctuary.name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// build canonical sanctuary routes
function sanctuaryPath(sanctuary) {
  return `/${sanctuarySlug(sanctuary)}/`;
}

// update browser history
function updatePath(path, replace = false) {
  // avoid duplicate history entries
  if (window.location.pathname === path) {
    return;
  }

  const method = replace ? "replaceState" : "pushState";
  window.history[method](null, "", path);
}

// migrate legacy hash links
function migrateLegacyHashRoute() {
  // ignore clean routes
  if (!window.location.hash.startsWith("#/")) {
    return;
  }

  const legacySlug = window.location.hash.slice(2).replace(/^\/+|\/+$/g, "");
  const path = legacySlug ? `/${legacySlug}/` : DIRECTORY_PATH;
  window.history.replaceState(null, "", path);
}

// identify the shared website
function websiteStructuredData() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: "Cascadia Sanctuaries",
    alternateName: "Cascadia Farm Sanctuaries",
    inLanguage: "en-US"
  };
}

// describe the directory route
function directoryStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteStructuredData(),
      {
        "@type": "CollectionPage",
        "@id": `${SITE_URL}/#directory`,
        url: `${SITE_URL}/`,
        name: "Farm sanctuaries of the Pacific Northwest",
        description: DIRECTORY_DESCRIPTION,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@type": "Thing", name: "Farm animal sanctuaries" },
        spatialCoverage: ["Washington", "Oregon", "British Columbia", "Idaho", "Montana"].map(
          (name) => ({ "@type": "AdministrativeArea", name })
        ),
        mainEntity: {
          "@type": "ItemList",
          name: "Cascadia sanctuary directory",
          numberOfItems: state.sanctuaries.length,
          itemListOrder: "https://schema.org/ItemListUnordered",
          itemListElement: state.sanctuaries.map((sanctuary, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: sanctuary.name,
            url: `${SITE_URL}${sanctuaryPath(sanctuary)}`
          }))
        },
        inLanguage: "en-US"
      }
    ]
  };
}

// collect sanctuary profiles
function sanctuarySameAs(sanctuary) {
  const profiles = [
    sanctuary.website ? normalizeWebsite(sanctuary.website) : "",
    sanctuary.facebook ? `https://facebook.com/${sanctuary.facebook}` : "",
    sanctuary.instagram ? `https://instagram.com/${sanctuary.instagram}` : "",
    sanctuary.twitter ? `https://twitter.com/${sanctuary.twitter}` : "",
    sanctuary.tiktok ? `https://tiktok.com/@${String(sanctuary.tiktok).replace(/^@/, "")}` : "",
    sanctuary.youtube ? normalizeWebsite(sanctuary.youtube) : ""
  ];
  return profiles.filter(Boolean);
}

// describe a sanctuary route
function sanctuaryStructuredData(sanctuary, canonicalUrl, description) {
  const cityState = [sanctuary.city, sanctuary.state].filter(Boolean);
  const organization = {
    "@type": "Organization",
    "@id": `${canonicalUrl}#sanctuary`,
    name: sanctuary.name,
    url: sanctuary.website ? normalizeWebsite(sanctuary.website) : canonicalUrl,
    mainEntityOfPage: { "@id": `${canonicalUrl}#webpage` }
  };

  // include available addresses
  if (sanctuary.address || cityState.length) {
    organization.address = {
      "@type": "PostalAddress",
      streetAddress: sanctuary.address || "",
      addressLocality: sanctuary.city || "",
      addressRegion: sanctuary.state || ""
    };
  }

  // include available coordinates
  if (hasCoordinates(sanctuary)) {
    organization.geo = {
      "@type": "GeoCoordinates",
      latitude: sanctuary.latitude,
      longitude: sanctuary.longitude
    };
  }

  const sameAs = sanctuarySameAs(sanctuary);

  // include public profiles
  if (sameAs.length) {
    organization.sameAs = sameAs;
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteStructuredData(),
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: `${sanctuary.name} | Cascadia Sanctuaries`,
        description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": `${canonicalUrl}#sanctuary` },
        inLanguage: "en-US"
      },
      organization
    ]
  };
}

// describe the email utility route
function emailStructuredData(description) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: `${SITE_URL}${EMAILS_PATH}`,
    name: "Sanctuary Email Directory",
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    inLanguage: "en-US"
  };
}

// describe the active route
function updateDocumentMetadata(sanctuary = null, isEmailView = false) {
  const cityState = sanctuary
    ? [sanctuary.city, sanctuary.state].filter(Boolean).join(", ")
    : "";
  const title = sanctuary
    ? `${sanctuary.name} | Cascadia Sanctuaries`
    : isEmailView
      ? "Sanctuary Email Directory | Cascadia Sanctuaries"
      : DIRECTORY_TITLE;
  const description = sanctuary
    ? `Find ${sanctuary.name}${cityState ? ` in ${cityState}` : ""}, including location, contact details, and ways to support the sanctuary.`
    : isEmailView
      ? "Contact information for farm animal sanctuaries across Cascadia."
      : DIRECTORY_DESCRIPTION;
  const path = sanctuary ? sanctuaryPath(sanctuary) : isEmailView ? EMAILS_PATH : DIRECTORY_PATH;
  const canonicalUrl = `${SITE_URL}${path}`;

  document.title = title;
  elements.pageDescription.content = description;
  elements.openGraphTitle.content = title;
  elements.openGraphDescription.content = description;
  elements.openGraphUrl.content = canonicalUrl;
  elements.twitterTitle.content = title;
  elements.twitterDescription.content = description;
  elements.canonicalUrl.href = canonicalUrl;
  elements.pageRobots.content = isEmailView
    ? "noindex, follow"
    : "index, follow, max-image-preview:large, max-snippet:-1";

  // synchronize structured data with history navigation
  if (sanctuary) {
    elements.structuredData.textContent = JSON.stringify(
      sanctuaryStructuredData(sanctuary, canonicalUrl, description)
    );
  } else if (isEmailView) {
    elements.structuredData.textContent = JSON.stringify(emailStructuredData(description));
  } else if (state.sanctuaries.length) {
    elements.structuredData.textContent = JSON.stringify(directoryStructuredData());
  }
}

// center within the uncovered map
function selectedMarkerOffset() {
  const mapRect = elements.mapStage.getBoundingClientRect();
  const detailRect = elements.detailPanel.getBoundingClientRect();
  const mapWidth = mapRect.width;
  const detailWidth = detailRect.width;
  const isFullWidth = Math.abs(mapWidth - detailWidth) <= 1;

  // center above full-width cards
  if (isFullWidth) {
    return [0, 0];
  }

  const discoveryRect = elements.discoveryPanel.getBoundingClientRect();
  const discoveryVisible = window.getComputedStyle(elements.discoveryPanel).display !== "none";
  const edgeMargin = Math.max(0, mapRect.right - detailRect.right);
  const visibleLeft = discoveryVisible
    ? discoveryRect.right + edgeMargin
    : mapRect.left + edgeMargin;
  const visibleRight = detailRect.left - edgeMargin;
  const visibleCenter = (visibleLeft + visibleRight) / 2;
  return [visibleCenter - (mapRect.left + mapWidth / 2), 0];
}

// focus the selected marker
function focusSanctuary(sanctuary, duration = 650) {
  // require a ready mapped sanctuary
  if (!state.mapReady || !hasCoordinates(sanctuary)) {
    return;
  }

  state.map.easeTo({
    center: [Number(sanctuary.longitude), Number(sanctuary.latitude)],
    duration,
    offset: selectedMarkerOffset(),
    zoom: Math.max(state.map.getZoom(), SELECTED_ZOOM)
  });
}

// capture the current map view
function captureMapCamera() {
  const center = state.map.getCenter();
  return {
    bearing: state.map.getBearing(),
    center: [center.lng, center.lat],
    padding: state.map.getPadding(),
    pitch: state.map.getPitch(),
    zoom: state.map.getZoom()
  };
}

// restore the previous map view
function restoreMapCamera() {
  const previousCamera = state.previousCamera;
  state.previousCamera = null;

  // restore captured navigation
  if (state.mapReady && previousCamera) {
    state.map.easeTo({
      ...previousCamera,
      duration: 650
    });
    return;
  }

  fitDirectoryBounds();
}

// open sanctuary details
function selectSanctuary(sanctuary, updateRoute = true) {
  // remember the pre-selection view once
  if (!state.selected && state.mapReady) {
    state.previousCamera = captureMapCamera();
  }

  state.selected = sanctuary;

  // expose the selected sanctuary
  if (updateRoute) {
    updatePath(sanctuaryPath(sanctuary));
  }

  updateDocumentMetadata(sanctuary);

  // update marker emphasis
  state.markers.forEach((item) => {
    item.element.classList.toggle("is-active", item.sanctuary === sanctuary);
  });

  const cityState = [sanctuary.city, sanctuary.state].filter(Boolean).join(", ");
  const address = [sanctuary.address, cityState].filter(Boolean).join(", ");
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "";
  const socials = socialLinks(sanctuary);
  const facts = [
    sanctuary.founded
      ? `<div class="detail-fact"><span class="detail-fact-label">Founded</span><span class="detail-fact-value">${escapeHtml(sanctuary.founded)}</span></div>`
      : "",
    sanctuary.residents
      ? `<div class="detail-fact"><span class="detail-fact-label">Residents</span><span class="detail-fact-value">${escapeHtml(sanctuary.residents)}</span></div>`
      : ""
  ].filter(Boolean);

  elements.detailContent.innerHTML = `
    <p class="detail-kicker">Sanctuary profile</p>
    <h2>${escapeHtml(sanctuary.name)}</h2>
    <div class="detail-meta">
      <p class="detail-place">${escapeHtml(cityState || "Cascadia")}</p>
      ${socials ? `<div class="detail-social-icons">${socials}</div>` : ""}
    </div>
    ${facts.length ? `<div class="detail-facts">${facts.join("")}</div>` : ""}
    <div class="detail-links">
      ${detailLink({ href: mapsUrl, iconId: "map-pin", label: address })}
      ${detailLink({ href: sanctuary.website ? normalizeWebsite(sanctuary.website) : "", iconId: "globe", label: sanctuary.website })}
      ${detailLink({ href: sanctuary.email ? `mailto:${sanctuary.email}` : "", iconId: "mail", label: sanctuary.email })}
      ${detailLink({ href: sanctuary.phone ? `tel:+1${String(sanctuary.phone).replace(/\D/g, "")}` : "", iconId: "phone", label: formatPhone(sanctuary.phone) })}
    </div>
  `;

  elements.detailPanel.classList.add("is-open");
  elements.detailPanel.setAttribute("aria-hidden", "false");
  elements.mapStage.classList.add("has-open-detail");
  // resize to the uncovered mobile viewport
  state.map?.resize();

  focusSanctuary(sanctuary);
}

// close sanctuary details
function closeDetails(updateRoute = true, restoreCamera = true) {
  const hadSelection = Boolean(state.selected);
  state.selected = null;
  elements.detailPanel.classList.remove("is-open");
  elements.detailPanel.setAttribute("aria-hidden", "true");
  elements.mapStage.classList.remove("has-open-detail");
  // restore the full map viewport
  state.map?.resize();

  // return to the directory route
  if (updateRoute && hadSelection) {
    updatePath(DIRECTORY_PATH);
  }

  // restore directory metadata
  if (window.location.pathname !== EMAILS_PATH) {
    updateDocumentMetadata();
  }

  // restore or discard the saved view
  if (hadSelection) {
    if (restoreCamera) {
      restoreMapCamera();
    } else {
      state.previousCamera = null;
    }
  }

  // clear marker emphasis
  state.markers.forEach((item) => {
    item.element.classList.remove("is-active");
  });
}

// measure the visible directory map
function directoryFitPadding() {
  const mapRect = elements.mapStage.getBoundingClientRect();
  const panelRect = elements.discoveryPanel.getBoundingClientRect();
  const edgeMargin = Math.max(0, Math.ceil(panelRect.left - mapRect.left));
  const markerPadding = edgeMargin + MARKER_RADIUS;
  const isFullWidth = panelRect.width >= mapRect.width - edgeMargin * 2 - 1;

  // reserve the mobile card above the map
  if (isFullWidth) {
    return {
      top: Math.ceil(panelRect.bottom - mapRect.top) + markerPadding,
      right: markerPadding,
      bottom: markerPadding,
      left: markerPadding
    };
  }

  return {
    top: markerPadding,
    right: markerPadding,
    bottom: markerPadding,
    left: Math.ceil(panelRect.right - mapRect.left) + markerPadding
  };
}

// fit the regional map
function fitDirectoryBounds(duration = 800) {
  // wait for bounds
  if (!state.map || !state.bounds) {
    return;
  }

  state.directoryFitActive = true;
  state.map.fitBounds(state.bounds, {
    duration,
    padding: directoryFitPadding(),
    retainPadding: false
  });
}

// create map markers
function addMarkers() {
  // create mapped markers
  state.sanctuaries.filter(hasCoordinates).forEach((sanctuary) => {
    const element = document.createElement("button");
    element.className = "sanctuary-marker";
    element.type = "button";
    element.setAttribute("aria-label", `View ${sanctuary.name}`);

    // open marker details
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      selectSanctuary(sanctuary);
    });

    const marker = new window.maplibregl.Marker({ element, anchor: "center" })
      .setLngLat([Number(sanctuary.longitude), Number(sanctuary.latitude)])
      .addTo(state.map);

    state.markers.push({ element, marker, sanctuary });
  });
}

// render search matches
function renderSearchResults(matches, query) {
  // hide empty search state
  if (!query) {
    elements.searchResults.classList.remove("is-visible");
    elements.searchResults.innerHTML = "";
    return;
  }

  elements.searchResults.classList.add("is-visible");

  // show no result guidance
  if (!matches.length) {
    elements.searchResults.innerHTML =
      '<p class="no-results">No sanctuaries match that search. Try a city, state or part of a name.</p>';
    return;
  }

  // build matching results
  elements.searchResults.innerHTML = matches
    .slice(0, 6)
    .map((sanctuary, index) => {
      const location = [sanctuary.city, sanctuary.state].filter(Boolean).join(", ");
      return `
        <a class="result-item" href="${sanctuaryPath(sanctuary)}" data-result-index="${index}">
          <span class="result-name">${escapeHtml(sanctuary.name)}</span>
          <span class="result-location">${escapeHtml(location)}</span>
          <span class="result-arrow" aria-hidden="true">→</span>
        </a>
      `;
    })
    .join("");

  elements.searchResults.querySelectorAll("[data-result-index]").forEach((button) => {
    // open result details
    button.addEventListener("click", (event) => {
      event.preventDefault();
      selectSanctuary(matches[Number(button.dataset.resultIndex)]);
    });
  });
}

// filter visible sanctuaries
function filterSanctuaries(value) {
  const query = value.trim().toLowerCase();
  // match key directory fields
  const matches = state.sanctuaries.filter((sanctuary) => {
    const haystack = [sanctuary.name, sanctuary.city, sanctuary.state, sanctuary.address]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  // update markers
  state.markers.forEach((item) => {
    item.element.classList.toggle("is-muted", !matches.includes(item.sanctuary));
  });

  const label = query
    ? `${matches.length} ${matches.length === 1 ? "sanctuary" : "sanctuaries"} found`
    : `${state.sanctuaries.length} sanctuaries across Cascadia`;
  elements.resultCount.textContent = label;
  elements.clearSearch.classList.toggle("is-visible", Boolean(query));
  renderSearchResults(matches, query);
}

// derive directory bounds
function calculateBounds() {
  // skip map-specific bounds without the renderer
  if (!window.maplibregl) {
    return null;
  }

  // collect mapped coordinates
  const coordinates = state.sanctuaries
    .filter(hasCoordinates)
    .map((sanctuary) => [
      Number(sanctuary.longitude),
      Number(sanctuary.latitude)
    ]);

  // require valid coordinates
  if (!coordinates.length) {
    return null;
  }

  const bounds = new window.maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
  // extend regional bounds
  coordinates.slice(1).forEach((coordinate) => {
    bounds.extend(coordinate);
  });
  return bounds;
}

// render ready map data
function renderMapDirectory() {
  // wait for map and data
  if (!state.mapReady || !state.sanctuaries.length) {
    return;
  }

  // wait for the directory route
  if (elements.app.hidden) {
    return;
  }

  // avoid duplicate markers
  if (!state.markers.length) {
    addMarkers();
  }

  // restore direct-linked selections
  if (state.selected) {
    selectSanctuary(state.selected, false);
  } else if (state.directoryFitActive) {
    fitDirectoryBounds(0);
  }
  elements.mapStatus.classList.add("is-hidden");
}

// synchronize the active path route
function syncPathRoute() {
  const wasEmailView = elements.app.hidden;
  const isEmailView = window.location.pathname === EMAILS_PATH;
  elements.app.hidden = isEmailView;
  elements.emailView.hidden = !isEmailView;

  // restore the visible map layout
  if (wasEmailView && !isEmailView && state.map) {
    window.requestAnimationFrame(() => {
      state.map.resize();

      // wait for map readiness
      if (!state.mapReady) {
        return;
      }

      renderMapDirectory();
    });
  }

  // render utility emails
  if (isEmailView && state.sanctuaries.length) {
    elements.emailList.textContent = state.sanctuaries
      .map((sanctuary) => sanctuary.email)
      .filter(Boolean)
      .join(", ");
  }

  // stop at the utility route
  if (isEmailView) {
    closeDetails(false);
    updateDocumentMetadata(null, true);
    return;
  }

  // clear the directory route
  if (window.location.pathname === DIRECTORY_PATH) {
    closeDetails(false);
    return;
  }

  // wait for directory data
  if (!state.sanctuaries.length) {
    return;
  }

  const routeSlug = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const sanctuary = state.sanctuaries.find(
    (candidate) => sanctuarySlug(candidate) === routeSlug
  );

  // repair unknown sanctuary routes
  if (!sanctuary) {
    closeDetails(false);
    updatePath(DIRECTORY_PATH, true);
    return;
  }

  selectSanctuary(sanctuary, false);
}

// load sanctuary data
async function loadSanctuaries() {
  try {
    const response = await fetch(SANCTUARIES_DATA_URL, { cache: "no-store" });

    // reject failed requests
    if (!response.ok) {
      throw new Error(`Directory request failed with ${response.status}`);
    }

    const data = await response.json();
    state.sanctuaries = data;
    state.bounds = calculateBounds();
    filterSanctuaries("");
    syncPathRoute();
    renderMapDirectory();
  } catch (error) {
    console.error(error);
    elements.resultCount.textContent = "Directory unavailable";
    elements.mapStatus.classList.add("is-error");
    elements.mapStatus.innerHTML = "<span>We could not load the sanctuary directory. Please refresh to try again.</span>";
  }
}

// initialize map experience
function initializeMap() {
  // load the local directory independently
  loadSanctuaries();

  // guard missing map library
  if (!window.maplibregl) {
    elements.mapStatus.classList.add("is-error");
    elements.mapStatus.textContent = "The map could not load. Please refresh to try again.";
    return;
  }

  // report renderer startup failures without disabling the directory
  try {
    state.map = new window.maplibregl.Map({
      container: "map",
      center: DEFAULT_CENTER,
      projection: "mercator",
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      zoom: DEFAULT_ZOOM,
      attributionControl: false
    });
  } catch (error) {
    console.error("Map initialization error", error);
    elements.mapStatus.classList.add("is-error");
    elements.mapStatus.textContent = "The map could not load. The sanctuary directory is still available.";
    return;
  }

  state.map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  state.map.addControl(new window.maplibregl.AttributionControl({ compact: true }), "bottom-left");

  // preserve intentional navigation
  state.map.on("movestart", (event) => {
    // detect user input
    if (event.originalEvent && !state.selected) {
      state.directoryFitActive = false;
    }
  });

  // close details from map
  state.map.on("click", () => {
    closeDetails();
  });

  // render data after map loads
  state.map.on("load", () => {
    state.mapReady = true;
    renderMapDirectory();
  });

  // report map errors
  state.map.on("error", (event) => {
    console.error("Map error", event.error);
  });
}

// wire interface controls
function bindControls() {
  // prevent form submission
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  // update live search
  elements.search.addEventListener("input", (event) => {
    filterSanctuaries(event.target.value);
  });

  // clear active search
  elements.clearSearch.addEventListener("click", () => {
    elements.search.value = "";
    filterSanctuaries("");
    elements.search.focus();
  });

  // close detail panel
  document.querySelector("#detail-close").addEventListener("click", () => {
    closeDetails();
  });

  // intercept internal route links
  document.querySelectorAll("[data-route]").forEach((link) => {
    // navigate without reloading
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      updatePath(link.getAttribute("href"));
      syncPathRoute();
    });
  });

  // restore history routes
  window.addEventListener("popstate", () => {
    syncPathRoute();
  });

  // preserve fit after resize
  window.addEventListener("resize", () => {
    // resize loaded map
    if (state.map) {
      state.map.resize();
    }

    // restore visible-area centering
    if (state.selected) {
      window.requestAnimationFrame(() => {
        focusSanctuary(state.selected, 0);
      });
    } else if (state.mapReady && state.directoryFitActive && !elements.app.hidden) {
      // refit the resized directory
      window.requestAnimationFrame(() => {
        fitDirectoryBounds(0);
      });
    }
  });
}

migrateLegacyHashRoute();
bindControls();
syncPathRoute();
initializeMap();

// settle the initial font layout
if (document.fonts) {
  document.fonts.ready.then(() => {
    // refit managed directory views
    if (state.mapReady && !state.selected && state.directoryFitActive && !elements.app.hidden) {
      fitDirectoryBounds(0);
    }
  });
}
