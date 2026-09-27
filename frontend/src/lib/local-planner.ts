import { milesBetween } from "@/lib/geo";
import { formatClock, parseClock } from "@/lib/time";
import type { BudgetOption, LoopPlan, Place, TimeOption } from "@/lib/types";

// Fallback planner used when the backend planner isn't available. Builds a
// walkable loop from the user's actual saved places: within budget, each stop
// the nearest to the previous one, and no longer than the time they have.

const STOPS_FOR_TIME: Record<TimeOption, number> = { 1: 2, 2: 3, 3: 3, 4: 4 };
const MINUTES_FOR_TIME: Record<TimeOption, number> = { 1: 60, 2: 120, 3: 180, 4: 480 };
const MAX_COST: Record<BudgetOption, number> = { free: 0, under20: 20, under40: 40, any: Infinity };
const VISIT_MINUTES = 40;
const WALK_MINUTES_PER_MILE = 20; // ~3 mph
const MIN_WALK_MINUTES = 3;
const START_TIME = "12:00 PM";

/** Distance from the user, or null when their location isn't known. */
const fromUser = (place: Place) => {
  const value = parseFloat(place.distance);
  return Number.isFinite(value) ? value : null;
};

const walkMinutes = (a: Place, b: Place) =>
  Math.max(MIN_WALK_MINUTES, Math.round(milesBetween(a, b) * WALK_MINUTES_PER_MILE));

/** From `start`, keep walking to the nearest unvisited place while it fits the time. */
function chainFrom(start: Place, pool: Place[], maxStops: number, maxMinutes: number) {
  const chain = [start];
  let minutes = VISIT_MINUTES;
  let walked = 0;
  while (chain.length < maxStops) {
    const last = chain[chain.length - 1];
    const next = pool
      .filter((place) => !chain.includes(place))
      .sort((a, b) => milesBetween(last, a) - milesBetween(last, b))[0];
    if (!next) break;
    const walk = walkMinutes(last, next);
    if (minutes + walk + VISIT_MINUTES > maxMinutes) break;
    chain.push(next);
    minutes += walk + VISIT_MINUTES;
    walked += walk;
  }
  return { chain, walked };
}

export function buildLocalLoop(
  places: Place[],
  answers: { timeHours: TimeOption; budget: BudgetOption },
  neighborhood: string,
): LoopPlan | null {
  const affordable = places.filter((place) => place.estimatedCost <= MAX_COST[answers.budget]);
  // If nothing fits the budget, still suggest something rather than nothing.
  const pool = affordable.length ? affordable : places;
  if (!pool.length) return null;

  // Try every place as the starting point; keep the chain with the most stops,
  // then the least walking, then the start closest to the user (when known).
  const maxStops = STOPS_FOR_TIME[answers.timeHours];
  const maxMinutes = MINUTES_FOR_TIME[answers.timeHours];
  const best = pool
    .map((start) => ({ ...chainFrom(start, pool, maxStops, maxMinutes), start: fromUser(start) ?? 0 }))
    .sort((a, b) => b.chain.length - a.chain.length || a.walked - b.walked || a.start - b.start)[0];
  const picked = best.chain;

  let clock = parseClock(START_TIME);
  const stops = picked.map((place, index) => {
    const previous = picked[index - 1];
    const travel = previous ? walkMinutes(previous, place) : 0;
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
    totalMinutes: stops.reduce((sum, stop) => sum + stop.duration + stop.travelMinutesFromPrevious, 0),
    estimatedCostMin: Math.min(...costs),
    estimatedCostMax: costs.reduce((sum, cost) => sum + cost, 0),
    stops,
  };
}
