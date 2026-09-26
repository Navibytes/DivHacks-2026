# LocalLoop architecture

LocalLoop is a NYC local discovery app: **turn your saves into today’s plan**.

This repo is a small full-stack monorepo. Frontend and backend stay separate so teammates can work in parallel during DivHacks.

## Folder structure

```
DivHacks-2026/
  frontend/          Next.js + TypeScript + Tailwind (UI)
    src/
      app/           routes: /, /map, /saved, /loops
      components/    reusable UI only
      data/          mock places + loops for the demo
      lib/           client helpers, plan state
      styles/        design tokens
    public/
  backend/           itinerary generation + APIs (stubs for the hackathon)
    app/
    routes/
    services/
    planner/
    data/
  shared/
    types/           TypeScript contracts used by both sides
  docs/
    architecture.md
    api-contract.md
  grgr.html          ignore — not part of LocalLoop
```

Ignore `grgr.html`. It is not a design reference and is not part of the app.

## Responsibilities

### Frontend (`frontend/`)

- Screens, layout, and bottom navigation
- Map rendering and marker taps
- Location / time / budget / vibe pickers
- Loopie mascot states
- Displaying saved places and generated loops
- Local demo state when the API is not running

Do **not** put scoring, geospatial filtering, or itinerary generation inside React components.

### Backend (`backend/`)

- `POST /api/loops` itinerary generation
- Geospatial filtering (nearby, walk times)
- Budget and time constraints
- Place scoring
- Local events integration
- REST endpoints the UI will call

### Shared (`shared/`)

- Place, loop, stop, and request/response TypeScript types
- JSON field names both sides agree on

## Data flow

```
Home (choices)
  → Planning overlay (UI only)
  → POST /api/loops  { location, timeHours, budget, vibes, savedPlaceIds }
  → planner scores places + events
  → Loop response
  → Loops screen + Map
```

For the live demo, the frontend can fall back to `frontend/src/data/loops.ts` if the backend is not running. The shape of that mock data matches `shared/types`.

## API contract (summary)

See [api-contract.md](./api-contract.md) for request/response JSON.

Main endpoints:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/health` | Backend is up |
| GET | `/api/places` | Saved + discovery places |
| GET | `/api/events` | Nearby events |
| POST | `/api/loops` | Generate today’s itinerary |

## How teammates work independently

**Frontend teammate**

1. `cd frontend && npm install && npm run dev`
2. Edit screens under `frontend/src/app`
3. Edit UI under `frontend/src/components`
4. Use mock data in `frontend/src/data` until the API is ready
5. Do not import files from `backend/`

**Backend teammate**

1. `cd backend && npm install && npm run dev`
2. Implement `planner/` and `routes/`
3. Keep payloads matching `shared/types`
4. Do not put HTML/CSS in the backend

**Shared types teammate**

1. Change `shared/types/index.ts`
2. Tell frontend + backend if a field name changed
3. Update `docs/api-contract.md`

Keep the planner simple: filter by neighborhood + time + budget + vibe, then order stops by walk distance. That is enough for a hackathon demo.
