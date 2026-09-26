import type { Place } from "@/lib/types";

// Built-in demo spots, used when Supabase isn't configured (see lib/places-store.tsx).
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
    description:
      "Plant-based matcha bar known for ceremonial-grade lattes. Try the iced strawberry matcha.",
    video: {
      platform: "tiktok",
      url: "https://www.tiktok.com/@takestwoeggs/video/7467688839713279263",
      creator: "@takestwoeggs",
    },
    tags: ["Plant-based", "Matcha bar"],
    mustTry: "Iced strawberry matcha",
    savedAt: "2026-09-20",
  },
  {
    id: "housing-works",
    name: "Housing Works Bookstore",
    neighborhood: "SoHo",
    category: "books",
    distance: "0.4 mi",
    estimatedCost: 0,
    saved: true,
    source: "tiktok",
    lat: 40.7248,
    lng: -73.9997,
    image:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
    kind: "saved",
    description:
      "Used bookstore and café where every purchase supports New Yorkers affected by HIV/AIDS and homelessness. The spiral balcony is the move.",
    video: {
      platform: "tiktok",
      url: "https://www.tiktok.com/@sahnahh/video/7364048241320693038",
      creator: "@sahnahh",
    },
    address: "126 Crosby St",
    tags: ["Used books", "Café", "Supports charity"],
    savedAt: "2026-09-12",
  },
  {
    id: "cafe-reggio",
    name: "Cafe Reggio",
    neighborhood: "Greenwich Village",
    category: "coffee",
    distance: "0.8 mi",
    estimatedCost: 12,
    saved: true,
    source: "tiktok",
    lat: 40.7306,
    lng: -74.0005,
    image:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
    kind: "saved",
    description:
      "Greenwich Village institution since 1927, said to be where the cappuccino first landed in America. Old-world interior, great for a slow coffee.",
    video: {
      platform: "tiktok",
      url: "https://www.tiktok.com/@food52/video/7440558937432214815",
      creator: "@food52",
    },
    address: "119 MacDougal St",
    tags: ["Since 1927", "Historic café"],
    mustTry: "The original cappuccino",
    savedAt: "2026-08-30",
  },
  {
    id: "little-island",
    name: "Little Island",
    neighborhood: "Hudson River Park",
    category: "outdoors",
    distance: "1.1 mi",
    estimatedCost: 0,
    saved: true,
    source: "tiktok",
    lat: 40.742,
    lng: -74.01,
    image:
      "https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=800&q=80",
    kind: "saved",
    description:
      "Floating park on the Hudson with winding paths, lawns, and sunset views over the river. Free to walk around.",
    video: {
      platform: "tiktok",
      url: "https://www.tiktok.com/@littleislandnyc/video/7435011326809787679",
      creator: "@littleislandnyc",
    },
    address: "Pier 55, Hudson River Park",
    tags: ["Free", "Park", "Sunset views"],
    savedAt: "2026-09-01",
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
    description:
      "Three floors and “18 miles” of new and used books. Don’t skip the $1–$2 carts outside.",
    video: {
      platform: "tiktok",
      url: "https://www.tiktok.com/@danielleturk1/video/7528549300461260087",
      creator: "@danielleturk1",
    },
    address: "828 Broadway",
    tags: ["New & used books", "$1 carts"],
    savedAt: "2026-09-24",
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
    description:
      "Classic New York slice counter on Carmine St. Quick, no-frills, and famous from Spider-Man 2.",
    video: {
      platform: "tiktok",
      url: "https://www.tiktok.com/@thebingbuzz/video/7196124214221360427",
      creator: "@thebingbuzz",
    },
    address: "7 Carmine St",
    tags: ["Slice shop", "Quick bite"],
    mustTry: "Plain cheese slice",
    savedAt: "2026-09-25",
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
    description: "The Village’s living room: the arch, the fountain, chess players, and street musicians all afternoon.",
    tags: ["Free", "Park", "Street music"],
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
    description: "Local artists selling prints, ceramics, and jewelry on the sidewalk. Free to browse.",
    hours: "Today · 11 AM – 6 PM",
    tags: ["Free", "Local artists"],
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
    description: "Free outdoor event from NYC Parks happening today near SoHo.",
    hours: "Today · 2 PM – 5 PM",
    tags: ["Free", "Outdoors"],
  },
];

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
