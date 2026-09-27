import { GoogleGenAI } from "@google/genai";
import type { AiChatReply, AiChatRequest, ChatPlace, ChatTurn } from "@/lib/companion";

// POST /api/chat: Loopie's brain. Runs on the server so GEMINI_API_KEY never
// reaches the browser. Set it in frontend/.env.local (see .env.example).

// Flash-Lite: fastest and the most generous free-tier quota (3.8 Flash allows only ~20 requests/day free).
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const MAX_TURNS = 12;
const MAX_TEXT = 500;
const MAX_PLACES = 60;

const SYSTEM_PROMPT = `You are Loopie, the friendly mascot and NYC guide inside LocalLoop, an app that turns places people saved from TikTok, Instagram and Google Maps into real outings.

How to answer:
- Be warm, casual and brief: at most 2 short sentences (under 45 words). At most one emoji.
- Only recommend places from the SPOTS list below. Mention them by name and put their ids in "placeIds" (max 3, best first). Prefer spots with type "saved by user".
- Never invent addresses, opening hours, prices or events that are not in SPOTS. If you don't know, say so briefly.
- If the user wants you to plan an outing, itinerary, day or loop, set "action" to "start_itinerary" and reply with one short, excited sentence; the app will then ask about time, people and budget.
- Otherwise set "action" to "none".
- If the question has nothing to do with going out in NYC, answer in one friendly line and steer back to their saved spots.
- estimatedCost is in USD per person; 0 means free.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    placeIds: { type: "array", items: { type: "string" } },
    action: { type: "string", enum: ["none", "start_itinerary"] },
  },
  required: ["reply", "placeIds", "action"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not set" }, { status: 503 });
  }

  let body: AiChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messages = sanitizeTurns(body.messages);
  const places = Array.isArray(body.places) ? body.places.slice(0, MAX_PLACES) : [];
  if (!messages.length) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: MODEL,
      system_instruction: `${SYSTEM_PROMPT}\n\n${whereUserIs(body)}\n\nSPOTS:\n${JSON.stringify(places.map(compactPlace))}`,
      input: messages.map((turn) => ({
        type: turn.from === "user" ? ("user_input" as const) : ("model_output" as const),
        content: [{ type: "text" as const, text: turn.text }],
      })),
      response_format: { type: "text", mime_type: "application/json", schema: RESPONSE_SCHEMA },
      store: false,
    });

    const parsed = JSON.parse(interaction.output_text ?? "{}") as Partial<AiChatReply>;
    const knownIds = new Set(places.map((place) => place.id));
    const reply: AiChatReply = {
      reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "Hmm, say that again?",
      placeIds: (Array.isArray(parsed.placeIds) ? parsed.placeIds : []).filter((id) => knownIds.has(id)).slice(0, 3),
      action: parsed.action === "start_itinerary" ? "start_itinerary" : "none",
    };
    return Response.json(reply);
  } catch (error) {
    console.error("[api/chat] Gemini request failed:", error);
    return Response.json({ error: "Gemini request failed" }, { status: 502 });
  }
}

function whereUserIs(body: AiChatRequest) {
  const area = typeof body.area === "string" && body.area.trim() ? body.area.trim().slice(0, 60) : "SoHo";
  return body.liveLocation
    ? `The user is currently in ${area} (from their phone's location). Each spot's "distance" is measured from where they are right now.`
    : `Treat the user as being in ${area}. Each spot's "distance" is measured from there.`;
}

/** Keep the last few turns, trim long text, and start the history on a user turn. */
function sanitizeTurns(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns = raw
    .filter(
      (turn): turn is ChatTurn =>
        Boolean(turn) &&
        (turn.from === "user" || turn.from === "loopie") &&
        typeof turn.text === "string" &&
        turn.text.trim() !== "",
    )
    .map((turn) => ({ from: turn.from, text: turn.text.slice(0, MAX_TEXT) }))
    .slice(-MAX_TURNS);
  const firstUser = turns.findIndex((turn) => turn.from === "user");
  return firstUser === -1 ? [] : turns.slice(firstUser);
}

function compactPlace(place: ChatPlace) {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    neighborhood: place.neighborhood,
    distance: place.distance,
    estimatedCost: place.estimatedCost,
    type: place.kind === "event" ? "event today" : place.saved ? "saved by user" : "LocalLoop find",
    description: place.description,
  };
}
