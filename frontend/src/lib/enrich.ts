import { addressFromCaption, cleanCaption, readTikTok } from "@/lib/new-spot";
import type { Place } from "@/lib/types";

// "Loopie reads the video": pulls a TikTok's caption + thumbnail and asks
// Gemini (via /api/enrich) for a description, must-try item and tags.
// Without Gemini it falls back to the cleaned-up caption. Results are cached
// per video for the session, so each video is only read once.

export type EnrichRequest = { name: string; caption: string };
export type EnrichReply = { description: string; mustTry: string; tags: string[] };

export type VideoDetails = {
  description?: string;
  mustTry?: string;
  tags?: string[];
  address?: string;
  thumbnail?: string;
};

const ENRICH_TIMEOUT_MS = 12_000;
const cache = new Map<string, Promise<VideoDetails>>();

export function detailsFromVideo(name: string, link: string): Promise<VideoDetails> {
  if (!/tiktok\.com\/@[\w.-]+\/video\/\d+/.test(link)) return Promise.resolve({});
  const key = link.split("?")[0];
  let pending = cache.get(key);
  if (!pending) {
    pending = load(name, link);
    cache.set(key, pending);
  }
  return pending;
}

async function load(name: string, link: string): Promise<VideoDetails> {
  const post = await readTikTok(link);
  if (!post?.caption) return { thumbnail: post?.thumbnail };
  const ai = await askGemini({ name, caption: post.caption });
  return {
    description: ai?.description || cleanCaption(post.caption),
    mustTry: ai?.mustTry || undefined,
    tags: ai?.tags.length ? ai.tags : undefined,
    address: addressFromCaption(post.caption),
    thumbnail: post.thumbnail,
  };
}

async function askGemini(body: EnrichRequest): Promise<EnrichReply | null> {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ENRICH_TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as EnrichReply) : null;
  } catch {
    return null;
  }
}

/** Fill in only what the place is missing; never overwrite real data. */
export function applyVideoDetails(place: Place, details: VideoDetails, usesStockPhoto: boolean): Place {
  return {
    ...place,
    description: place.description ?? details.description,
    mustTry: place.mustTry ?? details.mustTry,
    tags: place.tags ?? details.tags,
    address: place.address ?? details.address,
    image: usesStockPhoto && details.thumbnail ? details.thumbnail : place.image,
  };
}
