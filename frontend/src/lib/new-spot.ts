import { neighborhoods } from "@/data/neighborhoods";
import { requestSpotFromLink } from "@/lib/api";
import type { Place, PlaceCategory, PlaceSource } from "@/lib/types";
import { videoFromLink } from "@/lib/video";

// The server performs extraction and persists the spot before returning it.

export function detectSource(link: string): PlaceSource {
  const url = link.toLowerCase();
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("google.com/maps") || url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
    return "maps";
  }
  return null;
}

export function extractSpot(link: string): Promise<Place> {
  return requestSpotFromLink(link);
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

function neighborhoodFromText(text: string) {
  const lower = text.toLowerCase();
  return neighborhoods.find((n) => lower.includes(n.name.toLowerCase()))?.name ?? "SoHo";
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

/** Closest known NYC neighborhood to a point. */
export function nearestNeighborhood(point: { lat: number; lng: number }) {
  return neighborhoods.reduce((best, n) => (milesBetween(point, n) < milesBetween(point, best) ? n : best));
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

export const HOME = neighborhoods[0]; // distances are measured from SoHo for now

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

function buildSpot(input: {
  name: string;
  category: PlaceCategory;
  neighborhood: string;
  source: PlaceSource;
  link: string;
  description?: string;
  address?: string;
  image?: string;
  creator?: string;
}): Place {
  const area = neighborhoods.find((n) => n.name === input.neighborhood) ?? HOME;
  // Nudge the pin a little so several spots in one area don't stack.
  const lat = area.lat + (Math.random() - 0.5) * 0.004;
  const lng = area.lng + (Math.random() - 0.5) * 0.004;
  const video = videoFromLink(input.link);

  return {
    id: `spot-${Date.now()}`,
    name: input.name,
    neighborhood: area.name,
    category: input.category,
    distance: `${milesBetween(HOME, { lat, lng }).toFixed(1)} mi`,
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
