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
 * Ask the backend to turn a TikTok/Instagram/Maps link into a Place
 * (name, category, address/coordinates, description). Returns null when
 * there's no backend or it can't handle it, so the UI can fall back.
 */
export async function requestSpotFromLink(link: string): Promise<Place | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/api/spots/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
    if (!res.ok) return null;
    const data: { place?: Place } = await res.json();
    return data.place ?? null;
  } catch {
    return null;
  }
}

/** Ask Loopie (Gemini, via our own /api/chat route). Null means "use the scripted fallback". */
export async function askLoopie(body: AiChatRequest): Promise<AiChatReply | null> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as AiChatReply;
  } catch {
    return null;
  }
}
