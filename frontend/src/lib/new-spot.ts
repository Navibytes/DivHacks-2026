import { requestSpotFromLink } from "@/lib/api";
import { coordsFromMapLink, geocodeFirst, type Point } from "@/lib/geo";
import type { Place, PlaceCategory, PlaceSource } from "@/lib/types";
import { videoFromLink } from "@/lib/video";

// Turns a pasted TikTok / Instagram / Google Maps link into a saved Place.
// The user only pastes the link; everything else is pulled from the post.
//
// 1. If the backend is running, it does the extraction (POST /api/spots/extract).
// 2. Otherwise we do a best-effort version in the browser: read the TikTok
//    caption via TikTok's public oEmbed endpoint for the name / type / address,
//    then find the real place on the map (Google Maps link coordinates, or an
//    OpenStreetMap lookup of the name + address near the user).

export function detectSource(link: string): PlaceSource {
  const url = link.toLowerCase();
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("google.com/maps") || url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
    return "maps";
  }
  return null;
}

export async function extractSpot(link: string, near?: Point | null): Promise<Place> {
  const source = detectSource(link);
  if (!source) {
    throw new Error("Paste a TikTok, Instagram, or Google Maps link.");
  }

  const fromBackend = await requestSpotFromLink(link);
  if (fromBackend) return fromBackend;

  const post = source === "tiktok" ? await readTikTok(link) : null;
  const caption = post?.caption ?? "";
  const name =
    nameFromCaption(caption) ||
    nameFromMapsLink(link) ||
    (post ? `Spot from ${post.creator}` : "New saved spot");
  const category = categoryFromText(`${name} ${caption}`);
  const address = addressFromCaption(caption);

  // Where is it? Exact coords from a Maps link, else look it up by name/address near the user.
  const fromLink = coordsFromMapLink(link);
  const geo = fromLink
    ? null
    : await geocodeFirst([address ? `${name}, ${address}` : "", address ? `${address}, New York` : "", name], near);
  const found = fromLink ?? geo;
  if (!found) {
    throw new Error(`Couldn’t find “${name}” on the map. Try its Google Maps link instead.`);
  }

  return buildSpot({
    name,
    category,
    point: found,
    source,
    link,
    description: cleanCaption(caption),
    address: address ?? geo?.address,
    neighborhood: geo?.area,
    image: post?.thumbnail,
    creator: post?.creator,
  });
}

// ---------- reading the post ----------

export async function readTikTok(link: string) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
    if (!res.ok) return null;
    const data: { title?: string; author_unique_id?: string; thumbnail_url?: string } = await res.json();
    return {
      caption: data.title ?? "",
      creator: data.author_unique_id ? `@${data.author_unique_id}` : "TikTok",
      thumbnail: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

/** Creators usually tag the place with a pin: "📍 Joe's Pizza (7 Carmine St)". */
function nameFromCaption(caption: string) {
  const match = caption.match(/📍\s*([^\n(,|#@\-–—]+)/u);
  return match ? match[1].trim().replace(/[.!?:]+$/, "") : "";
}

/** "📍 Joe's Pizza (7 Carmine St, New York, NY 10014)" -> "7 Carmine St" */
export function addressFromCaption(caption: string) {
  const match = caption.match(/📍[^(\n]*\(([^)]+)\)/u);
  if (!match || !/\d/.test(match[1])) return undefined; // needs a street number
  return match[1].split(",")[0].trim();
}

/** Google Maps place links contain the name: /maps/place/Joe's+Pizza/@... */
function nameFromMapsLink(link: string) {
  const match = link.match(/\/maps\/place\/([^/@?]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return "";
  }
}

const CATEGORY_WORDS: [PlaceCategory, RegExp][] = [
  ["coffee", /coffee|caf[eé]|espresso|latte|matcha|tea\b/i],
  ["books", /book|library|reading/i],
  ["art", /art\b|gallery|museum|mural|exhibit/i],
  ["outdoors", /park|garden|island|pier|trail|picnic|outdoor/i],
  ["food", /pizza|food|eat|restaurant|taco|burger|bagel|dumpling|brunch|bakery|slice|ramen|dinner|lunch/i],
];

export function categoryFromText(text: string): PlaceCategory {
  return CATEGORY_WORDS.find(([, words]) => words.test(text))?.[0] ?? "food";
}

/** Caption without hashtags/mentions, trimmed to a short blurb. */
export function cleanCaption(caption: string) {
  const text = caption
    .replace(/[#@][\p{L}\p{N}_.]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

// ---------- building the Place ----------

export function categoryImage(category: PlaceCategory) {
  return `https://images.unsplash.com/${CATEGORY_IMAGE[category]}?w=800&q=80`;
}

const CATEGORY_IMAGE: Record<PlaceCategory, string> = {
  coffee: "photo-1495474472287-4d71bcdd2085",
  food: "photo-1565299624946-b28f40a0ae38",
  books: "photo-1507842217343-583bb7270b66",
  art: "photo-1531913764164-f85c52e6e654",
  outdoors: "photo-1568515387631-8b650bbcdb90",
  event: "photo-1514525253161-7a46d19cd819",
};

export const CATEGORY_COST: Record<PlaceCategory, number> = {
  coffee: 7,
  food: 15,
  books: 0,
  art: 0,
  outdoors: 0,
  event: 0,
};

function buildSpot(input: {
  name: string;
  category: PlaceCategory;
  point: Point;
  neighborhood?: string;
  source: PlaceSource;
  link: string;
  description?: string;
  address?: string;
  image?: string;
  creator?: string;
}): Place {
  const { lat, lng } = input.point;
  const video = videoFromLink(input.link);

  return {
    id: `spot-${Date.now()}`,
    name: input.name,
    // Blank values are filled in live by the places store (area lookup, distance from you).
    neighborhood: input.neighborhood ?? "",
    category: input.category,
    distance: "",
    estimatedCost: CATEGORY_COST[input.category],
    saved: true,
    source: input.source,
    lat,
    lng,
    image: input.image ?? categoryImage(input.category),
    kind: "saved",
    description: input.description,
    address: input.address,
    savedAt: new Date().toISOString(),
    video: video && input.creator ? { ...video, creator: input.creator } : video,
  };
}
