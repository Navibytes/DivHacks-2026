const API_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.addressComponents,places.googleMapsUri,places.types";
const nominatimCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequest = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000;

function normalized(value) {
  return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/\bthe\b/g, "").replace(/[^a-z0-9]/g, "");
}

function similarNames(expected, found) {
  const a = normalized(expected);
  const b = normalized(found);
  return Boolean(a && b) && (a === b || a.includes(b) || b.includes(a));
}

function streetKey(value) {
  const aliases = { st: "street", rd: "road", ave: "avenue", av: "avenue", blvd: "boulevard", ln: "lane", dr: "drive", pl: "place", ct: "court", n: "north", s: "south", e: "east", w: "west" };
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    .split(/\s+/).map((word) => aliases[word] || word).join("");
}

function cityKey(value) {
  return normalized(String(value || "").replace(/\bNYC\b/gi, "New York").replace(/\s+City$/i, ""));
}

function fullAddress(location) {
  const parts = String(location || "").split(",").map((part) => part.trim());
  const street = parts[0]?.match(/^(\d+[a-z]?(?:-\d+[a-z]?)?)\s+(.+)$/i);
  if (!street) return null;
  return {
    number: street[1],
    street: street[2],
    city: parts.length > 1 ? parts[1] : null,
  };
}

function component(place, type) {
  return place.addressComponents?.find((item) => item.types?.includes(type))?.longText || "";
}

function rejection(place, expected, requireName, name) {
  if (requireName && !similarNames(name, place.displayName?.text)) return "venue name differs";
  const point = place.location;
  if (!place.formattedAddress || !Number.isFinite(point?.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point?.longitude) || Math.abs(point.longitude) > 180) return "missing address or coordinates";
  if (expected) {
    const number = component(place, "street_number");
    const route = component(place, "route");
    if (normalized(number) !== normalized(expected.number)) return "street number differs";
    if (streetKey(route) !== streetKey(expected.street)) return "street differs";
    if (expected.city && cityKey(component(place, "locality")) !== cityKey(expected.city)) return "city differs";
  }
  return null;
}

function choose(places, name, expected, requireName, query) {
  const candidates = places.map((place) => ({ place, rejected: rejection(place, expected, requireName, name) }));
  const matches = candidates.filter((item) => !item.rejected).map((item) => item.place);
  const farApart = matches.some((a) => matches.some((b) => {
    const radians = Math.PI / 180;
    const h = Math.sin((a.location.latitude - b.location.latitude) * radians / 2) ** 2
      + Math.cos(a.location.latitude * radians) * Math.cos(b.location.latitude * radians)
      * Math.sin((a.location.longitude - b.location.longitude) * radians / 2) ** 2;
    return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))) > (requireName ? 25 : 75);
  }));
  console.info("[google-places]", JSON.stringify({
    mode: requireName ? "venue" : "address",
    query,
    candidates: candidates.map(({ place, rejected }) => ({ id: place.id, name: place.displayName?.text, address: place.formattedAddress, location: place.location, rejected })),
    outcome: farApart ? "ambiguous locations" : matches.length ? "matched" : "no matching candidates",
  }));
  if (farApart) return null;
  return (!requireName && matches.find((place) => place.types?.includes("premise"))) || matches[0] || null;
}

async function search(query, apiKey) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELDS,
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 5, languageCode: "en", regionCode: "US" }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    console.warn("Google Places Text Search failed with HTTP", response.status);
    const error = new Error(response.status === 429
      ? "Google Places is temporarily rate limited. Please try again shortly."
      : "Google Places lookup failed. Check the Places API key, billing, and API access.");
    error.statusCode = response.status === 429 ? 503 : response.status >= 500 ? 503 : 502;
    throw error;
  }
  const data = await response.json();
  if (!Array.isArray(data.places)) return [];
  return data.places;
}

