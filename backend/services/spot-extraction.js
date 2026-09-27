import { lookupVenue } from "./location-lookup.js";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const categories = [
  ["coffee", /coffee|caf[eé]|espresso|latte|matcha|tea\b/i],
  ["books", /book|library|reading/i],
  ["art", /art\b|gallery|museum|mural|exhibit/i],
  ["outdoors", /park|garden|island|pier|trail|picnic/i],
  ["food", /pizza|restaurant|taco|burger|bagel|dumpling|brunch|bakery|ramen|dinner|lunch/i],
  ["event", /event|festival|concert|show|market|pop[- ]?up/i],
];
const neighborhoods = {
  "SoHo": { lat: 40.7233, lng: -74.003 },
  "West Village": { lat: 40.7358, lng: -74.0036 },
  "Greenwich Village": { lat: 40.7336, lng: -73.999 },
  "East Village": { lat: 40.7265, lng: -73.9815 },
  "Lower East Side": { lat: 40.715, lng: -73.9843 },
  "Chelsea": { lat: 40.7465, lng: -74.0014 },
  "Chinatown": { lat: 40.7158, lng: -73.997 },
  "Tribeca": { lat: 40.7163, lng: -74.0086 },
  "Flatiron": { lat: 40.7405, lng: -73.9903 },
  "NoMad": { lat: 40.744, lng: -73.988 },
  "Williamsburg": { lat: 40.7081, lng: -73.9571 },
  "Bushwick": { lat: 40.6944, lng: -73.9213 },
  "DUMBO": { lat: 40.7033, lng: -73.9881 },
  "Upper West Side": { lat: 40.787, lng: -73.9754 },
  "Upper East Side": { lat: 40.7736, lng: -73.9566 },
  "Harlem": { lat: 40.8116, lng: -73.9465 },
};

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function supportedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw fail("Paste a valid TikTok, Instagram, or Google Maps link.");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const mapsLink = (host === "google.com" || host === "maps.google.com") && url.pathname.startsWith("/maps");
  if (!["tiktok.com", "instagram.com", "maps.app.goo.gl", "goo.gl"].includes(host) && !mapsLink) {
    throw fail("Paste a TikTok, Instagram, or Google Maps link.");
  }
  return { url: url.toString(), host };
}

function sourceFor(host) {
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("instagram")) return "instagram";
  return "maps";
}

