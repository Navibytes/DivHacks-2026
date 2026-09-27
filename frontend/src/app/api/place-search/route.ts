import type { PlaceSearchRequest, PlaceSearchResponse } from "@/lib/place-search";

// POST /api/place-search: finds the real place for an "Unpinned" video.
// Uses Google Places API (New) Text Search, which returns the verified name,
// address, coordinates and Google Maps link. (Gemini's Google Search tool
// isn't available on free Gemini keys, so it can't be used here.)
// Server-only so GOOGLE_PLACES_API_KEY never reaches the browser.

const MAX_FIELD_LENGTH = 300;
// Bias toward New York City (a bias, not a hard limit).
const NYC_BIAS = { circle: { center: { latitude: 40.7306, longitude: -73.9866 }, radius: 30000 } };
const FIELDS = "places.displayName,places.formattedAddress,places.location,places.googleMapsUri";

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Place search isn't configured. Add GOOGLE_PLACES_API_KEY to frontend/.env.local and restart the app." },
      { status: 503 },
    );
  }

  let body: Partial<PlaceSearchRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const query = readText(body?.query);
  if (!query) return Response.json({ error: "Enter a place name or area to search." }, { status: 400 });

  // Mention the city unless the user already did, so short names resolve in NYC.
  const textQuery = /\b(new york|nyc|manhattan|brooklyn|queens|bronx|staten island)\b/i.test(query)
    ? query
    : `${query}, New York, NY`;

  let places: GooglePlace[];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery, pageSize: 5, locationBias: NYC_BIAS, languageCode: "en" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      console.error("[api/place-search] Google Places error:", res.status, await res.text().catch(() => ""));
      return Response.json({ error: "Place search failed. Please try again." }, { status: 502 });
    }
    places = ((await res.json()) as { places?: GooglePlace[] }).places ?? [];
  } catch (error) {
    console.error("[api/place-search] Google Places request failed:", error);
    return Response.json({ error: "Place search failed. Please try again." }, { status: 502 });
  }

  const usable = places.filter((place) => place.displayName?.text && place.location);
  if (!usable.length) {
    const none: PlaceSearchResponse = {
      found: false,
      name: "",
      address: "",
      confidence: "low",
      reason: `Google Maps has no place matching “${query}”.`,
      sources: [],
    };
    return Response.json(none);
  }

  const top = usable[0];
  const name = top.displayName!.text!;
  const address = (top.formattedAddress ?? "").replace(/,\s*USA$/, "");
  const nameMatches = similarNames(query, name);
  const sameNameCount = usable.filter((place) => similarNames(name, place.displayName!.text!)).length;

  // high: the name you typed is the listing's name and there's one location.
  // medium: it matches, but there are several locations (e.g. a chain).
  // low: you searched a description/area, so this is Google's best guess.
  const confidence: PlaceSearchResponse["confidence"] = !nameMatches ? "low" : sameNameCount > 1 ? "medium" : "high";
  const reason = !nameMatches
    ? `Google Maps’ top result for “${query}”. Compare it with the video before saving.`
    : sameNameCount > 1
      ? `${sameNameCount} locations are named “${name}”; this is the one Google ranks first. Check it’s the branch in the video.`
      : `Google Maps listing matching “${query}”.`;

  const result: PlaceSearchResponse = {
    found: true,
    name,
    address,
    confidence,
    reason,
    sources: top.googleMapsUri ? [{ title: "Google Maps", url: top.googleMapsUri }] : [],
    lat: top.location!.latitude,
    lng: top.location!.longitude,
    mapLink: top.googleMapsUri,
  };
  return Response.json(result);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";
}

/** Loose name match: ignores case, accents, punctuation, and extra words on either side. */
function similarNames(a: string, b: string) {
  const norm = (value: string) =>
    value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\bthe\b/g, "").replace(/[^a-z0-9]/g, "");
  const x = norm(a);
  const y = norm(b);
  return Boolean(x && y) && (x === y || x.includes(y) || y.includes(x));
}
