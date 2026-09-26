"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { demoLoop } from "@/data/loops";
import { statusLabel } from "@/data/places";
import { requestLoop } from "@/lib/api";
import { usePlaces } from "@/lib/places-store";
import { formatClock, parseClock } from "@/lib/time";
import type {
  BudgetOption,
  LocationMode,
  LoopPlan,
  TimeOption,
  VibeOption,
} from "@/lib/types";

type PlanState = {
  locationMode: LocationMode | null;
  neighborhood: string;
  timeHours: TimeOption | null;
  budget: BudgetOption | null;
  vibes: VibeOption[];
  /** The loop to show: the one the user built, or the demo loop. */
  loop: LoopPlan;
  isPlanning: boolean;
  setLocation: (mode: LocationMode, neighborhood?: string) => void;
  setTime: (time: TimeOption) => void;
  setBudget: (budget: BudgetOption) => void;
  toggleVibe: (vibe: VibeOption) => void;
  buildLoop: () => Promise<void>;
  addToLoop: (placeId: string) => void;
  isInLoop: (placeId: string) => boolean;
};

const PlanContext = createContext<PlanState | null>(null);

const WALK_MINUTES_GUESS = 8;
const VISIT_MINUTES_GUESS = 40;

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { places } = usePlaces();
  const savedPlaces = useMemo(() => places.filter((place) => place.saved), [places]);
  const [locationMode, setLocationMode] = useState<LocationMode | null>("gps");
  const [neighborhood, setNeighborhood] = useState("Nearby");
  const [timeHours, setTimeHours] = useState<TimeOption | null>(null);
  const [budget, setBudget] = useState<BudgetOption | null>(null);
  const [vibes, setVibes] = useState<VibeOption[]>([]);
  const [loop, setLoop] = useState<LoopPlan>({ ...demoLoop, neighborhood: "Nearby" });
  const [isPlanning, setIsPlanning] = useState(false);

  const value = useMemo<PlanState>(
    () => ({
      locationMode,
      neighborhood,
      timeHours,
      budget,
      vibes,
      loop,
      isPlanning,
      setLocation: (mode, nextNeighborhood = "Nearby") => {
        setLocationMode(mode);
        setNeighborhood(nextNeighborhood);
      },
      setTime: setTimeHours,
      setBudget,
      toggleVibe: (vibe) => {
        setVibes((current) => {
          if (vibe === "surprise") return ["surprise"];
          const next = current.filter((item) => item !== "surprise");
          return next.includes(vibe)
            ? next.filter((item) => item !== vibe)
            : [...next, vibe];
        });
      },
      buildLoop: async () => {
        setIsPlanning(true);
        // Keep the planning overlay up ~1s even if the API answers instantly.
        const minDelay = new Promise((resolve) =>
          setTimeout(resolve, 800 + Math.floor(Math.random() * 400)),
        );
        const [apiLoop] = await Promise.all([
          requestLoop({
            locationMode: locationMode ?? "gps",
            neighborhood,
            timeHours: timeHours ?? 2,
            budget: budget ?? "any",
            vibes,
            savedPlaceIds: savedPlaces.map((place) => place.id),
          }),
          minDelay,
        ]);
        setLoop(apiLoop ?? { ...demoLoop, neighborhood });
        setIsPlanning(false);
      },
      addToLoop: (placeId) => {
        const place = places.find((item) => item.id === placeId);
        if (!place || loop.stops.some((stop) => stop.placeId === placeId)) return;
        const last = loop.stops[loop.stops.length - 1];
        const start = last
          ? parseClock(last.startTime) + last.duration + WALK_MINUTES_GUESS
          : parseClock("12:00 PM");
        setLoop({
          ...loop,
          totalMinutes: loop.totalMinutes + VISIT_MINUTES_GUESS + WALK_MINUTES_GUESS,
          estimatedCostMax: loop.estimatedCostMax + (place.estimatedCost ?? 0),
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
    }),
    [locationMode, neighborhood, timeHours, budget, vibes, loop, isPlanning, places, savedPlaces],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error("usePlan must be used inside PlanProvider");
  }
  return context;
}
