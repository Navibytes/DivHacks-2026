import type { Place } from "@/lib/types";

export const places: Place[] = [
  {
    id: "matchaful",
    name: "Matchaful",
    neighborhood: "SoHo",
    category: "coffee",
    distance: "0.2 mi",
    estimatedCost: 8,
    saved: true,
    source: "tiktok",
    lat: 40.7243,
    lng: -74.0018,
    image:
      "https://images.unsplash.com/photo-1515823662972-da6a2e4d3002?w=800&q=80",
    kind: "saved",
  },
  {
    id: "housing-works",
    name: "Housing Works Bookstore",
    neighborhood: "SoHo",
    category: "books",
    distance: "0.4 mi",
    estimatedCost: 0,
    saved: true,
    source: "instagram",
    lat: 40.7248,
    lng: -73.9997,
    image:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
    kind: "saved",
  },
  {
    id: "cafe-reggio",
    name: "Cafe Reggio",
    neighborhood: "Greenwich Village",
    category: "coffee",
    distance: "0.8 mi",
    estimatedCost: 12,
    saved: true,
    source: "maps",
    lat: 40.7306,
    lng: -74.0005,
    image:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
    kind: "saved",
  },
  {
    id: "little-island",
    name: "Little Island",
    neighborhood: "Hudson River Park",
    category: "outdoors",
    distance: "1.1 mi",
    estimatedCost: 0,
    saved: true,
    source: "friend",
    lat: 40.742,
    lng: -74.01,
    image:
      "https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=800&q=80",
    kind: "saved",
  },
  {
    id: "the-strand",
    name: "The Strand",
    neighborhood: "East Village",
    category: "books",
    distance: "1.3 mi",
    estimatedCost: 15,
    saved: true,
    source: "tiktok",
    lat: 40.7333,
    lng: -73.9908,
    image:
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
    kind: "saved",
  },
  {
    id: "joes-pizza",
    name: "Joe’s Pizza",
    neighborhood: "Greenwich Village",
    category: "food",
    distance: "0.6 mi",
    estimatedCost: 5,
    saved: true,
    source: "tiktok",
    lat: 40.7305,
    lng: -74.0021,
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
    kind: "saved",
  },
  {
    id: "washington-square",
    name: "Washington Square Park",
    neighborhood: "Greenwich Village",
    category: "outdoors",
    distance: "0.7 mi",
    estimatedCost: 0,
    saved: false,
    source: null,
    lat: 40.7308,
    lng: -73.9973,
    image:
      "https://images.unsplash.com/photo-1555109307-f7d9da25c244?w=800&q=80",
    kind: "find",
  },
  {
    id: "soho-art-market",
    name: "SoHo Art Market",
    neighborhood: "SoHo",
    category: "art",
    distance: "0.3 mi",
    estimatedCost: 0,
    saved: false,
    source: null,
    lat: 40.7231,
    lng: -74.0007,
    image:
      "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=800&q=80",
    kind: "event",
  },
  {
    id: "nyc-parks-event",
    name: "NYC Parks event",
    neighborhood: "SoHo",
    category: "event",
    distance: "0.5 mi",
    estimatedCost: 0,
    saved: false,
    source: null,
    lat: 40.7216,
    lng: -74.0048,
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
    kind: "event",
  },
];

export const savedPlaces = places.filter((place) => place.saved);

export const nearbySaved = savedPlaces.slice(0, 3);

// Events + LocalLoop discoveries the user hasn't saved yet (New Finds tab).
export const newFinds = places.filter((place) => !place.saved);

export function getPlace(id: string) {
  return places.find((place) => place.id === id);
}

export function sourceLabel(source: Place["source"]) {
  if (source === "tiktok") return "Saved from TikTok";
  if (source === "instagram") return "Saved from Instagram";
  if (source === "maps") return "Saved from Google Maps";
  if (source === "friend") return "Saved from a friend";
  return null;
}

export function categoryLabel(category: Place["category"]) {
  if (category === "coffee") return "Coffee";
  if (category === "food") return "Food";
  if (category === "books") return "Books";
  if (category === "art") return "Art";
  if (category === "outdoors") return "Outdoors";
  return "Event";
}

export function costLabel(cost: number) {
  if (cost <= 0) return "Free";
  return `~$${cost}`;
}

export function statusLabel(place: Place) {
  if (place.saved) return "Saved by you";
  if (place.kind === "event") return "Happening today";
  return "LocalLoop find";
}
