"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { places as demoPlaces } from "@/data/places";
import { applyVideoDetails, detailsFromVideo } from "@/lib/enrich";
import { areaName, coordsFromMapLink, formatMiles, milesBetween } from "@/lib/geo";
import { useLocation } from "@/lib/location-store";
import { CATEGORY_COST, categoryFromText, categoryImage, detectSource } from "@/lib/new-spot";
import type { Place, PlaceKind } from "@/lib/types";
import { videoFromLink } from "@/lib/video";

// The shared list of places, loaded from Supabase (NEXT_PUBLIC_SUPABASE_URL +
// a publishable/anon key). Only real data is shown: an empty table means an
// empty map. The built-in demo spots are used only when Supabase isn't
// configured at all (e.g. a teammate without keys). Spots added in the app are
// kept here too. Distances are measured live from the user's location, and
// neighborhood names come from OpenStreetMap when the table doesn't have them.

type PlacesState = {
  places: Place[];
  savedPlaces: Place[];
  getPlace: (id: string) => Place | undefined;
  addSpot: (place: Place) => void;
  isLoading: boolean;
  /** Set when Supabase is configured but couldn't be used. */
  error: string | null;
  /** Where the list came from. */
  dataSource: "supabase" | "demo";
};

const PlacesContext = createContext<PlacesState | null>(null);

// One client per browser tab, even if dev hot-reload evaluates this file twice.
const globalStore = globalThis as typeof globalThis & { __localloopSupabase?: SupabaseClient };

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key === "your-supabase-anon-key") return null;
  // Read-only catalog, no user accounts: skip Supabase Auth's session storage
  // (also avoids "Multiple GoTrueClient instances" warnings during hot reload).
  globalStore.__localloopSupabase ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return globalStore.__localloopSupabase;
}

const kinds: PlaceKind[] = ["saved", "event", "find"];

// Rough per-person estimates for Supabase `price_level` 1–3.
// Rough per-person estimates for Google-style price levels 0 (free) – 4 ($$$$).
const PRICE_LEVEL_COST: Record<number, number> = { 0: 0, 1: 12, 2: 25, 3: 45, 4: 80 };

function validUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Tags can be a Postgres text[] or a comma-separated string. */
function toTags(value: unknown) {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags = list.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
  return tags.length ? tags : undefined;
}

function toRating(row: Record<string, unknown>) {
  const score = Number(row.rating);
  const count = Number(row.rating_count ?? row.review_count ?? 0);
  return Number.isFinite(score) && score > 0 ? { score, count: Number.isFinite(count) ? count : 0 } : undefined;
}

/** "POINT(-74.0 40.7)" (PostGIS text) -> coordinates. */
function coordsFromPoint(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  return match ? { lat: Number(match[2]), lng: Number(match[1]) } : null;
}

function toPriceLevel(value: unknown): Place["priceLevel"] {
  if (value === null || value === undefined || value === "") return undefined;
  const level = Number(value);
  return level === 0 || level === 1 || level === 2 || level === 3 || level === 4 ? level : undefined;
}

/** Turn a Supabase row into a full Place, filling in what the table doesn't have. */
function toPlace(row: Record<string, unknown>): Place | null {
  const id = row.id;
  const name = row.name;
  const rawCategory = row.category;
  const mapLink = validUrl(row.map_link);
  // Coordinates: lat/lng columns, else the Google Maps link, else a PostGIS POINT in `location`.
  const fallback = coordsFromMapLink(mapLink) ?? coordsFromPoint(row.location);
  const lat = Number(row.lat ?? row.latitude ?? fallback?.lat);
  const lng = Number(row.lng ?? row.longitude ?? fallback?.lng);
  if (
    (typeof id !== "string" && typeof id !== "number") ||
    typeof name !== "string" ||
    !name.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const category = rawCategory == null ? null : categoryFromText(`${typeof rawCategory === "string" ? rawCategory : ""} ${name}`);
  const priceLevel = toPriceLevel(row.price_level);
  const link = validUrl(row.link);
  // Catalog rows are treated as saved locations unless explicitly marked otherwise.
  const saved = row.saved !== false;
  const rowKind = row.kind;
  // `location` may be an area ("SoHo"), an address (has a number), or a POINT (used above).
  const locationText = coordsFromPoint(row.location) ? undefined : text(row.location);
  const locationIsAddress = Boolean(locationText && /\d/.test(locationText));

  return {
    id: String(id),
    name: name.trim(),
    // Filled in from OpenStreetMap by the provider when the row doesn't say.
    neighborhood: locationText && !locationIsAddress ? locationText : "",
    category,
    distance: "", // computed live from the user's location
    estimatedCost: priceLevel != null ? PRICE_LEVEL_COST[priceLevel] : category ? CATEGORY_COST[category] : 0,
    priceLevel,
    saved,
    source: link ? detectSource(link) : null,
    lat,
    lng,
    image: validUrl(row.image) ?? categoryImage(category),
    link,
    mapLink,
    video: link ? videoFromLink(link) : undefined,
    savedAt: typeof row.created_at === "string" ? row.created_at : undefined,
    // Optional columns: used when the table has them.
    description: text(row.description),
    address: text(row.address) ?? (locationIsAddress ? locationText : undefined),
    hours: text(row.hours),
    mustTry: text(row.must_try),
    tags: toTags(row.tags),
    rating: toRating(row),
    kind:
      typeof rowKind === "string" && kinds.includes(rowKind as PlaceKind)
        ? (rowKind as PlaceKind)
        : category === "event"
          ? "event"
          : saved
            ? "saved"
            : "find",
  };
}

/**
 * Places from the backend extractor (POST /api/spots/extract) use slightly
 * different fields: address in `location`, `createdAt`, a placeholder photo,
 * and the raw caption as description. Map them onto what the UI shows; the
 * video-details step then fills in Loopie's summary, tags and real thumbnail.
 */
function normalizeSpot(place: Place & { createdAt?: string }): Place {
  const fromExtractor = typeof place.transcript === "string";
  const category = place.category;
  return {
    ...place,
    address: place.address ?? place.location,
    savedAt: place.savedAt ?? place.createdAt,
    image: fromExtractor || !place.image ? categoryImage(category) : place.image,
    // Let Loopie write the summary instead of showing the raw caption.
    description: fromExtractor ? undefined : place.description,
    estimatedCost: place.priceLevel != null ? PRICE_LEVEL_COST[place.priceLevel] : place.estimatedCost,
    neighborhood: place.neighborhood ?? "",
  };
}

async function loadSupabasePlaces(supabase: SupabaseClient): Promise<Place[]> {
  const table = process.env.NEXT_PUBLIC_SUPABASE_LOCATIONS_TABLE || "places";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_LOCATIONS_TABLE must be a valid table name.");
  }
  const { data, error } = await supabase
    .from(table)
    // "*" so optional columns (description, address, hours, tags, must_try,
    // image, rating) are picked up automatically if the table gains them.
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => toPlace(row as Record<string, unknown>))
    .filter((place): place is Place => place !== null);
}