async function readPost(url) {
  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--no-warnings", "--skip-download", "--dump-single-json", url], { timeout: 25_000, maxBuffer: 4 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function linksFromPost(post, caption, sourceUrl) {
  const candidates = [caption, post?.link, post?.external_url, post?.shortlink, JSON.stringify(post?.links || "")]
    .flatMap((value) => typeof value === "string" ? value.match(/https?:\/\/[^\s<>"')\]]+/gi) || [] : []);
  const self = new URL(sourceUrl).hostname.replace(/^www\./, "");
  return [...new Set(candidates.map((value) => value.replace(/[.,;!?]+$/, "")))].filter((value) => {
    try {
      const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
      return host !== self && !host.endsWith("tiktok.com") && !host.endsWith("instagram.com") && !host.endsWith("youtube.com");
    } catch { return false; }
  }).slice(0, 12);
}

function normalizedCategory(value) {
  const category = typeof value === "string" ? value.trim().toLowerCase() : "";
  const aliases = { bookstore: "books", "book store": "books", cafe: "coffee", café: "coffee", restaurant: "food", park: "outdoors", gallery: "art" };
  const normalized = aliases[category] || category;
  return categories.some(([name]) => name === normalized) ? normalized : null;
}

function hasCoordinates(analysis) {
  return Number.isFinite(analysis.latitude) && Math.abs(analysis.latitude) <= 90
    && Number.isFinite(analysis.longitude) && Math.abs(analysis.longitude) <= 180;
}

async function analyzeVideo(url, caption, postLinks, stage) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw fail("Video analysis is not configured: set GEMINI_API_KEY on the backend.", 503);
  const dir = await mkdtemp(join(tmpdir(), "localloop-spot-"));
  const uploadedFileNames = [];
  try {
    const model = process.env.GEMINI_VIDEO_MODEL || "gemini-3.5-flash-lite";
    async function askGemini(parts, jsonResponse = false) {
      let result;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts }], ...(jsonResponse ? { generationConfig: { responseMimeType: "application/json" } } : {}) }),
          signal: AbortSignal.timeout(180_000),
        });
        result = await response.json();
        if (response.ok) break;
        if (![429, 503].includes(response.status) || attempt === 2) throw new Error(`Gemini analysis failed (${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, 3_000 * (attempt + 1)));
      }
      const output = (result.candidates?.[0]?.content?.parts || []).filter((item) => item.text).map((item) => item.text).join("\n");
      if (!output.trim()) throw new Error("Gemini returned an empty analysis");
      return output;
    }
    async function uploadAndAnalyze(path, mimeType, displayName, makeParts) {
      const size = (await stat(path)).size;
      if (size > 100 * 1024 * 1024) throw new Error("Media is too large to analyze");
      const start = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(size), "X-Goog-Upload-Header-Content-Type": mimeType, "Content-Type": "application/json" },
        body: JSON.stringify({ file: { display_name: `${displayName}-${Date.now()}` } }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!start.ok) throw new Error(`Gemini upload setup failed (${start.status})`);
      const uploadUrl = start.headers.get("x-goog-upload-url");
      if (!uploadUrl) throw new Error("Gemini did not return an upload URL");
      const uploaded = await fetch(uploadUrl, { method: "POST", headers: { "Content-Length": String(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" }, body: await readFile(path), signal: AbortSignal.timeout(120_000) });
      if (!uploaded.ok) throw new Error(`Gemini media upload failed (${uploaded.status})`);
      const data = await uploaded.json();
      const file = data.file || data;
      if (file.name) uploadedFileNames.push(file.name);
      if (!file.name || !file.uri) throw new Error("Gemini did not return the uploaded file details");
      let readyFile = file;
      for (let attempt = 0; readyFile.state === "PROCESSING" && attempt < 24; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15_000) });
        if (!status.ok) throw new Error(`Gemini media processing status failed (${status.status})`);
        readyFile = await status.json();
        if (readyFile.state === "FAILED") throw new Error("Gemini could not process the media");
      }
      if (readyFile.state && readyFile.state !== "ACTIVE") throw new Error("Gemini media processing timed out");
      return makeParts(file, mimeType);
    }
    const audioPath = join(dir, "audio.%(ext)s");
    await stage("audio-download", () => execFileAsync("yt-dlp", ["--no-warnings", "-f", "bestaudio/best", "-x", "--audio-format", "mp3", "-o", audioPath, url], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 }));
    const audioFile = (await readdir(dir)).find((entry) => entry === "audio.mp3");
    if (!audioFile) throw new Error("yt-dlp did not produce an audio file");
    const audioMime = audioFile.endsWith(".webm") ? "audio/webm" : audioFile.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
    const audioPrompt = `Listen to the audio and extract the place featured in the post. Return the full intelligible speech verbatim as transcript, plus place fields. Use the transcript, caption, and attached post links as clues; do not claim a link proves a place unless its URL or context supports that. Caption/bio: ${caption}\nPost links: ${postLinks.join(" | ") || "none"}\nReturn only JSON: transcript (string), name (official venue name or null), location (most specific supported address/location or null), neighborhood (one of ${Object.keys(neighborhoods).join(", ")} if supported, otherwise null), category (one of coffee, food, books, art, outdoors, event, or null), price_level (integer 0-4 or null). Do not invent an address or price level.`;
    const audioText = await stage("audio-analysis", () => uploadAndAnalyze(join(dir, audioFile), audioMime, "localloop-audio", (file, mime) => [
      { file_data: { file_uri: file.uri, mime_type: file.mimeType || mime } },
      { text: audioPrompt },
    ]).then((parts) => askGemini(parts, true)));
    const audioJson = audioText.match(/\{[\s\S]*\}/)?.[0];
    if (!audioJson) throw new Error("Gemini did not return structured transcript data");
    let transcriptResult = JSON.parse(audioJson);
    const transcript = typeof transcriptResult.transcript === "string" ? transcriptResult.transcript : "";
    // Resolve a named venue before downloading screenshots just to find its address.
    if (transcriptResult.name && normalizedCategory(transcriptResult.category)) {
      transcriptResult = await stage("address-search", () => findPlaceAddress(transcriptResult, caption, transcript, postLinks));
      if (transcriptResult.location && hasCoordinates(transcriptResult)) return transcriptResult;
    }

    const videoPathPattern = join(dir, "video.%(ext)s");
    await stage("video-download", () => execFileAsync("yt-dlp", ["--no-warnings", "-f", "best[ext=mp4]/best", "-o", videoPathPattern, url], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 }));
    const videoFile = (await readdir(dir)).find((entry) => entry.startsWith("video."));
    if (!videoFile) return transcriptResult;
    const interval = process.env.SPOT_SCREENSHOT_INTERVAL_SECONDS === "1" ? 1 : 2;
    const framesDir = join(dir, "frames");
    await mkdir(framesDir);
    await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", join(dir, videoFile), "-vf", `fps=1/${interval},scale=720:-1`, "-q:v", "5", "-frames:v", "90", join(framesDir, "frame-%03d.jpg")], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    const frameFiles = (await readdir(framesDir)).filter((entry) => entry.endsWith(".jpg")).sort();
    const imageParts = await Promise.all(frameFiles.map(async (entry) => ({ inline_data: { mime_type: "image/jpeg", data: (await readFile(join(framesDir, entry))).toString("base64") } })));
    const visualText = await stage("screenshot-analysis", () => askGemini([
      { text: `The audio transcript and post metadata did not fully identify the place. Inspect these screenshots sampled every ${interval} seconds. Read visible venue signs, addresses, menus, and price clues. Use post links as clues: ${postLinks.join(" | ") || "none"}. Transcript: ${transcript}\nCaption/bio: ${caption}\nReturn JSON fields name, location, neighborhood, category, price_level, transcript. Use null for unsupported fields; do not invent details.` },
      ...imageParts,
    ], true));
    const visualJson = visualText.match(/\{[\s\S]*\}/)?.[0];
    if (!visualJson) return transcriptResult;
    const visualResult = JSON.parse(visualJson);
    const combined = { ...transcriptResult, ...Object.fromEntries(Object.entries(visualResult).filter(([, value]) => value !== null && value !== "")), transcript };
    return await stage("address-search-after-screenshots", () => findPlaceAddress(combined, caption, transcript, postLinks));
  } catch (error) {
    if (error.statusCode) throw error;
    console.error("Gemini video analysis failed:", error.message);
    throw fail("Could not analyze the video. Check the link, yt-dlp availability, and Gemini API key.", 502);
  } finally {
    for (const uploadedFileName of uploadedFileNames) {
      await fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadedFileName}`, {
        method: "DELETE",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(5_000),
      }).catch(() => {});
    }
    await rm(dir, { recursive: true, force: true });
  }
}

