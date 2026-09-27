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

/** 1 = just me, 2 = two people, 3 = a group of 3+ */
export type GroupSize = 1 | 2 | 3;

export type VibeOption =
  | "coffee"
  | "food"
  | "books"
  | "art"
  | "outdoors"
  | "surprise";

/** The TikTok/Instagram post a spot was saved from. */
export interface SourceVideo {
  platform: "tiktok" | "instagram";
  url: string;
  /** "@handle", or "" when the link doesn't say (Instagram links don't). */
  creator: string;
}

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
  description?: string;
  video?: SourceVideo;
  // Optional extras. The UI only shows the ones that are present.
  address?: string;
  /** Opening hours or, for events, when it's happening ("Today · 11 AM – 6 PM"). */
  hours?: string;
  rating?: { score: number; count: number };
  /** Short facts like "Vegan" or "Cash only" (the first 3 are shown). */
  tags?: string[];
  mustTry?: string;
  /** ISO date the user saved it. */
  savedAt?: string;
  /** 1–3, shown as $–$$$ (from Supabase `price_level`). */
  priceLevel?: number;
  /** Original post or website the spot came from. */
  link?: string;
  /** Google Maps link for the place (Supabase `map_link`). */
  mapLink?: string;
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
  groupSize: GroupSize;
  /** The user's current position, when known. */
  origin?: { lat: number; lng: number };
  budget: BudgetOption;
  vibes: VibeOption[];
  savedPlaceIds: string[];
}
