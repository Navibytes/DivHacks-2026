"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { demoLoop } from "@/data/loops";
import { statusLabel } from "@/data/places";
import { requestLoop } from "@/lib/api";
import { buildLocalLoop } from "@/lib/local-planner";
import { usePlaces } from "@/lib/places-store";
import { formatClock, parseClock } from "@/lib/time";
import type { BudgetOption, GroupSize, LoopPlan, Place, TimeOption } from "@/lib/types";

/** Answers the companion chat collects before planning. */
export type LoopAnswers = {
  timeHours: TimeOption;
  groupSize: GroupSize;
  budget: BudgetOption;
};

type PlanState = {
  /** All known places, including spots the user added this session. */
  places: Place[];
  savedPlaces: Place[];
  getPlace: (id: string) => Place | undefined;
  addSpot: (place: Place) => void;
  neighborhood: string;
  /** The loop to show: the one the user built, or the demo loop. */
  loop: LoopPlan;
  isPlanning: boolean;
  buildLoop: (answers: LoopAnswers) => Promise<LoopPlan>;
  addToLoop: (placeId: string) => void;
  isInLoop: (placeId: string) => boolean;
};

const PlanContext = createContext<PlanState | null>(null);

const WALK_MINUTES_GUESS = 8;
const VISIT_MINUTES_GUESS = 40;

export function PlanProvider({ children }: { children: React.ReactNode }) {
  // No location picker yet, so plans start from SoHo.
  const neighborhood = "SoHo";
  const [loop, setLoop] = useState<LoopPlan>(demoLoop);
  const [isPlanning, setIsPlanning] = useState(false);

  // Places live in PlacesProvider (Supabase or demo data); re-exposed here for convenience.
  const { places, savedPlaces, getPlace, addSpot } = usePlaces();

  const value = useMemo<PlanState>(() => {
    return {
      places,
      savedPlaces,
      getPlace,
      addSpot,
      neighborhood,
      loop,
      isPlanning,
      buildLoop: async ({ timeHours, groupSize, budget }) => {
        setIsPlanning(true);
        // Let Loopie "think" for ~1s even if the API answers instantly.
        const minDelay = new Promise((resolve) =>
          setTimeout(resolve, 800 + Math.floor(Math.random() * 400)),
        );
        const [apiLoop] = await Promise.all([
          requestLoop({
            locationMode: "neighborhood",
            neighborhood,
            timeHours,
            groupSize,
            budget,
            vibes: [],
            savedPlaceIds: savedPlaces.map((place) => place.id),
          }),
          minDelay,
        ]);
        // Backend planner first; otherwise plan from the places we actually have.
        const next =
          apiLoop ?? buildLocalLoop(savedPlaces, { timeHours, budget }, neighborhood) ?? { ...demoLoop, neighborhood };
        setLoop(next);
        setIsPlanning(false);
        return next;
      },
      addToLoop: (placeId) => {
        const place = getPlace(placeId);
        if (!place || loop.stops.some((stop) => stop.placeId === placeId)) return;
        const last = loop.stops[loop.stops.length - 1];
        const start = last
          ? parseClock(last.startTime) + last.duration + WALK_MINUTES_GUESS
          : parseClock("12:00 PM");
        setLoop({
          ...loop,
          totalMinutes: loop.totalMinutes + VISIT_MINUTES_GUESS + WALK_MINUTES_GUESS,
          estimatedCostMax: loop.estimatedCostMax + place.estimatedCost,
          stops: [
            ...loop.stops,
            {
              id: `stop-${placeId}`,
              placeId,
              startTime: formatClock(start),
              duration: VISIT_MINUTES_GUESS,
              travelMinutesFromPrevious: last ? WALK_MINUTES_GUESS : 0,
              reason: statusLabel(place),
            },
          ],
        });
      },
      isInLoop: (placeId) => loop.stops.some((stop) => stop.placeId === placeId),
    };
  }, [places, savedPlaces, getPlace, addSpot, loop, isPlanning]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan must be used inside PlanProvider");
  }
  return context;
}
