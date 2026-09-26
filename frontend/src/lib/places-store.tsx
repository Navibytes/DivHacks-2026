"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Place, PlaceKind, PlaceSource } from "@/lib/types";

type PlacesState = {
  places: Place[];
  isLoading: boolean;
  error: string | null;
};

const PlacesContext = createContext<PlacesState | null>(null);

let client: SupabaseClient | null = null;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

const kinds: PlaceKind[] = ["saved", "event", "find"];
const sources: Exclude<PlaceSource, null>[] = ["tiktok", "instagram", "maps", "friend"];

function normalizeCategory(value: string) {
  const category = value.trim();
  const normalized = category.toLowerCase();
  if (["coffee shop", "cafe", "café", "coffee"].includes(normalized)) return "coffee";
  if (["restaurant", "food", "dining"].includes(normalized)) return "food";
  if (["bookstore", "book shop", "books"].includes(normalized)) return "books";
  if (["art gallery", "gallery", "art"].includes(normalized)) return "art";
  if (["park", "outdoors", "outdoor"].includes(normalized)) return "outdoors";
  if (normalized === "event") return "event";
  return category;
}

function validUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function toPriceLevel(value: unknown) {
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 3 ? level : null;
}

function toPlace(row: Record<string, unknown>): Place | null {
  const id = row.id;
  const name = row.name;
  const rawCategory = row.category;
  const lat = Number(row.lat ?? row.latitude);
  const lng = Number(row.lng ?? row.longitude);
  if (
    (typeof id !== "string" && typeof id !== "number") ||
    typeof name !== "string" ||
    typeof rawCategory !== "string" ||
    !rawCategory.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  // Catalog rows are treated as saved locations unless explicitly marked otherwise.
  const saved = row.saved !== false;
  const rowKind = row.kind;
  const source = row.source;
  const rawCost = row.estimated_cost ?? row.estimatedCost;
  const estimatedCost = rawCost == null ? null : Number(rawCost);
  const category = normalizeCategory(rawCategory);
  return {
    id: String(id),
    name,
    neighborhood: null,
    category,
    distance: typeof row.distance === "string" && row.distance.trim() ? row.distance : null,
    estimatedCost: estimatedCost !== null && Number.isFinite(estimatedCost) ? estimatedCost : null,
    priceLevel: toPriceLevel(row.price_level),
    saved,
    source: typeof source === "string" && sources.includes(source as Exclude<PlaceSource, null>)
      ? source as Exclude<PlaceSource, null>
      : null,
    lat,
    lng,
    image: validUrl(row.image),
    link: validUrl(row.link),
    kind: typeof rowKind === "string" && kinds.includes(rowKind as PlaceKind)
      ? rowKind as PlaceKind
      : category === "event" ? "event" : saved ? "saved" : "find",
  };
}

export function PlacesProvider({ children }: { children: React.ReactNode }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadPlaces = async (): Promise<{ places: Place[]; error: string | null }> => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          return {
            places: [],
            error: "Add NEXT_PUBLIC_SUPABASE_URL and a Supabase publishable/anon key to .env.local to load locations.",
          };
        }

        const table = process.env.NEXT_PUBLIC_SUPABASE_LOCATIONS_TABLE || "places";
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return { places: [], error: "NEXT_PUBLIC_SUPABASE_LOCATIONS_TABLE must be a valid table name." };
        }

        const { data, error: queryError } = await supabase
          .from(table)
          .select("id,created_at,name,category,lat,lng,price_level,link")
          .order("name");
        if (queryError) {
          return { places: [], error: `Could not load locations: ${queryError.message}` };
        }
        const rows = (data ?? [])
          .map((row) => toPlace(row as Record<string, unknown>))
          .filter((place): place is Place => place !== null);
        return { places: rows, error: null };
      } catch (queryError) {
        return {
          places: [],
          error: `Could not load locations: ${queryError instanceof Error ? queryError.message : "Unknown Supabase error."}`,
        };
      }
    };

    void loadPlaces().then((result) => {
      if (!active) return;
      setPlaces(result.places);
      setError(result.error);
      setIsLoading(false);
    });

    return () => { active = false; };
  }, []);

  const value = useMemo(() => ({ places, isLoading, error }), [places, isLoading, error]);
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
