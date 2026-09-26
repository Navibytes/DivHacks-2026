import type { LoopPlan, LoopRequest } from "@/lib/types";

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
