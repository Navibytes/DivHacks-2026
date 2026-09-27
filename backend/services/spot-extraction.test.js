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
let testId = 0;
const originalEndpoint = process.env.NOMINATIM_URL;

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
  process.env.NOMINATIM_URL = `https://locations.test/search/${++testId}`;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    if (options.method === "DELETE") return json({});
    if (url.endsWith("/upload/v1beta/files")) {
      return new Response("", { headers: { "x-goog-upload-url": "https://upload.test/file" } });
    }
    if (url === "https://upload.test/file") {
      return json({ file: { name: "files/fixture", uri: "https://files.test/audio", state: "ACTIVE" } });
    }
    if (url.startsWith("https://locations.test/")) {
      calls.push("address-search");
      assert.ok(options.headers["User-Agent"].includes("LocalLoop"));
      if (searchStatus !== 200) return json({}, searchStatus);
      return json([{ name: "Strand Book Store", lat: coordinates.latitude, lon: coordinates.longitude, address: { house_number: "828", road: "Broadway", city: "New York", state: "New York", postcode: "10003", country: "United States" } }]);
    }
    assert.ok(url.endsWith(":generateContent"));
    const body = JSON.parse(options.body);
    assert.equal(body.tools, undefined, "Gemini must not perform address searches");
    calls.push("audio-analysis");
    return candidate({ name: "Strand Bookstore", location: "New York City", category: "bookstore", neighborhood: null, transcript: "Visit Strand bookstore in New York City.", price_level: null });
  };
});

after(() => {
  childProcess.execFile = originalExecFile;
  syncBuiltinESMExports();
  globalThis.fetch = originalFetch;
  if (originalEndpoint === undefined) delete process.env.NOMINATIM_URL;
  else process.env.NOMINATIM_URL = originalEndpoint;
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

test("location provider failure is reported without falling back to Gemini search", async () => {
  searchStatus = 429;
  await assert.rejects(extractSpotFromVideo(link), { statusCode: 503, message: /address lookup service is temporarily unavailable/ });
  assert.deepEqual(calls, ["yt-dlp", "yt-dlp", "audio-analysis", "address-search"]);
});
