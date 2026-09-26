import { neighborhoods } from "@/data/neighborhoods";
import { requestSpotFromLink } from "@/lib/api";
import type { Place, PlaceCategory, PlaceSource } from "@/lib/types";
import { videoFromLink } from "@/lib/video";

// Turns a pasted TikTok / Instagram / Google Maps link into a saved Place.
// The user only pastes the link; everything else is pulled from the post.
//
// 1. If the backend is running, it does the extraction (POST /api/spots/extract).
// 2. Otherwise we do a best-effort version in the browser: read the TikTok
//    caption via TikTok's public oEmbed endpoint and guess name / type / area
//    from it. Coordinates are approximate (neighborhood center) until the
//    backend geocodes real addresses.

export function detectSource(link: string): PlaceSource {
  const url = link.toLowerCase();
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("google.com/maps") || url.includes("maps.app.goo.gl") || url.includes("goo.gl/maps")) {
    return "maps";
  }
  return null;
}

export async function extractSpot(link: string): Promise<Place> {
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

  return buildSpot({
    name,
    category,
    neighborhood: neighborhoodFromText(caption),
    source,
    link,
    description: cleanCaption(caption),
    image: post?.thumbnail,
    creator: post?.creator,
  });
}

// ---------- reading the post ----------

async function readTikTok(link: string) {
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

function categoryFromText(text: string): PlaceCategory {
  return CATEGORY_WORDS.find(([, words]) => words.test(text))?.[0] ?? "food";
}

function neighborhoodFromText(text: string) {
  const lower = text.toLowerCase();
  return neighborhoods.find((n) => lower.includes(n.name.toLowerCase()))?.name ?? "SoHo";
}

/** Caption without hashtags/mentions, trimmed to a short blurb. */
function cleanCaption(caption: string) {
  const text = caption
    .replace(/[#@][\p{L}\p{N}_.]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

// ---------- building the Place ----------

const CATEGORY_IMAGE: Record<PlaceCategory, string> = {
  coffee: "photo-1495474472287-4d71bcdd2085",
  food: "photo-1565299624946-b28f40a0ae38",
  books: "photo-1507842217343-583bb7270b66",
  art: "photo-1531913764164-f85c52e6e654",
  outdoors: "photo-1568515387631-8b650bbcdb90",
  event: "photo-1514525253161-7a46d19cd819",
};

const CATEGORY_COST: Record<PlaceCategory, number> = {
  coffee: 7,
  food: 15,
  books: 0,
  art: 0,
  outdoors: 0,
  event: 0,
};

const HOME = neighborhoods[0]; // distances are measured from SoHo for now

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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
    image: input.image ?? `https://images.unsplash.com/${CATEGORY_IMAGE[input.category]}?w=800&q=80`,
    kind: "saved",
    description: input.description,
    video: video && input.creator ? { ...video, creator: input.creator } : video,
  };
}
