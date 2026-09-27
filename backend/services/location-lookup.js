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

export async function lookupVenue(name, location) {
  if (!name || !location) return null;
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
