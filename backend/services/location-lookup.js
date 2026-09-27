// One shared queue for this backend process: public Nominatim permits at most 1 request/s.
const cache = new Map();
let queue = Promise.resolve();
let lastRequest = 0;
const ttl = 24 * 60 * 60 * 1000;

function normalized(value) {
  return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/\bthe\b/g, "").replace(/[^a-z0-9]/g, "");
}

function matchesName(expected, result) {
  const names = [result.name, ...Object.values(result.namedetails || {})].map(normalized);
  return names.includes(normalized(expected));
}

function serviceError() {
  const error = new Error("The place was identified, but the address lookup service is temporarily unavailable. Please try again shortly.");
  error.statusCode = 503;
  return error;
}

async function search(query) {
  const url = new URL(process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", namedetails: "1", limit: "5", "accept-language": "en" }).toString();
  const key = url.toString();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const pending = queue.then(async () => {
    // Recheck after waiting: simultaneous identical submissions share their result.
    const ready = cache.get(key);
    if (ready && ready.expires > Date.now()) return ready.value;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, lastRequest + 1100 - Date.now())));
    lastRequest = Date.now();
    try {
      const response = await fetch(key, {
        headers: { "User-Agent": process.env.NOMINATIM_USER_AGENT || "LocalLoop/0.1 (https://github.com/Navibytes/DivHacks-2026)", Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw serviceError();
      const value = await response.json();
      if (!Array.isArray(value)) throw serviceError();
      if (cache.size >= 1000) cache.delete(cache.keys().next().value);
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    } catch {
      throw serviceError();
    }
  });
  queue = pending.catch(() => {});
  return pending;
}

// ---------- Google Places (preferred when GOOGLE_PLACES_API_KEY is set) ----------
// Text Search (New) is far better at venue names and chains than OpenStreetMap.
// Only the fields we need are requested (field mask), which keeps it in the
// cheaper "Pro" tier; results are cached like the Nominatim ones.

// Bias searches toward New York City (a bias, not a hard limit).
const NYC_BIAS = { circle: { center: { latitude: 40.7306, longitude: -73.9866 }, radius: 30000 } };
const GOOGLE_FIELDS = "places.displayName,places.formattedAddress,places.location,places.addressComponents,places.googleMapsUri";

async function searchGoogle(query) {
  const cacheKey = `google:${query.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": GOOGLE_FIELDS,
    },
    body: JSON.stringify({ textQuery: query, pageSize: 5, locationBias: NYC_BIAS, languageCode: "en" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    console.warn("Google Places lookup failed:", response.status, await response.text().catch(() => ""));
    return null; // fall back to Nominatim
  }
  const value = (await response.json()).places ?? [];
  if (cache.size >= 1000) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, { value, expires: Date.now() + ttl });
  return value;
}

/** Google's name may add or drop a word ("Blank Street" vs "Blank Street Coffee"). */
function similarNames(expected, found) {
  const a = normalized(expected);
  const b = normalized(found);
  return Boolean(a && b) && (a === b || a.includes(b) || b.includes(a));
}

async function lookupWithGoogle(name, location, houseNumber) {
  const places = await searchGoogle(`${name}, ${location}`).catch(() => null);
  if (!places?.length) return null;
  const match = places.find((place) => {
    if (!similarNames(name, place.displayName?.text) || !place.location) return false;
    // If the video gave a street number, the address must agree.
    return !houseNumber || new RegExp(`^${houseNumber}\\b`, "i").test(place.formattedAddress ?? "");
  });
  if (!match) return null;
  const component = (type) => match.addressComponents?.find((part) => part.types?.includes(type))?.longText;
  return {
    name: match.displayName?.text || name,
    location: String(match.formattedAddress || "").replace(/,\s*USA$/, ""),
    neighborhood: component("neighborhood") || null,
    latitude: Number(match.location.latitude),
    longitude: Number(match.location.longitude),
    mapLink: match.googleMapsUri,
  };
}

export async function lookupVenue(name, location) {
  if (!name || !location) return null;
  const houseNumberHint = String(location).match(/(?:^|,\s*)(\d+[a-z]?)\s+[a-z]/i)?.[1];
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const google = await lookupWithGoogle(name, location, houseNumberHint);
    if (google) return google;
  }
  // Fallback: OpenStreetMap Nominatim (free, but weaker at venue names).
  const queryName = String(name).replace(/\bbook\s+store\b/gi, "Bookstore");
  const results = await search(`${queryName}, ${String(location).replace(/\bNYC\b/gi, "New York City")}`);
  const houseNumber = String(location).match(/(?:^|,\s*)(\d+[a-z]?)\s+[a-z]/i)?.[1];
  const matches = results.filter((result) => {
    if (!matchesName(name, result) || !result.address || result.lat == null || result.lon == null) return false;
    if (houseNumber && normalized(result.address.house_number) !== normalized(houseNumber)) return false;
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  });
  // Separate branches are ambiguous. Duplicate OSM objects at the same venue are OK.
  if (!matches.length || matches.some((item) => Math.abs(Number(item.lat) - Number(matches[0].lat)) > 0.0002 || Math.abs(Number(item.lon) - Number(matches[0].lon)) > 0.0002)) return null;
  const result = matches[0];
  const address = result.address;
  const street = [address.house_number, address.road || address.pedestrian].filter(Boolean).join(" ");
  const city = address.city || address.town || address.village || address.municipality;
  if (!city || !street) return null;
  return {
    name: result.name || name,
    location: [...new Set([street, city, address.state, address.postcode, address.country].filter(Boolean))].join(", "),
    neighborhood: address.neighbourhood || address.suburb || null,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  };
}
