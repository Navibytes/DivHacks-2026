export function scorePlace(place, request) {
  let score = 0;
  if (place.saved) score += 40;
  if (request.vibes?.includes(place.category)) score += 25;
  if (place.neighborhood === request.neighborhood) score += 15;
  if (request.budget === "free" && place.estimatedCost === 0) score += 20;
  if (request.budget === "under20" && place.estimatedCost <= 20) score += 10;
  return score;
}
