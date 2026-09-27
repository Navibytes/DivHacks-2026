import { requestSpotFromLink } from "@/lib/api";
import type { Place, PlaceCategory, PlaceSource } from "@/lib/types";

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

/** "📍 Joe's Pizza (7 Carmine St, New York, NY 10014)" -> "7 Carmine St" */
export function addressFromCaption(caption: string) {
  const match = caption.match(/📍[^(\n]*\(([^)]+)\)/u);
  if (!match || !/\d/.test(match[1])) return undefined; // needs a street number
  return match[1].split(",")[0].trim();
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

