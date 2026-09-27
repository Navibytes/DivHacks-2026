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
      "location": "123 Example St, New York, NY",
      "neighborhood": "SoHo",
      "category": "coffee",
      "priceLevel": 2,
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

Video extraction returns `location`, `priceLevel` (0–4 or `null`), and a transcript for parsing/debugging. The live `places` table stores the address in `location` and price level in `price_level`; transcript is not persisted.

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

## POST `/api/spots/extract`

Request: `{ "link": "https://www.tiktok.com/..." }`

For TikTok and Instagram links, the backend reads the caption and any external URLs attached to the post, then downloads only the audio for Gemini to return the transcript and structured spot fields together: `name`, `location`, `neighborhood`, `category`, and `price_level` (0–4, or `null` if the post provides no price evidence). If the audio and post metadata are insufficient, it downloads the video locally and sends Gemini screenshots sampled every two seconds (configurable to one second with `SPOT_SCREENSHOT_INTERVAL_SECONDS=1`). Up to 90 screenshots are analyzed. Nominatim looks up the extracted venue name and location before screenshots are needed. It rejects ambiguous branches; screenshots can provide a more specific address for a second lookup. Neighborhood and price level are optional. Gemini is used for media analysis only; address lookup requires no Gemini Search quota. The endpoint saves or updates the matching row in `public.places` and returns `{ "place": Place }`. Extraction or persistence failures return `{ "error": "..." }` with a non-2xx status.

Configure `GEMINI_API_KEY`, `SUPABASE_URL`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`; install `yt-dlp` and `ffmpeg` in the backend runtime. External post URLs are passed to Gemini as clues; the backend does not fetch arbitrary linked websites. Temporary media and Gemini uploads are deleted afterward. Coordinates come from a matching Nominatim venue; missing coordinates cause a clear error rather than a neighborhood-center pin. The address is returned separately in `location`.

The persistence helper targets `public.places` and maps app fields to the live schema (`priceLevel` → `price_level`, video URL → `link`, and address → `location`). It builds a Google Maps search URL in `map_link` while preserving `lat` and `lng` for map pins. Re-submitting a video updates its existing row by `link` and keeps its original database ID.

### Google Places lookup (preferred)

When `GOOGLE_PLACES_API_KEY` is set in `backend/.env`, venue coordinates come from Google Places API (New) Text Search first (biased to New York City, field-masked to name, address, location, address components and Maps link). A result is accepted only if its name matches the extracted venue name and, when the post gave a street number, the address agrees. Google's place link is saved as `map_link`. If Google has no confident match or returns an error, the lookup falls back to Nominatim below.

### Nominatim configuration and usage

`NOMINATIM_URL` can override the search endpoint without a code change; `NOMINATIM_USER_AGENT` identifies this application. The default public endpoint requires no API key. The backend queues requests at least 1.1 seconds apart and caches identical responses for 24 hours in memory (up to 1,000 queries). Run a single backend process with the public endpoint; multiple replicas need a shared limiter/cache or a hosted provider. This is for user-triggered, low-volume saves, not autocomplete or bulk imports. The map displays OpenStreetMap attribution. Follow the [public Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [OpenStreetMap attribution and ODbL terms](https://www.openstreetmap.org/copyright).