async function searchNominatim(query) {
  const url = new URL(process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", namedetails: "1", limit: "5", "accept-language": "en" }).toString();
  const key = url.toString();
  const cached = nominatimCache.get(key);
  if (cached?.expires > Date.now()) return cached.value;
  const request = nominatimQueue.then(async () => {
    const ready = nominatimCache.get(key);
    if (ready?.expires > Date.now()) return ready.value;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, lastNominatimRequest + 1100 - Date.now())));
    lastNominatimRequest = Date.now();
    const response = await fetch(key, {
      headers: { "User-Agent": process.env.NOMINATIM_USER_AGENT || "LocalLoop/0.1 (https://github.com/Navibytes/DivHacks-2026)", Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Nominatim lookup failed (${response.status})`);
    const value = await response.json();
    if (!Array.isArray(value)) throw new Error("Nominatim returned an invalid response");
    if (nominatimCache.size >= 1000) nominatimCache.delete(nominatimCache.keys().next().value);
    nominatimCache.set(key, { value, expires: Date.now() + CACHE_TTL });
    return value;
  });
  nominatimQueue = request.catch(() => {});
  return request;
}

async function lookupWithNominatim(name, location) {
  const queryName = String(name).replace(/\bbook\s+store\b/gi, "Bookstore");
  const queryLocation = String(location).replace(/\bNYC\b/gi, "New York City");
  const results = await searchNominatim(`${queryName}, ${queryLocation}`);
  const expected = fullAddress(location);
  const names = (result) => [result.name, ...Object.values(result.namedetails || {})].map(normalized);
  const matches = results.filter((result) => {
    if (!names(result).includes(normalized(name)) || !result.address || result.lat == null || result.lon == null) return false;
    if (expected && (normalized(result.address.house_number) !== normalized(expected.number)
      || streetKey(result.address.road || result.address.pedestrian) !== streetKey(expected.street))) return false;
    return Number.isFinite(Number(result.lat)) && Math.abs(Number(result.lat)) <= 90
      && Number.isFinite(Number(result.lon)) && Math.abs(Number(result.lon)) <= 180;
  });
  if (!matches.length || matches.some((item) => Math.abs(Number(item.lat) - Number(matches[0].lat)) > 0.0002
    || Math.abs(Number(item.lon) - Number(matches[0].lon)) > 0.0002)) return null;
  const result = matches[0];
  const parts = result.address;
  const street = [parts.house_number, parts.road || parts.pedestrian].filter(Boolean).join(" ");
  const city = parts.city || parts.town || parts.village || parts.municipality;
  if (!street || !city) return null;
  return {
    name: result.name || name,
    location: [...new Set([street, city, parts.state, parts.postcode, parts.country].filter(Boolean))].join(", "),
    neighborhood: parts.neighbourhood || parts.suburb || null,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  };
}

export async function lookupVenue(name, location) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const error = new Error("Set GOOGLE_PLACES_API_KEY in backend/.env and enable Places API (New) with billing.");
    error.statusCode = 503;
    throw error;
  }
  if (!name || !location) return null;
  const cleanName = String(name)
    .replace(/\s+(?:in\s+)?(?:NYC|New York City|New York|Brooklyn|Queens|Manhattan)(?:,\s*NY)?$/i, "")
    .replace(/\bbook\s+store\b/gi, "Bookstore");
  const address = fullAddress(location);
  const venueQuery = `${cleanName || name}, ${location}`;
  const candidates = await search(venueQuery, apiKey).catch(() => []);
  let place = choose(candidates, cleanName, address, true, venueQuery);
  let addressOnly = false;
  if (!place && address?.city) {
    const addressQuery = location;
    place = choose(await search(addressQuery, apiKey).catch(() => []), name, address, false, addressQuery);
    addressOnly = Boolean(place);
  }
  if (!place) {
    try {
      const fallback = await lookupWithNominatim(name, location);
      if (fallback) console.info("[nominatim] accepted fallback result", JSON.stringify({ name: fallback.name, location: fallback.location }));
      return fallback;
    } catch (error) {
      console.warn("Nominatim fallback failed:", error.message);
      return null;
    }
  }
  const neighborhood = place.addressComponents?.find((item) => item.types?.includes("neighborhood"))?.longText
    || place.addressComponents?.find((item) => item.types?.includes("sublocality"))?.longText
    || null;
  return {
    name: addressOnly ? name : place.displayName?.text || name,
    location: String(place.formattedAddress || "").replace(/,\s*USA$/, ""),
    neighborhood,
    latitude: place.location.latitude,
    longitude: place.location.longitude,
    mapLink: place.googleMapsUri,
  };
}
