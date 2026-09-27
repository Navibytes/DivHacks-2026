import { places } from "../data/places.js";
import { generateLoop } from "../planner/generateLoop.js";
import { extractAndSaveSpot } from "../services/spot-extraction.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(res, status, body) {
  res.writeHead(status, corsHeaders);
  res.end(JSON.stringify(body));
}

export function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    json(res, 200, { ok: true, service: "localloop-backend" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/places") {
    const neighborhood = url.searchParams.get("neighborhood");
    const category = url.searchParams.get("category");
    const savedOnly = url.searchParams.get("savedOnly") === "true";

    let result = places;
    if (neighborhood) {
      result = result.filter((p) => p.neighborhood === neighborhood);
    }
    if (category && category !== "all") {
      result = result.filter((p) => p.category === category);
    }
    if (savedOnly) {
      result = result.filter((p) => p.saved);
    }

    json(res, 200, { places: result });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    json(res, 200, { places: places.filter((p) => p.kind === "event") });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/loops") {
    collectBody(req).then((raw) => {
      const payload = raw ? JSON.parse(raw) : {};
      json(res, 200, { loop: generateLoop(payload) });
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/spots/extract") {
    collectBody(req)
      .then((raw) => {
        const payload = raw ? JSON.parse(raw) : {};
        return extractAndSaveSpot(payload.link);
      })
      .then((place) => json(res, 201, { place }))
      .catch((error) => {
        const status = error.statusCode || 500;
        json(res, status, { error: error.message || "Could not extract this spot." });
      });
    return;
  }

  json(res, 404, { error: "Not found" });
}

function collectBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}
