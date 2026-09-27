// POST /api/speak: Loopie's voice. Sends text to ElevenLabs text-to-speech and
// returns MP3 audio. Server-only so ELEVENLABS_API_KEY never reaches the browser.

// "Jessica: Playful, Bright, Warm" from ElevenLabs' premade voices. Override
// with ELEVENLABS_VOICE_ID in .env.local.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "cgSgspJ2msm6clMCkdW9";
// Flash v2.5: ~75ms latency and the cheapest per character.
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";
// Loopie's replies are short; this also caps how many credits one call can use.
const MAX_CHARS = 400;

export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ELEVENLABS_API_KEY is not set" }, { status: 503 });
  }

  let text = "";
  try {
    const body = await request.json();
    text = typeof body.text === "string" ? body.text : "";
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  text = cleanForSpeech(text).slice(0, MAX_CHARS);
  if (!text) {
    return Response.json({ error: "Nothing to say" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      console.error("[api/speak] ElevenLabs error", res.status, await res.text());
      return Response.json({ error: "ElevenLabs request failed" }, { status: 502 });
    }
    return new Response(res.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/speak] ElevenLabs request failed:", error);
    return Response.json({ error: "ElevenLabs request failed" }, { status: 502 });
  }
}

/** Drop emojis and tidy whitespace so the voice doesn't read them out. */
function cleanForSpeech(text: string) {
  return text
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
