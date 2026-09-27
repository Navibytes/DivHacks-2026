// Plays Loopie's replies out loud via our /api/speak route (ElevenLabs).
// Only one clip plays at a time; starting a new one stops the previous.

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export type SpeakHandlers = { onStart?: () => void; onEnd?: () => void };

/** Resolves true if audio started, false if voice is unavailable (no key, error, blocked). */
export async function speak(text: string, handlers: SpeakHandlers = {}): Promise<boolean> {
  stopSpeaking();
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return false;

    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    current = audio;
    currentUrl = url;
    const finish = () => {
      if (current === audio) cleanup();
      handlers.onEnd?.();
    };
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    await audio.play();
    handlers.onStart?.();
    return true;
  } catch {
    handlers.onEnd?.();
    return false;
  }
}

export function stopSpeaking() {
  if (current) {
    current.pause();
    current.dispatchEvent(new Event("ended"));
  }
  cleanup();
}

function cleanup() {
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  current = null;
  currentUrl = null;
}
