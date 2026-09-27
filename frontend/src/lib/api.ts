import type { LoopPlan, LoopRequest, Place } from "@/lib/types";
import type { AiChatReply, AiChatRequest } from "@/lib/companion";

// Set NEXT_PUBLIC_API_URL (e.g. http://localhost:4000) to use the real planner.
// Without it, or if the backend is down, callers fall back to demo data.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function requestLoop(body: LoopRequest): Promise<LoopPlan | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/loops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data: { loop?: LoopPlan } = await res.json();
    return data.loop ?? null;
  } catch {
    return null;
  }
}

/**
 * Ask the backend to extract a TikTok/Instagram/Maps link and save the Place.
 */
export async function requestSpotFromLink(link: string): Promise<Place> {
  if (!API_URL) throw new Error("Spot saving is not configured. Set NEXT_PUBLIC_API_URL to the backend URL.");
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/spots/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
  } catch {
    throw new Error("Could not reach the spot service. Check that the backend is running.");
  }
  const data: { place?: Place; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !data.place) throw new Error(data.error || "Could not extract and save this spot.");
  return data.place;
}

// Gemini usually answers in a few seconds but occasionally takes much longer;
// past this, Loopie falls back to its scripted answers instead of hanging.
const LOOPIE_TIMEOUT_MS = 12_000;

/** Ask Loopie (Gemini, via our own /api/chat route). Null means "use the scripted fallback". */
export async function askLoopie(body: AiChatRequest): Promise<AiChatReply | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LOOPIE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as AiChatReply;
  } catch {
    return null;
  }
}
