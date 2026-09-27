import { formatClock, parseClock } from "@/lib/time";
import type { BudgetOption, LoopPlan, Place, TimeOption } from "@/lib/types";

// Fallback planner used when the backend planner isn't available. Builds a
// simple loop from the user's actual saved places (Supabase or demo data):
// within budget, closest first, with as many stops as the time allows.

const STOPS_FOR_TIME: Record<TimeOption, number> = { 1: 2, 2: 3, 3: 3, 4: 4 };
const MAX_COST: Record<BudgetOption, number> = { free: 0, under20: 20, under40: 40, any: Infinity };
const VISIT_MINUTES = 40;
const WALK_MINUTES = 8;
const START_TIME = "12:00 PM";

const miles = (place: Place) => parseFloat(place.distance) || 99;

export function buildLocalLoop(
  places: Place[],
  answers: { timeHours: TimeOption; budget: BudgetOption },
  neighborhood: string,
): LoopPlan | null {
  const affordable = places
    .filter((place) => place.estimatedCost <= MAX_COST[answers.budget])
    .sort((a, b) => miles(a) - miles(b));
  // If nothing fits the budget, still suggest the closest spots rather than nothing.
  const pool = affordable.length ? affordable : [...places].sort((a, b) => miles(a) - miles(b));
  const picked = pool.slice(0, STOPS_FOR_TIME[answers.timeHours]);
  if (!picked.length) return null;

  let clock = parseClock(START_TIME);
  const stops = picked.map((place, index) => {
    const travel = index === 0 ? 0 : WALK_MINUTES;
    clock += travel;
    const stop = {
      id: `stop-${place.id}`,
      placeId: place.id,
      startTime: formatClock(clock),
      duration: VISIT_MINUTES,
      travelMinutesFromPrevious: travel,
      reason: place.kind === "event" ? "Happening today" : place.saved ? "Saved by you" : "LocalLoop find",
    };
    clock += VISIT_MINUTES;
    return stop;
  });

  const costs = picked.map((place) => place.estimatedCost);
  return {
    id: `local-${Date.now()}`,
    neighborhood,
    totalMinutes: stops.length * VISIT_MINUTES + (stops.length - 1) * WALK_MINUTES,
    estimatedCostMin: Math.min(...costs),
    estimatedCostMax: costs.reduce((sum, cost) => sum + cost, 0),
    stops,
  };
}
