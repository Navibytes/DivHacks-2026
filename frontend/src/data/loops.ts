import type { LoopPlan } from "@/lib/types";

export const demoLoop: LoopPlan = {
  id: "soho-afternoon",
  neighborhood: "Nearby",
  totalMinutes: 155,
  estimatedCostMin: 8,
  estimatedCostMax: 18,
  stops: [
    {
      id: "stop-1",
      placeId: "matchaful",
      startTime: "12:00 PM",
      duration: 45,
      travelMinutesFromPrevious: 0,
      reason: "Saved by you",
    },
    {
      id: "stop-2",
      placeId: "housing-works",
      startTime: "12:50 PM",
      duration: 40,
      travelMinutesFromPrevious: 7,
      reason: "Saved by you",
    },
    {
      id: "stop-3",
      placeId: "soho-art-market",
      startTime: "1:45 PM",
      duration: 50,
      travelMinutesFromPrevious: 9,
      reason: "Happening today",
    },
  ],
};

export function formatLoopTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours} hr ${minutes} min`;
  if (hours) return `${hours} hr`;
  return `${minutes} min`;
}
