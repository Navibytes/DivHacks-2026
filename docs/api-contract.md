# LocalLoop API contract

Base URL (local): `http://localhost:4000`

All JSON uses camelCase. Types live in `shared/types/index.ts`.

## GET `/api/health`

```json
{ "ok": true, "service": "localloop-backend" }
```

## GET `/api/places`

Query: `neighborhood?`, `category?`, `savedOnly?`

```json
{
  "places": [
    {
      "id": "matchaful",
      "name": "Matchaful",
      "neighborhood": "SoHo",
      "category": "coffee",
      "distance": "0.2 mi",
      "estimatedCost": 8,
      "saved": true,
      "source": "tiktok",
      "lat": 40.7234,
      "lng": -74.0028,
      "image": "https://example.com/photo.jpg",
      "kind": "saved"
    }
  ]
}
```

`kind`: `"saved"` | `"event"` | `"find"`

`source`: `"tiktok"` | `"instagram"` | `"maps"` | `"friend"` | `null`

`category`: `"coffee"` | `"food"` | `"books"` | `"art"` | `"outdoors"` | `"event"`

## GET `/api/events`

Query: `neighborhood?`, `date?` (YYYY-MM-DD)

Same `places` array shape; events use `kind: "event"`.

## POST `/api/loops`

Request:

```json
{
  "locationMode": "neighborhood",
  "neighborhood": "SoHo",
  "timeHours": 3,
  "budget": "under20",
  "vibes": ["coffee", "books"],
  "savedPlaceIds": ["matchaful", "housing-works"]
}
```

`locationMode`: `"gps"` | `"neighborhood"`

`budget`: `"free"` | `"under20"` | `"under40"` | `"any"`

`timeHours`: `1` | `2` | `3` | `4` (`4` means “More”)

Response:

```json
{
  "loop": {
    "id": "soho-afternoon",
    "neighborhood": "SoHo",
    "totalMinutes": 155,
    "estimatedCostMin": 8,
    "estimatedCostMax": 18,
    "stops": [
      {
        "id": "stop-1",
        "placeId": "matchaful",
        "startTime": "12:00 PM",
        "duration": 45,
        "travelMinutesFromPrevious": 0,
        "reason": "Saved by you"
      }
    ]
  }
}
```

Frontend may show a 800–1200ms planning overlay before navigating to `/loops`. That delay is UI-only, not part of the API.
