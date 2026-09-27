import { GoogleGenAI } from "@google/genai";
import type { EnrichReply, EnrichRequest } from "@/lib/enrich";

// POST /api/enrich: Loopie "reads the video". Turns a creator's TikTok caption
// about a place into a short description, a must-try item and a few tags.
// Server-only so GEMINI_API_KEY never reaches the browser.

// Flash-Lite: fastest and the most generous free-tier quota (3.8 Flash allows only ~20 requests/day free).
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const MAX_CAPTION = 1500;

const SYSTEM_PROMPT = `You summarize a creator's social media caption about a place in New York City for a place card in the LocalLoop app.

Return:
- "description": one friendly sentence (max 22 words) about what the place is and what the creator thought. Write it in third person about the place, not as the creator. No hashtags, no emojis.
- "mustTry": the single specific item the creator loved most, in Title Case (e.g. "Miso Blondie"). Empty string if the caption doesn't name one.
- "tags": 1 to 3 short tags (1–2 words each, Title Case) describing the place, e.g. "Matcha", "Pastries", "Late Night". No generic tags like "NYC", "Food" or "FYP".

Only use facts from the caption. Never invent prices, hours, addresses or menu items.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    mustTry: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["description", "mustTry", "tags"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not set" }, { status: 503 });
  }

  let body: EnrichRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 120) : "";
  const caption = typeof body.caption === "string" ? body.caption.slice(0, MAX_CAPTION) : "";
  if (!name || !caption.trim()) {
    return Response.json({ error: "Missing name or caption" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: MODEL,
      system_instruction: SYSTEM_PROMPT,
      input: `Place: ${name}\nCaption: ${caption}`,
      response_format: { type: "text", mime_type: "application/json", schema: RESPONSE_SCHEMA },
      store: false,
    });
    const parsed = JSON.parse(interaction.output_text ?? "{}") as Partial<EnrichReply>;
    const reply: EnrichReply = {
      description: typeof parsed.description === "string" ? parsed.description.trim() : "",
      mustTry: typeof parsed.mustTry === "string" ? parsed.mustTry.trim() : "",
      tags: (Array.isArray(parsed.tags) ? parsed.tags : [])
        .filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "")
        .map((tag) => tag.trim())
        .slice(0, 3),
    };
    return Response.json(reply);
  } catch (error) {
    console.error("[api/enrich] Gemini request failed:", error);
    return Response.json({ error: "Gemini request failed" }, { status: 502 });
  }
}
