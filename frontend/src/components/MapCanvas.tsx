"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { Place } from "@/lib/types";

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
      leaflet.control.zoom({ position: "bottomright" }).addTo(map);
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

    shown.forEach((place) => {
      const stopNumber = routeIds.indexOf(place.id) + 1;
      leaflet
        .marker([place.lat, place.lng], {
          icon: pinIcon(leaflet, place, stopNumber, place.id === selectedId),
          title: place.name,
          alt: place.name,
          keyboard: true,
        })
        .on("click", () => onSelectRef.current(place))
        .addTo(layer);
    });
  }, [parts, places, route, selectedId]);

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

const HEART =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 20.5 4.6 13.2a4.8 4.8 0 0 1 6.8-6.8l.6.6.6-.6a4.8 4.8 0 0 1 6.8 6.8L12 20.5Z"/></svg>';
const CALENDAR =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>';

function pinIcon(leaflet: Leaflet, place: Place, stopNumber: number, selected: boolean) {
  const size = selected ? 36 : 28;
  let background = "#FFFFFF";
  let border = "#7A6A63";
  let inner = '<span style="width:8px;height:8px;border-radius:999px;background:#7A6A63"></span>';

  if (stopNumber > 0) {
    background = "#B63A2B";
    border = "#FFFFFF";
    inner = `<span style="color:white;font:700 13px/1 var(--font-plus-jakarta),sans-serif">${stopNumber}</span>`;
  } else if (place.kind === "saved") {
    background = "#B63A2B";
    border = "#FFFFFF";
    inner = HEART;
  } else if (place.kind === "event") {
    background = "#231A11";
    border = "#FFFFFF";
    inner = CALENDAR;
  }

  const ring = selected ? ",0 0 0 4px rgba(182,58,43,.25)" : "";
  return leaflet.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;border-radius:999px;background:${background};border:2px solid ${border};box-shadow:0 1px 3px rgba(35,26,17,.25)${ring};transition:all .15s">${inner}</div>`,
  });
}
