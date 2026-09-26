import type { BudgetOption, GroupSize, Place, TimeOption } from "@/lib/types";

// Loopie's conversation script. Everything here is canned/local for the demo.
// Person 4's AI layer can replace `detectIntent` (and the canned answers)
// without touching the chat UI.

export type Intent = "itinerary" | "nearby" | "free" | "surprise";

export const starterPrompts: { intent: Intent; label: string }[] = [
  { intent: "itinerary", label: "Plan an itinerary" },
  { intent: "nearby", label: "What’s near me?" },
  { intent: "free", label: "Anything free today?" },
  { intent: "surprise", label: "Surprise me" },
];

// Itinerary questions, asked in order: time -> people -> money.
export const timeChoices: { value: TimeOption; label: string }[] = [
  { value: 1, label: "1 hr" },
  { value: 2, label: "2 hrs" },
  { value: 3, label: "3 hrs" },
  { value: 4, label: "All day" },
];

export const groupChoices: { value: GroupSize; label: string }[] = [
  { value: 1, label: "Just me" },
  { value: 2, label: "2 of us" },
  { value: 3, label: "A group (3+)" },
];

export const budgetChoices: { value: BudgetOption; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "under20", label: "Under $20" },
  { value: "under40", label: "Under $40" },
  { value: "any", label: "Doesn’t matter" },
];

export const questions = {
  time: "Love it. How much time do you have?",
  people: "Who’s coming with you?",
  budget: "And what’s your budget per person?",
};

/** Very small keyword matcher for typed messages. */
export function detectIntent(text: string): Intent | null {
  const t = text.toLowerCase();
  if (/(itiner|plan|loop|trip|day|schedule)/.test(t)) return "itinerary";
  if (/(free|cheap|no money|\$0)/.test(t)) return "free";
  if (/(near|close|around|walk)/.test(t)) return "nearby";
  if (/(surprise|random|bored|anything|idk)/.test(t)) return "surprise";
  return null;
}

const miles = (place: Place) => parseFloat(place.distance) || 99;

export function nearbySpots(saved: Place[]) {
  return [...saved].sort((a, b) => miles(a) - miles(b)).slice(0, 3);
}

export function freeSpots(all: Place[]) {
  return all
    .filter((place) => place.estimatedCost === 0)
    .sort((a, b) => Number(b.kind === "event") - Number(a.kind === "event") || miles(a) - miles(b))
    .slice(0, 3);
}

export function surpriseSpot(saved: Place[]) {
  return saved[Math.floor(Math.random() * saved.length)];
}
