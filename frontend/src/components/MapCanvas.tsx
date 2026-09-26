"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { categoryLabel, statusLabel } from "@/data/places";
import type { Place } from "@/lib/types";
import { recoloredOsmLayer } from "@/lib/map-tiles";
import { videoCredit } from "@/lib/video";

type Leaflet = typeof import("leaflet");
type MapParts = { leaflet: Leaflet; map: LeafletMap; layer: LayerGroup };

const SOHO: [number, number] = [40.7265, -74.0005];
const NO_ROUTE: Place[] = [];

export function MapCanvas({
  places,
  route = NO_ROUTE,
  selectedId,
  focus,
  onSelect,
}: {
  places: Place[];
  /** Loop stops in order. When non-empty, drawn as a numbered route. */
  route?: Place[];
  selectedId?: string;
  /** Move the map here; change `key` to move again to the same spot. */
  focus?: { lat: number; lng: number; zoom: number; key: number };
  onSelect: (place: Place) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const shownRef = useRef<Place[]>([]);
  const [parts, setParts] = useState<MapParts | null>(null);

  useEffect(() => {
    onSelectRef.current = onSelect;
    shownRef.current = [...places, ...route];
  }, [onSelect, places, route]);

  // Create the Leaflet map once (Leaflet touches `window`, so load it client-side).
  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    import("leaflet").then((leaflet) => {
      if (cancelled || !mapEl.current) return;
      map = leaflet.map(mapEl.current, { zoomControl: false, maxZoom: 18 }).setView(SOHO, 14);
      recoloredOsmLayer(leaflet).addTo(map);
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
          zIndexOffset: selected ? 1000 : 0,
        })
        .on("click", () => onSelectRef.current(place));

      if (canHover && !selected) {
        marker.bindTooltip(previewHtml(place), {
          direction: "top",
          offset: [0, -54],
          className: "place-tooltip",
          opacity: 1,
        });
      }
      marker.addTo(layer);
      // divIcons ignore `alt`, so label the pin for screen readers ourselves.
      marker.getElement()?.setAttribute("aria-label", place.name);
    });
  }, [parts, places, route, selectedId]);

  // Glide the selected pin into the open area above the bottom sheet,
  // so its glow and name label aren't hidden behind the sheet.
  useEffect(() => {
    if (!parts || !selectedId) return;
    const place = shownRef.current.find((p) => p.id === selectedId);
    if (!place) return;
    const { map } = parts;
    const pin = map.latLngToContainerPoint([place.lat, place.lng]);
    const size = map.getSize();
    map.panBy([pin.x - size.x / 2, pin.y - size.y * 0.3], { animate: true, duration: 0.35 });
  }, [parts, selectedId]);

  useEffect(() => {
    if (!parts || !focus) return;
    parts.map.setView([focus.lat, focus.lng], focus.zoom, { animate: true });
  }, [parts, focus]);

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
    ? `&#9654; ${escapeHtml(videoCredit(place.video, " · "))}`
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

const TIKTOK_GLYPH =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M16.6 2h-3.4v13.3a3 3 0 1 1-2.2-2.9V9a6.5 6.5 0 1 0 5.6 6.4V8.6a8 8 0 0 0 4.6 1.5V6.7a4.6 4.6 0 0 1-4.6-4.7Z"/></svg>';
const INSTAGRAM_GLYPH =
  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#B63A2B" stroke-width="2.6"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="0.6" fill="#B63A2B"/></svg>';

/** Smaller image for the pin (Unsplash URLs can be resized; others are used as-is). */
function thumb(url: string) {
  return url.includes("images.unsplash.com") ? url.replace(/w=\d+/, "w=160") : url;
}

// Round photo pin with a pointer: the ring color says what it is
// (red = saved, dark = event today, white = LocalLoop find), a corner badge
// says where it was saved from, and the selected pin grows, glows and shows its name.
function pinIcon(leaflet: Leaflet, place: Place, stopNumber: number, selected: boolean) {
  const size = selected ? 58 : 46;
  const kind = stopNumber > 0 ? "saved" : place.kind;
  const platform = place.video?.platform ?? (place.source === "instagram" ? "instagram" : place.source === "tiktok" ? "tiktok" : null);

  const badge = platform
    ? `<span class="pp-badge pp-badge--${platform}">${platform === "tiktok" ? TIKTOK_GLYPH : INSTAGRAM_GLYPH}</span>`
    : "";
  const corner =
    stopNumber > 0
      ? `<span class="pp-number">${stopNumber}</span>`
      : place.kind === "event"
        ? '<span class="pp-tag">Today</span>'
        : "";
  const label = selected ? `<span class="pp-label"><i></i>${escapeHtml(place.name)}</span>` : "";

  return leaflet.divIcon({
    className: "",
    iconSize: [size, size + 8],
    iconAnchor: [size / 2, size + 8],
    html: `<div class="pp pp--${kind}${selected ? " pp--selected" : ""}" style="--pp:${size}px">
      ${selected ? '<span class="pp-halo"></span>' : ""}
      <span class="pp-photo" style="background-image:url('${escapeHtml(thumb(place.image))}')"></span>
      <span class="pp-pointer"></span>
      ${badge}${corner}${label}
    </div>`,
  });
}
