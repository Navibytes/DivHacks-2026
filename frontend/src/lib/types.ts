export type PlaceCategory =
  | "coffee"
  | "food"
  | "books"
  | "art"
  | "outdoors"
  | "event";

export type PlaceKind = "saved" | "event" | "find";

export type PlaceSource = "tiktok" | "instagram" | "maps" | "friend" | null;

export type LocationMode = "gps" | "neighborhood";

export type BudgetOption = "free" | "under20" | "under40" | "any";

export type TimeOption = 1 | 2 | 3 | 4;

export type VibeOption =
  | "coffee"
  | "food"
  | "books"
  | "art"
  | "outdoors"
  | "surprise";

export interface Place {
  id: string;
  name: string;
  neighborhood: string;
  category: PlaceCategory;
  distance: string;
  estimatedCost: number;
  saved: boolean;
  source: PlaceSource;
  lat: number;
  lng: number;
  image: string;
  kind: PlaceKind;
}

export interface LoopStop {
  id: string;
  placeId: string;
  startTime: string;
  duration: number;
  travelMinutesFromPrevious: number;
  reason: string;
}

export interface LoopPlan {
  id: string;
  neighborhood: string;
  totalMinutes: number;
  estimatedCostMin: number;
  estimatedCostMax: number;
  stops: LoopStop[];
}

// Body for POST /api/loops (see docs/api-contract.md)
export interface LoopRequest {
  locationMode: LocationMode;
  neighborhood: string;
  timeHours: TimeOption;
  budget: BudgetOption;
  vibes: VibeOption[];
  savedPlaceIds: string[];
}
