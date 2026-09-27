import { categoryLabel } from "@/data/places";
import type { Place } from "@/lib/types";

// Search for the map's search bar. Ranks places by where the query matches
// (name first, then area/category, then tags and descriptions). Neighborhood
// suggestions come from OpenStreetMap (see searchAreas in lib/geo.ts).

const MAX_PLACES = 5;

export function searchPlaces(query: string, places: Place[]): Place[] {
  const q = normalize(query);
  if (!q) return [];

  return places
    .map((place) => ({ place, score: scorePlace(place, q) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name))
    .slice(0, MAX_PLACES)
    .map((item) => item.place);
}

function scorePlace(place: Place, q: string) {
  const name = normalize(place.name);
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.split(" ").some((word) => word.startsWith(q))) return 70;
  if (name.includes(q)) return 60;
  if (normalize(place.neighborhood).includes(q)) return 40;
  if (normalize(categoryLabel(place.category)).includes(q)) return 35;
  const details = [...(place.tags ?? []), place.mustTry, place.description, place.address]
    .filter(Boolean)
    .join(" ");
  if (normalize(details).includes(q)) return 20;
  return 0;
}

/** Lowercase, strip accents and curly quotes so "cafe" finds "Café" and "joes" finds "Joe’s". */
function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}
