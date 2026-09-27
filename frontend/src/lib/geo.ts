// Geography helpers. Place/area names come from OpenStreetMap's free Nominatim
// service (no key). Its usage policy allows at most 1 request per second and
// asks apps to cache, so every lookup goes through a paced queue and a cache.

export type Point = { lat: number; lng: number };
export type Area = { name: string; detail: string; lat: number; lng: number };
export type Geocoded = Point & { address?: string; area?: string };

export function milesBetween(a: Point, b: Point) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

/** "0.3 mi". Kept numeric-first: sorting code reads the number back out. */
export function formatMiles(miles: number) {
  return `${miles.toFixed(1)} mi`;
}

/** Coordinates inside a Google Maps link: "!3d40.7!4d-74.0", "@40.7,-74.0", or "?q=40.7,-74.0". */
export function coordsFromMapLink(link: string | undefined): Point | null {
  if (!link) return null;
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

// ---------- OpenStreetMap Nominatim ----------

const NOMINATIM = "https://nominatim.openstreetmap.org";
const GAP_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
const memory = new Map<string, Promise<unknown>>();

/** Run lookups one at a time, ~1/second, as Nominatim's policy asks. */
function paced<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, GAP_MS)),
    () => new Promise((r) => setTimeout(r, GAP_MS)),
  );
  return run;
}

/** Cache in memory and sessionStorage so a reload doesn't repeat lookups. */
function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key);
  if (hit) return hit as Promise<T>;
  try {
    const stored = sessionStorage.getItem(`geo:${key}`);
    if (stored) {
      const value = Promise.resolve(JSON.parse(stored) as T);
      memory.set(key, value);
      return value;
    }
  } catch {
    // Storage unavailable: memory cache only.
  }
  const pending = paced(load).then((value) => {
    try {
      sessionStorage.setItem(`geo:${key}`, JSON.stringify(value));
    } catch {
      // Not critical.
    }
    return value;
  });
  memory.set(key, pending);
  // Don't cache failures, so a flaky network can retry later.
  pending.catch(() => memory.delete(key));
  return pending;
}

type NominatimResult = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  addresstype?: string;
  address?: Record<string, string>;
};

async function nominatim(path: string): Promise<unknown> {
  const res = await fetch(`${NOMINATIM}${path}`, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

/** The most human area name in an address: neighborhood, then district, then city. */
function areaFrom(address: Record<string, string> | undefined) {
  if (!address) return undefined;
  return (
    address.neighbourhood ??
    address.quarter ??
    address.suburb ??
    address.city_district ??
    address.borough ??
    address.city ??
    address.town ??
    address.village
  );
}

/** Street address like "828 Broadway". */
function streetFrom(address: Record<string, string> | undefined) {
  if (!address?.road) return undefined;
  return address.house_number ? `${address.house_number} ${address.road}` : address.road;
}

/** Neighborhood name for a point, e.g. "Williamsburg". Null if unknown. */
export function areaName(point: Point): Promise<string | null> {
  const key = `rev:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
  return cached(key, async () => {
    const data = (await nominatim(
      `/reverse?format=jsonv2&addressdetails=1&zoom=16&lat=${point.lat}&lon=${point.lng}`,
    )) as NominatimResult;
    return areaFrom(data.address) ?? null;
  }).catch(() => null);
}

/** Find a place by name (and address), preferring results near `near`. */
export function geocode(query: string, near?: Point | null): Promise<Geocoded | null> {
  const bias = near ? `&viewbox=${near.lng - 0.15},${near.lat + 0.15},${near.lng + 0.15},${near.lat - 0.15}` : "";
  const key = `fwd:${query.toLowerCase()}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}`;
  return cached(key, async () => {
    const data = (await nominatim(
      `/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}${bias}`,
    )) as NominatimResult[];
    const hit = data[0];
    if (!hit) return null;
    return {
      lat: Number(hit.lat),
      lng: Number(hit.lon),
      address: streetFrom(hit.address),
      area: areaFrom(hit.address),
    };
  }).catch(() => null);
}

const AREA_TYPES = new Set(["neighbourhood", "quarter", "suburb", "city_district", "borough", "city", "town", "village", "hamlet"]);

/** Try several searches in order ("name, address", then address, then name) and return the first hit. */
export async function geocodeFirst(queries: string[], near?: Point | null): Promise<Geocoded | null> {
  for (const query of queries.filter(Boolean)) {
    const hit = await geocode(query, near);
    if (hit) return hit;
  }
  return null;
}

/** Neighborhoods / towns matching what the user typed, e.g. "park slope". */
export function searchAreas(query: string, near?: Point | null): Promise<Area[]> {
  const bias = near ? `&viewbox=${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}` : "";
  const key = `area:${query.toLowerCase()}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}`;
  return cached(key, async () => {
    const data = (await nominatim(
      `/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(query)}${bias}`,
    )) as NominatimResult[];
    const seen = new Set<string>();
    return data
      .filter((hit) => AREA_TYPES.has(hit.addresstype ?? ""))
      .filter((hit) => {
        const key = `${hit.name}|${hit.address?.borough ?? hit.address?.city ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 2)
      .map((hit) => ({
      name: hit.name || hit.display_name?.split(",")[0] || query,
      detail: [hit.address?.suburb ?? hit.address?.borough ?? hit.address?.city ?? hit.address?.county, hit.address?.state]
        .filter(Boolean)
        .join(", "),
      lat: Number(hit.lat),
      lng: Number(hit.lon),
    }));
  }).catch(() => []);
}
