import type { BudgetOption, GroupSize, Place, TimeOption } from "@/lib/types";

// Loopie's conversation script. Typed messages go to Gemini (see
// app/api/chat/route.ts); the starter prompts and the itinerary questions
// below stay scripted so the demo is instant and predictable.

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

// ---------- Gemini chat contract (shared by the chat UI and /api/chat) ----------

export type ChatTurn = { from: "user" | "loopie"; text: string };

/** The slice of a Place that Gemini sees as context. */
export type ChatPlace = Pick<
  Place,
  "id" | "name" | "category" | "neighborhood" | "distance" | "estimatedCost" | "kind" | "saved" | "description"
>;

export type AiChatRequest = { messages: ChatTurn[]; places: ChatPlace[] };

export type AiChatReply = {
  reply: string;
  /** Places to show as cards under the reply (always ids from the request). */
  placeIds: string[];
  /** "start_itinerary" hands off to the time -> people -> money questions. */
  action: "none" | "start_itinerary";
};

export function toChatPlace(place: Place): ChatPlace {
  const { id, name, category, neighborhood, distance, estimatedCost, kind, saved, description } = place;
  return { id, name, category, neighborhood, distance, estimatedCost, kind, saved, description };
}

// ---------- Understanding typed / spoken answers to the itinerary questions ----------

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, "twenty": 20, "forty": 40,
};

/** First number in the text, written as digits or a word ("two", "an"). */
function firstNumber(text: string): number | null {
  const digits = text.match(/\d+(\.\d+)?/);
  if (digits) return Number(digits[0]);
  const word = text.split(/[^a-z]+/).find((w) => w in NUMBER_WORDS);
  return word ? NUMBER_WORDS[word] : null;
}

export function parseTime(raw: string): TimeOption | null {
  const t = raw.toLowerCase();
  if (/(all|whole|entire|full)\s*(day|afternoon)|all of it|as long|no rush|more|lots/.test(t)) return 4;
  if (/half (an )?hour|30 min|thirty min/.test(t)) return 1;
  const n = firstNumber(t);
  if (n === null) return null;
  if (n <= 1) return 1;
  if (n <= 2) return 2;
  if (n <= 3) return 3;
  return 4;
}

export function parseGroup(raw: string): GroupSize | null {
  const t = raw.toLowerCase();
  if (/(just|only)\s+me|by myself|myself|alone|solo|^me$|^i am$|^1$/.test(t)) return 1;
  if (/group|friends|family|squad|crew|team|all of us|a bunch/.test(t)) return 3;
  if (/couple|date|partner|boyfriend|girlfriend|husband|wife|a friend|my friend|two of us|the two|us two|me and/.test(t)) return 2;
  const n = firstNumber(t);
  if (n === null) return null;
  return n <= 1 ? 1 : n === 2 ? 2 : 3;
}

export function parseBudget(raw: string): BudgetOption | null {
  const t = raw.toLowerCase();
  if (/doesn.?t matter|does not matter|don.?t care|any|whatever|no limit|no budget|splurge|anything/.test(t)) return "any";
  if (/free|no money|nothing|zero|\$0|broke/.test(t)) return "free";
  if (/cheap|low|tight|little/.test(t)) return "under20";
  const n = firstNumber(t);
  if (n === null) return null;
  if (n <= 0) return "free";
  if (n <= 20) return "under20";
  if (n <= 40) return "under40";
  return "any";
}

/** "never mind", "stop", "start over": leave the itinerary questions. */
export function isCancel(raw: string) {
  return /never ?mind|cancel|stop|start over|forget it|go back|nvm/.test(raw.toLowerCase());
}

/** Re-ask wording that works when heard out loud, not just read. */
export const reAsk = {
  time: "Sorry, I didn’t catch that. Say 1 hour, 2 hours, 3 hours, or all day.",
  people: "Sorry, I didn’t catch that. Is it just you, the two of you, or a group?",
  budget: "Sorry, I didn’t catch that. Free, under $20, under $40, or doesn’t matter?",
};
