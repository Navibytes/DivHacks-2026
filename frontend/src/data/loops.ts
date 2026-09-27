import type { LoopPlan } from "@/lib/types";

/** No loop planned yet. */
export function emptyLoop(neighborhood = ""): LoopPlan {
  return { id: "empty", neighborhood, totalMinutes: 0, estimatedCostMin: 0, estimatedCostMax: 0, stops: [] };
}

export function formatLoopTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} hr ${minutes} min`;
  if (hours) return `${hours} hr`;
  return `${minutes} min`;
}

/** "$8–18", "$12" when there's one price, or "Free". */
export function formatCostRange(min: number, max: number) {
  if (max <= 0) return "Free";
  if (min === max) return `$${max}`;
  return `$${min}–${max}`;
}
