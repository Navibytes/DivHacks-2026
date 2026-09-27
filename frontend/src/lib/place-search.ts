export interface PlaceSearchSource {
  title: string;
  url: string;
}

export interface PlaceSearchRequest {
  query: string;
  platform: string;
  caption: string;
  aiClue: string;
}

export interface PlaceSearchResponse {
  found: boolean;
  name: string;
  address: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  sources: PlaceSearchSource[];
}