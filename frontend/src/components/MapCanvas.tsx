"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { categoryLabel, statusLabel } from "@/data/places";
import type { Place } from "@/lib/types";
import { platformName } from "@/lib/video";

type Leaflet = typeof import("leaflet");
type MapParts = { leaflet: Leaflet; map: LeafletMap; layer: LayerGroup };

const SOHO: [number, number] = [40.7265, -74.0005];
const NO_ROUTE: Place[] = [];

export function MapCanvas({
  places,
  route = NO_ROUTE,
  selectedId,
  onSelect,
}: {
  places: Place[];
  /** Loop stops in order. When non-empty, drawn as a numbered route. */
  route?: Place[];
  selectedId?: string;
  onSelect: (place: Place) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [parts, setParts] = useState<MapParts | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the Leaflet map once (Leaflet touches `window`, so load it client-side).
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    import("leaflet").then((leaflet) => {
      if (cancelled || !mapEl.current) return;
      map = leaflet.map(mapEl.current, { zoomControl: false, maxZoom: 18 }).setView(SOHO, 14);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map);
      setParts({ leaflet, map, layer: leaflet.layerGroup().addTo(map) });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  // Redraw markers + route whenever the inputs change.
  useEffect(() => {
    if (!parts) return;
    const { leaflet, layer } = parts;
    layer.clearLayers();

    if (route.length > 1) {
      leaflet
        .polyline(
          route.map((place) => [place.lat, place.lng]),
          { color: "#B63A2B", weight: 3, opacity: 0.9, dashArray: "2 8", lineCap: "round" },
        )
        .addTo(layer);
    }

    const routeIds = route.map((place) => place.id);
    const shown = [...places, ...route.filter((p) => !places.includes(p))];

    // Hover previews only make sense with a mouse; on phones a tap opens the sheet.
    const canHover = window.matchMedia("(hover: hover)").matches;

    shown.forEach((place) => {
      const stopNumber = routeIds.indexOf(place.id) + 1;
      const selected = place.id === selectedId;
      const marker = leaflet
        .marker([place.lat, place.lng], {
          icon: pinIcon(leaflet, place, stopNumber, selected),
          alt: place.name,
          keyboard: true,
          riseOnHover: true,
        })
        .on("click", () => onSelectRef.current(place));

      if (canHover && !selected) {
        marker.bindTooltip(previewHtml(place), {
          direction: "top",
          offset: [0, -34],
          className: "place-tooltip",
          opacity: 1,
        });
      }
      marker.addTo(layer);
      // divIcons ignore `alt`, so label the pin for screen readers ourselves.
      marker.getElement()?.setAttribute("aria-label", place.name);
    });
  }, [parts, places, route, selectedId]);

  // Bring the selected place into view (e.g. a spot that was just added).
  useEffect(() => {
    if (!parts || !selectedId) return;
    const place = places.find((p) => p.id === selectedId);
    if (place && !parts.map.getBounds().contains([place.lat, place.lng])) {
      parts.map.setView([place.lat, place.lng], parts.map.getZoom(), { animate: false });
    }
  }, [parts, places, selectedId]);

  // Zoom to the loop only when the route itself changes, not on every selection.
  useEffect(() => {
    if (!parts || route.length < 2) return;
    parts.map.fitBounds(
      parts.leaflet.latLngBounds(route.map((place) => [place.lat, place.lng])),
      { padding: [60, 60], maxZoom: 16, animate: false },
    );
  }, [parts, route]);

  return <div ref={mapEl} className="absolute inset-0" role="region" aria-label="Map of places" />;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Small card shown when hovering a pin: photo, what it is, where it came from.
function previewHtml(place: Place) {
  const source = place.video
    ? `&#9654; ${escapeHtml(place.video.creator)} · ${platformName(place.video)}`
    : escapeHtml(statusLabel(place));
  const description = place.description
    ? `<p class="pt-desc">${escapeHtml(place.description)}</p>`
    : "";
  const play = place.video ? '<span class="pt-play">&#9654;</span>' : "";

  return `<div class="pt-card">
    <div class="pt-thumb"><img src="${escapeHtml(place.image)}" alt="" />${play}</div>
    <div class="pt-body">
      <p class="pt-source">${source}</p>
      <p class="pt-name">${escapeHtml(place.name)}</p>
      <p class="pt-meta">${categoryLabel(place.category)} · ${escapeHtml(place.neighborhood)} · ${escapeHtml(place.distance)}</p>
      ${description}
      <p class="pt-hint">${place.video ? "Click for the video &amp; details" : "Click for details"}</p>
    </div>
  </div>`;
}

const PIN_PATH =
  "M14 1C7 1 1.5 6.4 1.5 13.2c0 8.7 10.3 19.6 11.6 21a1.2 1.2 0 0 0 1.8 0c1.3-1.4 11.6-12.3 11.6-21C26.5 6.4 21 1 14 1Z";

// Teardrop map pin with a round window: red = saved, dark = event, white = LocalLoop find.
// Loop stops show their number in the window.
function pinIcon(leaflet: Leaflet, place: Place, stopNumber: number, selected: boolean) {
  const scale = selected ? 1.3 : 1;
  const width = Math.round(28 * scale);
  const height = Math.round(36 * scale);

  let fill = "#FFFFFF";
  let stroke = "#7A6A63";
  let windowFill = "#FBE8E4";
  if (place.kind === "saved" || stopNumber > 0) {
    fill = "#B63A2B";
    stroke = "#9E2F22";
    windowFill = "#FFFFFF";
  } else if (place.kind === "event") {
    fill = "#231A11";
    stroke = "#231A11";
    windowFill = "#FFFFFF";
  }

  const label =
    stopNumber > 0
      ? `<text x="14" y="17.4" text-anchor="middle" font-size="10" font-weight="800" fill="#B63A2B" font-family="var(--font-plus-jakarta),sans-serif">${stopNumber}</text>`
      : "";

  return leaflet.divIcon({
    className: "",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    tooltipAnchor: [0, 0],
    html: `<svg width="${width}" height="${height}" viewBox="0 0 28 36" style="display:block;overflow:visible;filter:drop-shadow(0 2px 2px rgba(35,26,17,.25))">
      ${selected ? '<ellipse cx="14" cy="35" rx="9" ry="2.6" fill="none" stroke="#B63A2B" stroke-width="1.4"/>' : ""}
      <path d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
      <circle cx="14" cy="13.5" r="${stopNumber > 0 ? 7 : 5.2}" fill="${windowFill}"/>
      ${label}
    </svg>`,
  });
}
