import type { Place } from "@/lib/types";

export function sourceLabel(source: Place["source"]) {
  if (source === "tiktok") return "Saved from TikTok";
  if (source === "instagram") return "Saved from Instagram";
  if (source === "maps") return "Saved from Google Maps";
  if (source === "friend") return "Saved from a friend";
  return null;
}

export function categoryLabel(category: Place["category"]) {
  if (category === "coffee") return "Coffee Shop";
  if (category === "food") return "Food";
  if (category === "books") return "Books";
  if (category === "art") return "Art";
  if (category === "outdoors") return "Outdoors";
  if (category === "event") return "Event";
  return category.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function costLabel(cost: number | null, priceLevel: number | null = null) {
  if (cost === null) return priceLevel ? "$".repeat(priceLevel) : "Price not listed";
  if (cost <= 0) return "Free";
  return `~$${cost}`;
}

export function statusLabel(place: Place) {
  if (place.saved) return "In your location catalog";
  if (place.kind === "event") return "Happening today";
  return "LocalLoop find";
}
