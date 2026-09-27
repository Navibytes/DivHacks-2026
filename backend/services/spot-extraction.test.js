import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
import { after, beforeEach, test } from "node:test";

const originalExecFile = childProcess.execFile;
const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
const calls = [];
let coordinates;
let searchStatus;
let category;
let testId = 0;
const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;

const execFile = () => {};
execFile[promisify.custom] = async (command, args) => {
  calls.push(command);
  if (command === "ffmpeg") {
    await writeFile(args.at(-1).replace("%03d", "001"), "frame fixture");
    return { stdout: "" };
  }
  assert.equal(command, "yt-dlp");
  if (args.includes("--dump-single-json")) {
    return { stdout: JSON.stringify({ description: "Strand bookstore NYC" }) };
  }
  const audio = args.includes("-x");
  await writeFile(args[args.indexOf("-o") + 1].replace("%(ext)s", audio ? "mp3" : "mp4"), "media fixture");
  return { stdout: "" };
};
childProcess.execFile = execFile;
syncBuiltinESMExports();
const { extractSpotFromVideo } = await import("./spot-extraction.js");

const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const candidate = (value) => json({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] });

beforeEach(() => {
  calls.length = 0;
  coordinates = { latitude: 40.7332548, longitude: -73.9909244 };
  searchStatus = 200;
  category = "bookstore";
  process.env.GOOGLE_MAPS_API_KEY = "maps-test-key";
  testId += 1;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    if (options.method === "DELETE") return json({});
    if (url.endsWith("/upload/v1beta/files")) {
      return new Response("", { headers: { "x-goog-upload-url": "https://upload.test/file" } });
    }
    if (url === "https://upload.test/file") {
      return json({ file: { name: "files/fixture", uri: "https://files.test/audio", state: "ACTIVE" } });
    }
    if (url === "https://places.googleapis.com/v1/places:searchText") {
      calls.push("address-search");
      assert.equal(options.headers["X-Goog-Api-Key"], "maps-test-key");
      if (searchStatus !== 200) return json({}, searchStatus);
      return json({ places: [{ id: "strand", displayName: { text: "Strand Book Store" }, formattedAddress: "828 Broadway, New York, NY 10003, USA", location: { latitude: coordinates.latitude, longitude: coordinates.longitude }, addressComponents: [{ longText: "828", types: ["street_number"] }, { longText: "Broadway", types: ["route"] }, { longText: "New York", types: ["locality"] }] }] });
    }
    assert.ok(url.endsWith(":generateContent"));
    const body = JSON.parse(options.body);
    assert.equal(body.tools, undefined, "Gemini must not perform address searches");
    calls.push("audio-analysis");
    return candidate({ name: "Strand Bookstore", location: "New York City", category, neighborhood: null, transcript: "Visit Strand bookstore in New York City.", price_level: null });
  };
});

after(() => {
  childProcess.execFile = originalExecFile;
  syncBuiltinESMExports();
  globalThis.fetch = originalFetch;
  if (originalMapsKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

const link = "https://www.tiktok.com/@example/video/123";

test("a named venue without a neighborhood resolves its address without screenshots", async () => {
  const place = await extractSpotFromVideo(link);
  assert.equal(place.name, "Strand Book Store");
  assert.equal(place.category, "books");
  assert.equal(place.neighborhood, "");
  assert.equal(place.priceLevel, null);
  assert.equal(place.lat, coordinates.latitude);
  assert.equal(place.lng, coordinates.longitude);
  assert.deepEqual(calls, ["yt-dlp", "yt-dlp", "audio-analysis", "address-search"]);
});

test("missing coordinates cannot become zero or a neighborhood-center pin", async () => {
  coordinates = { latitude: null, longitude: null };
  await assert.rejects(extractSpotFromVideo(link), { statusCode: 422, message: /could not confirm its map coordinates/ });
});

test("missing or unsupported categories do not block extraction or trigger screenshots", async () => {
  for (const value of [null, undefined, "unrecognized"]) {
    category = value;
    const place = await extractSpotFromVideo(link);
    assert.equal(place.category, null);
    assert.equal(place.lat, coordinates.latitude);
  }
  assert.equal(calls.includes("ffmpeg"), false);
  assert.equal(calls.filter((command) => command === "yt-dlp").length, 6);
});

test("a place without a category is sent to Supabase with a null category", async () => {
  const envNames = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PLACES_TABLE"];
  const savedEnv = envNames.map((key) => process.env[key]);
  const mockFetch = globalThis.fetch;
  try {
    process.env.SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.SUPABASE_PLACES_TABLE = "places";
    category = null;
    let inserted;
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith("https://supabase.test/")) return mockFetch(url, options);
      if (options.method === "POST") {
        inserted = JSON.parse(options.body);
        return json([{ id: 999 }], 201);
      }
      return json([]);
    };
    const { extractAndSaveSpot } = await import("./spot-extraction.js");
    const place = await extractAndSaveSpot(link);
    assert.equal(place.id, "999");
    assert.equal(inserted.category, null);
    assert.equal(inserted.lat, coordinates.latitude);
  } finally {
    globalThis.fetch = mockFetch;
    envNames.forEach((key, index) => {
      if (savedEnv[index] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[index];
    });
  }
});

test("location provider failure is reported without falling back to Gemini search", async () => {
  searchStatus = 429;
  await assert.rejects(extractSpotFromVideo(link), { statusCode: 503, message: /temporarily rate limited/ });
  assert.deepEqual(calls, ["yt-dlp", "yt-dlp", "audio-analysis", "address-search"]);
});
