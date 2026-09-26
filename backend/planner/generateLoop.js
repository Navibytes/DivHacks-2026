/**
 * Hackathon planner: filter by vibe/budget/time, prefer saved places, keep walk hops short.
 * Scoring and real geospatial math can replace this without changing the API.
 */
export function generateLoop(request) {
  const neighborhood = request.neighborhood || "SoHo";
  const timeHours = request.timeHours || 3;

  return {
    id: "soho-afternoon",
    neighborhood,
    totalMinutes: timeHours >= 3 ? 155 : timeHours === 2 ? 110 : 70,
    estimatedCostMin: 8,
    estimatedCostMax: request.budget === "free" ? 0 : 18,
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
    ].slice(0, timeHours === 1 ? 2 : 3),
  };
}
