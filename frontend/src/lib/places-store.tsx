"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { neighborhoods } from "@/data/neighborhoods";
import { places as demoPlaces } from "@/data/places";
import {
  CATEGORY_COST,
  HOME,
  categoryFromText,
  categoryImage,
  detectSource,
  milesBetween,
  nearestNeighborhood,
} from "@/lib/new-spot";
import { applyVideoDetails, detailsFromVideo } from "@/lib/enrich";
import { formatMiles, useLocation } from "@/lib/location-store";
import type { Place, PlaceKind } from "@/lib/types";
import { videoFromLink } from "@/lib/video";

// The shared list of places. Loads the location catalog from Supabase when
// NEXT_PUBLIC_SUPABASE_URL + a publishable/anon key are set; otherwise (or if
// the query fails / the table is empty) it falls back to the built-in demo
// spots, so the app never shows an empty map. Spots added in the app are kept
// here too.

type PlacesState = {
  places: Place[];
  savedPlaces: Place[];
  getPlace: (id: string) => Place | undefined;
  addSpot: (place: Place) => void;
  isLoading: boolean;
  /** Set when Supabase is configured but couldn't be used. */
  error: string | null;
  origin: "supabase" | "demo";
};

const PlacesContext = createContext<PlacesState | null>(null);

let client: SupabaseClient | null = null;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || key === "your-supabase-anon-key") return null;
  if (!client) client = createClient(url, key);
  return client;
}

const kinds: PlaceKind[] = ["saved", "event", "find"];

// Rough per-person estimates for Supabase `price_level` 1–3.
const PRICE_LEVEL_COST: Record<number, number> = { 1: 12, 2: 25, 3: 45 };

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

/** Coordinates inside a Google Maps link: "!3d40.7!4d-74.0", "@40.7,-74.0", or "?q=40.7,-74.0". */
export function coordsFromMapLink(link: string | undefined) {
  if (!link) return null;
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i];
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

/** "POINT(-74.0 40.7)" (PostGIS text) -> coordinates. */
function coordsFromPoint(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
  return match ? { lat: Number(match[2]), lng: Number(match[1]) } : null;
}

function toPriceLevel(value: unknown) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 3 ? level : undefined;
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

  const category = categoryFromText(`${typeof rawCategory === "string" ? rawCategory : ""} ${name}`);
  const priceLevel = toPriceLevel(row.price_level);
  const link = validUrl(row.link);
  // Catalog rows are treated as saved locations unless explicitly marked otherwise.
  const saved = row.saved !== false;
  const rowKind = row.kind;
  // `location` may be a neighborhood name or an address (a POINT was used above).
  const locationText = coordsFromPoint(row.location) ? undefined : text(row.location);
  const namedArea = locationText
    ? neighborhoods.find((n) => n.name.toLowerCase() === locationText.toLowerCase())
    : undefined;
  const area = namedArea ?? nearestNeighborhood({ lat, lng });

  return {
    id: String(id),
    name: name.trim(),
    neighborhood: area.name,
    category,
    distance: `${milesBetween(HOME, { lat, lng }).toFixed(1)} mi`,
    estimatedCost: priceLevel ? PRICE_LEVEL_COST[priceLevel] : CATEGORY_COST[category],
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
    address: text(row.address) ?? (namedArea ? undefined : locationText),
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
  const [origin, setOrigin] = useState<"supabase" | "demo">("demo");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    loadSupabasePlaces(supabase)
      .then((rows) => {
        if (!active) return;
        if (rows.length) {
          setPlaces(rows);
          setOrigin("supabase");
        } else {
          setPlaces(demoPlaces);
          setError("The Supabase places table is empty. Showing demo spots.");
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setPlaces(demoPlaces);
        setError(`Couldn’t load Supabase places (${err instanceof Error ? err.message : "unknown error"}). Showing demo spots.`);
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
    const thin = places.filter(
      (place) => place.video?.platform === "tiktok" && !place.description && !triedIds.current.has(place.id),
    );
    if (!thin.length) return;
    for (const place of thin) {
      triedIds.current.add(place.id);
      // No cleanup: results for other places must still land after the list updates.
      void detailsFromVideo(place.name, place.video!.url).then((details) => {
        if (!Object.keys(details).length) return;
        setPlaces((current) =>
          current.map((p) =>
            p.id === place.id ? applyVideoDetails(p, details, p.image === categoryImage(p.category)) : p,
          ),
        );
      });
    }
  }, [places]);

  // Newest saves first, like a feed. Distances are measured live from where you are.
  const here = useLocation().origin;
  const all = useMemo(
    () =>
      [...addedSpots, ...places].map((place) => ({
        ...place,
        distance: formatMiles(milesBetween(here, place)),
      })),
    [addedSpots, places, here],
  );
  const addSpot = useCallback((place: Place) => setAddedSpots((current) => [place, ...current]), []);

  const value = useMemo<PlacesState>(
    () => ({
      places: all,
      savedPlaces: all.filter((place) => place.saved),
      getPlace: (id) => all.find((place) => place.id === id),
      addSpot,
      isLoading,
      error,
      origin,
    }),
    [all, addSpot, isLoading, error, origin],
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