async function findPlaceAddress(analysis) {
  if (!analysis.name) return analysis;
  const found = await lookupVenue(analysis.name, analysis.location || analysis.neighborhood);
  // Only the location provider supplies coordinates; model coordinates aren't verified.
  return { ...analysis, latitude: undefined, longitude: undefined, ...(found || {}) };
}

function makePlace({ analysis, caption, source, url, creator }) {
  const name = typeof analysis.name === "string" ? analysis.name.trim() : "";
  const location = typeof analysis.location === "string" ? analysis.location.trim() : "";
  const category = normalizedCategory(analysis.category);
  const reportedNeighborhood = String(analysis.neighborhood || "").toLowerCase();
  const neighborhood = Object.keys(neighborhoods).find((area) => reportedNeighborhood.includes(area.toLowerCase())) || "";
  const reportedPrice = analysis.price_level;
  const priceLevel = Number.isInteger(reportedPrice) && reportedPrice >= 0 && reportedPrice <= 4
    ? reportedPrice
    : typeof reportedPrice === "string" && /^\${1,4}$/.test(reportedPrice.trim())
      ? reportedPrice.trim().length
      : typeof reportedPrice === "string" && reportedPrice.trim().toLowerCase() === "free"
        ? 0
        : null;
  const missing = [!name && "place name", !location && "address", !category && "category"].filter(Boolean);
  if (missing.length) {
    console.warn("Spot extraction missing required fields:", missing.join(", "));
    throw fail(`Could not identify the ${missing.join(" and ")} from this video. Try a post that names or shows the location clearly.`, 422);
  }
  if (!hasCoordinates(analysis)) {
    throw fail(`Identified ${name}, but could not confirm its map coordinates. Please try again.`, 422);
  }
  const description = caption.replace(/[#@][\p{L}\p{N}_.]+/gu, "").replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name,
    location,
    neighborhood,
    category,
    priceLevel,
    transcript: typeof analysis.transcript === "string" ? analysis.transcript.trim() : "",
    distance: "0.0 mi",
    estimatedCost: category === "coffee" ? 7 : category === "food" ? 15 : 0,
    saved: true,
    source,
    lat: analysis.latitude,
    lng: analysis.longitude,
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    kind: "saved",
    description,
    video: source === "maps" ? undefined : { platform: source, url, creator: creator ? `@${creator}` : source },
    createdAt: now,
  };
}

async function savePlace(place) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key || supabaseUrl.includes("your-project") || key.includes("your-server-only")) {
    throw fail("Spot saving is not configured: set a real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.", 503);
  }
  const table = process.env.SUPABASE_PLACES_TABLE || "places";
  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(table)}`;
  const videoLink = place.video?.url;
  if (!videoLink) throw fail("Only video-backed spots can be saved by this endpoint.", 422);
  const mapUrl = new URL("https://www.google.com/maps/search/");
  mapUrl.searchParams.set("api", "1");
  mapUrl.searchParams.set("query", place.location || `${place.lat},${place.lng}`);
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const values = {
    name: place.name,
    category: place.category,
    location: place.location,
    price_level: place.priceLevel,
    lat: place.lat,
    lng: place.lng,
    link: videoLink,
    map_link: mapUrl.toString(),
  };
  async function findByVideoLink() {
    const lookup = new URL(baseUrl);
    lookup.searchParams.set("select", "id");
    lookup.searchParams.set("link", `eq.${videoLink}`);
    lookup.searchParams.set("limit", "1");
    const response = await fetch(lookup, { headers });
    if (!response.ok) throw fail("Could not check whether this video was already saved.", 502);
    const rows = await response.json();
    return Array.isArray(rows) ? rows[0] : null;
  }
  async function updateExisting(existing) {
    const updateUrl = new URL(baseUrl);
    updateUrl.searchParams.set("id", `eq.${existing.id}`);
    const response = await fetch(updateUrl, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(values),
    });
    if (!response.ok) throw fail("The existing spot was found, but it could not be updated.", 502);
    return String(existing.id);
  }
  try {
    const existing = await findByVideoLink();
    if (existing) return await updateExisting(existing);
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(values),
    });
    if (response.ok) {
      const rows = await response.json();
      if (rows?.[0]?.id === undefined || rows?.[0]?.id === null) throw fail("Supabase saved the place but did not return its generated ID.", 502);
      return String(rows[0].id);
    }
    if (response.status === 409) {
      // Another request may have inserted the same source URL after our lookup.
      const racedRow = await findByVideoLink();
      if (racedRow) return await updateExisting(racedRow);
    }
    const detail = (await response.text()).slice(0, 300);
    console.error("Supabase spot insert failed:", response.status, detail);
    throw fail("The place was extracted, but Supabase could not save it. Check the places table schema and server credentials.", 502);
  } catch (error) {
    if (error.statusCode) throw error;
    throw fail("Could not reach Supabase. Check SUPABASE_URL and network access.", 503);
  }
}

export async function extractSpotFromVideo(input) {
  if (typeof input !== "string" || !input.trim()) throw fail("Paste a video or Maps link.");
  const { url, host } = supportedUrl(input.trim());
  const source = sourceFor(host);
  const requestId = randomUUID().slice(0, 8);
  const stage = async (name, run) => {
    const started = Date.now();
    try { return await run(); }
    finally { console.info(`[spot ${requestId}] ${name}: ${Date.now() - started}ms`); }
  };
  const post = source === "maps" ? null : await stage("post-metadata", () => readPost(url));
  if (source === "maps") throw fail("Google Maps links are not supported by video analysis yet. Paste the TikTok or Instagram post.", 422);
  const caption = [post?.description, post?.fulltitle, post?.title].filter(Boolean).join("\n");
  const postLinks = linksFromPost(post, caption, url);
  const analysis = await analyzeVideo(url, caption.slice(0, 6_000), postLinks, stage);
  const place = makePlace({ analysis, caption, source, url, creator: post?.uploader_id || post?.channel });
  const { createdAt: _createdAt, ...clientPlace } = place;
  return clientPlace;
}

export async function extractAndSaveSpot(input) {
  const place = await extractSpotFromVideo(input);
  const id = await savePlace(place);
  return id === place.id ? place : { ...place, id };
}
