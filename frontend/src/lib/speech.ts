// Talk to Loopie: the browser's built-in speech recognition (Web Speech API).
// Free, no key. Works in Chrome, Edge and Safari; not in Firefox, where
// isSpeechSupported() is false and the mic button is hidden.

// Minimal types: SpeechRecognition isn't in TypeScript's DOM library.
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported() {
  return getRecognition() !== null;
}

export type ListenHandlers = {
  /** Called as words come in; `final` is true once the phrase is done. */
  onText: (text: string, final: boolean) => void;
  /** Called when listening stops, with the final text ("" if nothing was heard). */
  onEnd: (finalText: string) => void;
  onError: (reason: "blocked" | "no-speech" | "failed") => void;
};

/** Starts listening for one phrase. Returns a function that stops early. */
export function listen(handlers: ListenHandlers): () => void {
  const Ctor = getRecognition();
  if (!Ctor) {
    handlers.onError("failed");
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  let finalText = "";
  let latestText = "";
  recognition.onresult = (event) => {
    let text = "";
    let final = false;
    for (let i = 0; i < event.results.length; i++) {
      text += event.results[i][0].transcript;
      final = event.results[i].isFinal;
    }
    latestText = text.trim();
    if (final) finalText = latestText;
    handlers.onText(latestText, final);
  };
  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") handlers.onError("blocked");
    else if (event.error === "no-speech") handlers.onError("no-speech");
    else if (event.error !== "aborted") handlers.onError("failed");
  };
  // Stopping early (tapping the mic again) still sends what was heard so far.
  recognition.onend = () => handlers.onEnd(finalText || latestText);

  try {
    recognition.start();
  } catch {
    handlers.onError("failed");
  }
  return () => recognition.stop();
}