export function PlacesProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseClient();
  const [places, setPlaces] = useState<Place[]>(supabase ? [] : demoPlaces);
  const [addedSpots, setAddedSpots] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"supabase" | "demo">(supabase ? "supabase" : "demo");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    loadSupabasePlaces(supabase)
      .then((rows) => {
        if (!active) return;
        setPlaces(rows);
        setDataSource("supabase");
        if (!rows.length) setError("No places saved yet. Tap “Add a spot” to add your first one.");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(`Couldn’t load places (${err instanceof Error ? err.message : "unknown error"}).`);
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [supabase]);

  // Places we've already tried to fill in, so a video with no caption can't loop.
  const triedIds = useRef(new Set<string>());

  // Fill in thin places from their TikTok (caption -> description, must-try,
  // tags, address; thumbnail -> photo). Each video is read once per session.
  useEffect(() => {
    const thin = [...addedSpots, ...places].filter(
      (place) =>
        place.video?.platform === "tiktok" &&
        (!place.description || (!place.mustTry && !place.tags)) &&
        !triedIds.current.has(place.id),
    );
    if (!thin.length) return;
    for (const place of thin) {
      triedIds.current.add(place.id);
      // No cleanup: results for other places must still land after the lists update.
      void detailsFromVideo(place.name, place.video!.url).then((details) => {
        if (!Object.keys(details).length) return;
        const patch = (list: Place[]) =>
          list.map((p) =>
            p.id === place.id ? applyVideoDetails(p, details, p.image === categoryImage(p.category)) : p,
          );
        setPlaces(patch);
        setAddedSpots(patch);
      });
    }
  }, [addedSpots, places]);

  // Real neighborhood names (OpenStreetMap) for places whose row doesn't have one.
  const [areaNames, setAreaNames] = useState<Record<string, string>>({});
  const lookedUp = useRef(new Set<string>());
  useEffect(() => {
    for (const place of [...addedSpots, ...places]) {
      if (place.neighborhood || lookedUp.current.has(place.id)) continue;
      lookedUp.current.add(place.id);
      void areaName(place).then((name) => {
        if (name) setAreaNames((current) => ({ ...current, [place.id]: name }));
      });
    }
  }, [addedSpots, places]);

  // Newest saves first, like a feed. Distances are measured live from where
  // you are, and left blank until your location is known.
  const here = useLocation().origin;
  const all = useMemo(
    () =>
      [...addedSpots, ...places].map((place) => ({
        ...place,
        neighborhood: place.neighborhood || areaNames[place.id] || "",
        distance: here ? formatMiles(milesBetween(here, place)) : "",
      })),
    [addedSpots, places, here, areaNames],
  );
  const addSpot = useCallback(
    (place: Place) => setAddedSpots((current) => [normalizeSpot(place), ...current.filter((p) => p.id !== place.id)]),
    [],
  );

  const value = useMemo<PlacesState>(
    () => ({
      places: all,
      savedPlaces: all.filter((place) => place.saved),
      getPlace: (id) => all.find((place) => place.id === id),
      addSpot,
      isLoading,
      error,
      dataSource,
    }),
    [all, addSpot, isLoading, error, dataSource],
  );
  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces() {
  const context = useContext(PlacesContext);
  if (!context) throw new Error("usePlaces must be used inside PlacesProvider");
  return context;
}

export function placesMessage({ isLoading, error }: Pick<PlacesState, "isLoading" | "error">) {
  return error ?? (isLoading ? "Loading locations…" : null);
}
