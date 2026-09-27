"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loopie } from "@/components/Loopie";
import { formatCostRange, formatLoopTime } from "@/data/loops";
import { categoryLabel, priceLabel } from "@/data/places";
import {
  budgetChoices,
  detectIntent,
  freeSpots,
  groupChoices,
  isCancel,
  nearbySpots,
  parseBudget,
  parseGroup,
  parseTime,
  questions,
  reAsk,
  starterPrompts,
  surpriseSpot,
  timeChoices,
  toChatPlace,
  type Intent,
} from "@/lib/companion";
import { askLoopie } from "@/lib/api";
import { useLocation } from "@/lib/location-store";
import { isSpeechSupported, listen } from "@/lib/speech";
import { speak, stopSpeaking } from "@/lib/voice";
import { usePlan, type LoopAnswers } from "@/lib/plan-store";
import type { BudgetOption, GroupSize, LoopPlan, Place, TimeOption } from "@/lib/types";

type UserMessage = { id: number; from: "user"; text: string };
type LoopieMessage = {
  id: number;
  from: "loopie";
  text: string;
  places?: Place[];
  loop?: LoopPlan;
  groupSize?: number;
};
type Message = UserMessage | LoopieMessage;
type NewMessage = Omit<UserMessage, "id"> | Omit<LoopieMessage, "id">;

type Step = "start" | "time" | "people" | "budget" | "building";

const GREETING = "Hi, I’m Loopie, your NYC guide! Want me to plan something, or find what’s around you?";

export function CompanionChat({
  hidden,
  question,
  onClose,
  onSelectPlace,
  onShowRoute,
}: {
  hidden: boolean;
  /** A question sent from elsewhere (the map search). A new `id` sends it again. */
  question?: { id: number; text: string };
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
  onShowRoute: () => void;
}) {
  const plan = usePlan();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "loopie", text: GREETING }]);
  const [step, setStep] = useState<Step>("start");
  const [typing, setTyping] = useState(false);
  // Voice (ElevenLabs via /api/speak). Off by default; remembered per browser.
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem("loopie-voice") === "on";
    } catch {
      return false;
    }
  });
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  // Mic (browser speech recognition). Hidden where unsupported (e.g. Firefox).
  const [micSupported] = useState(isSpeechSupported);
  const [listening, setListening] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  // Set when the user spoke, so Loopie answers out loud even with voice off.
  const replyAloud = useRef(false);
  const lastSpokenId = useRef(0);
  const [draft, setDraft] = useState("");
  const answers = useRef<Partial<LoopAnswers>>({});
  const nextId = useRef(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing]);

  useEffect(() => {
    if (hidden) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, onClose]);

  function add(message: NewMessage) {
    setMessages((current) => [...current, { ...message, id: nextId.current++ }]);
  }

  /** Loopie replies after a short "typing…" pause. */
  function loopieSays(message: Omit<LoopieMessage, "id" | "from">, next?: Step) {
    setTyping(true);
    timers.current.push(
      setTimeout(() => {
        setTyping(false);
        add({ from: "loopie", ...message });
        if (next) setStep(next);
      }, 550),
    );
  }

  function runIntent(intent: Intent) {
    if (intent === "itinerary") {
      answers.current = {};
      loopieSays({ text: questions.time }, "time");
    } else if (intent === "nearby") {
      loopieSays({ text: "These saves are closest to you:", places: nearbySpots(plan.savedPlaces) }, "start");
    } else if (intent === "free") {
      loopieSays({ text: "Free things you can do right now:", places: freeSpots(plan.places) }, "start");
    } else {
      const spot = surpriseSpot(plan.savedPlaces);
      if (!spot) return loopieSays({ text: "Save a few spots first and I’ll pick one for you!" });
      loopieSays(
        { text: `How about ${spot.name}? ${spot.description ?? "You saved it a while ago."}`, places: [spot] },
        "start",
      );
    }
  }

  function choose(label: string, action: () => void) {
    add({ from: "user", text: label });
    action();
  }

  async function finishPlan() {
    setStep("building");
    setTyping(true);
    const loop = await plan.buildLoop(answers.current as LoopAnswers);
    setTyping(false);
    add({
      from: "loopie",
      text: loop.stops.length
        ? loop.neighborhood
          ? `Your ${loop.neighborhood} loop is ready!`
          : "Your loop is ready!"
        : "I couldn’t find any saved spots to plan with yet. Add a few spots first!",
      loop: loop.stops.length ? loop : undefined,
      groupSize: answers.current.groupSize,
    });
    setStep("start");
  }

  function onSend(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || step === "building" || typing) return;
    setDraft("");
    void sendText(text);
  }

  async function sendText(text: string) {
    add({ from: "user", text });

    // During the itinerary questions, understand spoken/typed answers too.
    if (step === "time" || step === "people" || step === "budget") {
      if (isCancel(text)) {
        answers.current = {};
        loopieSays({ text: "No problem! What else can I help with?" }, "start");
        return;
      }
      if (step === "time") {
        const value = parseTime(text);
        if (value) answerTime(value);
        else loopieSays({ text: reAsk.time });
      } else if (step === "people") {
        const value = parseGroup(text);
        if (value) answerGroup(value);
        else loopieSays({ text: reAsk.people });
      } else {
        const value = parseBudget(text);
        if (value) answerBudget(value);
        else loopieSays({ text: reAsk.budget });
      }
      return;
    }

    // Typed messages go to Gemini; if it's unavailable, fall back to keywords.
    setTyping(true);
    const ai = await askLoopie({
      messages: [...messages, { from: "user" as const, text }].map(({ from, text }) => ({ from, text })),
      places: plan.places.map(toChatPlace),
      area: location.area ?? undefined,
      liveLocation: location.origin !== null,
    });
    setTyping(false);

    if (ai) {
      add({
        from: "loopie",
        text: ai.reply,
        places: ai.placeIds.map(plan.getPlace).filter((place): place is Place => Boolean(place)),
      });
      if (ai.action === "start_itinerary") {
        answers.current = {};
        loopieSays({ text: questions.time }, "time");
      }
      return;
    }

    const intent = detectIntent(text);
    if (intent) runIntent(intent);
    else loopieSays({ text: "I’m still learning to chat! Try one of these:" });
  }

  // Questions from the map search bar. The ref always holds the latest
  // sendText, and the timeout keeps the state updates out of the effect body.
  const sendTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  useEffect(() => {
    sendTextRef.current = sendText;
  });
  useEffect(() => {
    if (!question) return;
    const timer = setTimeout(() => void sendTextRef.current(question.text), 0);
    return () => clearTimeout(timer);
  }, [question]);

  function playMessage(id: number, text: string) {
    void speak(text, {
      onStart: () => setSpeakingId(id),
      onEnd: () => setSpeakingId((current) => (current === id ? null : current)),
    }).then((ok) => setVoiceUnavailable(!ok));
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    try {
      localStorage.setItem("loopie-voice", next ? "on" : "off");
    } catch {
      // Storage can be blocked; the toggle still works for this session.
    }
    if (next) {
      // Say the latest reply right away (this tap also unlocks audio on phones).
      const lastLoopie = [...messages].reverse().find((m) => m.from === "loopie");
      lastSpokenId.current = messages[messages.length - 1]?.id ?? 0;
      if (lastLoopie) playMessage(lastLoopie.id, lastLoopie.text);
    } else {
      stopSpeaking();
      setSpeakingId(null);
    }
  }

  // With voice on, read each new Loopie reply aloud.
  const playRef = useRef(playMessage);
  useEffect(() => {
    playRef.current = playMessage;
  });
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.from !== "loopie" || last.id <= lastSpokenId.current) return;
    if (!voiceOn && !replyAloud.current) return;
    replyAloud.current = false;
    lastSpokenId.current = last.id;
    playRef.current(last.id, last.text);
  }, [messages, voiceOn]);

  // Stop talking when the chat is hidden or closed.
  useEffect(() => {
    if (!hidden) return;
    stopSpeaking();
    stopListeningRef.current?.();
  }, [hidden]);
  useEffect(
    () => () => {
      stopSpeaking();
      stopListeningRef.current?.();
    },
    [],
  );

  function toggleMic() {
    if (listening) {
      stopListeningRef.current?.(); // onEnd sends whatever was heard
      return;
    }
    if (typing || step === "building") return;
    stopSpeaking(); // so Loopie doesn't hear itself
    setSpeakingId(null);
    setMicHint(null);
    setListening(true);
    stopListeningRef.current = listen({
      onText: (text) => setDraft(text),
      onEnd: (finalText) => {
        setListening(false);
        stopListeningRef.current = null;
        if (!finalText) return;
        setDraft("");
        replyAloud.current = true;
        void sendTextRef.current(finalText);
      },
      onError: (reason) => {
        setListening(false);
        setMicHint(
          reason === "blocked"
            ? "Mic is blocked. Allow it in your browser’s site settings."
            : reason === "no-speech"
              ? "Didn’t catch that. Tap the mic and try again."
              : "The mic isn’t working right now. You can type instead.",
        );
      },
    });
  }

  // One handler per question, shared by the buttons and typed/spoken answers.
  function answerTime(value: TimeOption) {
    answers.current.timeHours = value;
    loopieSays({ text: questions.people }, "people");
  }
  function answerGroup(value: GroupSize) {
    answers.current.groupSize = value;
    loopieSays({ text: questions.budget }, "budget");
  }
  function answerBudget(value: BudgetOption) {
    answers.current.budget = value;
    void finishPlan();
  }

  let choices: { key: string; label: string; onPick: () => void }[] = [];
  if (step === "start") {
    choices = starterPrompts.map((p) => ({ key: p.intent, label: p.label, onPick: () => runIntent(p.intent) }));
  } else if (step === "time") {
    choices = timeChoices.map((c) => ({
      key: c.label,
      label: c.label,
      onPick: () => answerTime(c.value),
    }));
  } else if (step === "people") {
    choices = groupChoices.map((c) => ({
      key: c.label,
      label: c.label,
      onPick: () => answerGroup(c.value),
    }));
  } else if (step === "budget") {
    choices = budgetChoices.map((c) => ({
      key: c.label,
      label: c.label,
      onPick: () => answerBudget(c.value),
    }));
  }

  return (
    <div
      role="dialog"
      aria-label="Chat with Loopie"
      hidden={hidden}
      className="chat-in absolute bottom-[96px] right-4 z-[1002] flex h-[min(480px,calc(100%-124px))] w-[min(340px,calc(100%-32px))] flex-col overflow-hidden rounded-[20px] border border-line bg-paper shadow-[0_8px_28px_rgba(35,26,17,0.18)]"
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Loopie state={typing ? "thinking" : speakingId !== null ? "happy" : "idle"} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-ink">Loopie</p>
          <p className="text-[12px] text-muted">
            {typing
              ? "Thinking…"
              : speakingId !== null
                ? "Speaking…"
                : voiceOn && voiceUnavailable
                  ? "Voice unavailable right now"
                  : "Your NYC guide"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleVoice}
          aria-pressed={voiceOn}
          aria-label={voiceOn ? "Turn off Loopie's voice" : "Turn on Loopie's voice"}
          title={voiceOn ? "Voice on" : "Voice off"}
          className={`grid h-8 w-8 place-items-center rounded-full hover:bg-soft ${voiceOn ? "bg-soft text-red" : "text-muted hover:text-red"}`}
        >
          <SpeakerIcon on={voiceOn} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-soft hover:text-red"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto bg-cream px-3 py-3" aria-live="polite">
        {messages.map((message) =>
          message.from === "user" ? (
            <p
              key={message.id}
              className="ml-auto w-fit max-w-[80%] rounded-[16px] rounded-br-[4px] bg-red px-3 py-2 text-[14px] text-white"
            >
              {message.text}
            </p>
          ) : (
            <div key={message.id} className="max-w-[92%] space-y-2">
              <div className="flex items-end gap-1.5">
                <p className="w-fit rounded-[16px] rounded-bl-[4px] border border-line bg-paper px-3 py-2 text-[14px] leading-5 text-ink">
                  {message.text}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (speakingId === message.id) {
                      stopSpeaking();
                      setSpeakingId(null);
                    } else {
                      playMessage(message.id, message.text);
                    }
                  }}
                  aria-label={speakingId === message.id ? "Stop reading this message" : "Read this message aloud"}
                  className={`mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    speakingId === message.id ? "bg-soft text-red" : "text-muted hover:bg-soft hover:text-red"
                  }`}
                >
                  {speakingId === message.id ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                      <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="currentColor" />
                    </svg>
                  ) : (
                    <SpeakerIcon on={false} small />
                  )}
                </button>
              </div>
              {message.places?.length ? (
                <ul className="space-y-1.5">
                  {message.places.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        onClick={() => onSelectPlace(place)}
                        className="flex w-full items-center gap-2.5 rounded-[12px] border border-line bg-paper p-2 text-left hover:border-red"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={place.image} alt="" className="h-10 w-10 shrink-0 rounded-[8px] object-cover" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink">{place.name}</span>
                          <span className="block text-[12px] text-muted">
                            {[categoryLabel(place.category), place.distance, priceLabel(place)].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {message.loop ? (
                <LoopCard loop={message.loop} groupSize={message.groupSize} onShowRoute={onShowRoute} />
              ) : null}
            </div>
          ),
        )}
        {typing ? (
          <p className="flex w-fit gap-1 rounded-[16px] rounded-bl-[4px] border border-line bg-paper px-3 py-3" aria-label="Loopie is typing">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      {choices.length && !typing ? (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-3 py-2">
          {choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => choose(choice.label, choice.onPick)}
              className="rounded-full border border-red/40 bg-paper px-3 py-1.5 text-[13px] font-semibold text-red hover:bg-soft"
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}

      {micHint ? (
        <p role="status" className="border-t border-line px-3 pt-2 text-[12px] text-red">
          {micHint}
        </p>
      ) : null}
      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-line px-3 py-2 focus-within:bg-soft/40">
        <label className="sr-only" htmlFor="loopie-input">
          Message Loopie
        </label>
        <input
          id="loopie-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={listening ? "Listening…" : "Ask Loopie…"}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink placeholder:text-muted focus:outline-none"
        />
        {micSupported ? (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Talk to Loopie"}
            className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full ${
              listening ? "mic-listening bg-red text-white" : "text-muted hover:bg-soft hover:text-red"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" fill={listening ? "currentColor" : "none"} />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            </svg>
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red text-white disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 8h10M8 3.5 12.5 8 8 12.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function LoopCard({
  loop,
  groupSize = 1,
  onShowRoute,
}: {
  loop: LoopPlan;
  groupSize?: number;
  onShowRoute: () => void;
}) {
  const { getPlace } = usePlan();

  return (
    <div className="rounded-[16px] border border-line bg-paper p-3">
      <ol className="space-y-1.5">
        {loop.stops.map((stop, index) => (
          <li key={stop.id} className="flex items-center gap-2 text-[13px] text-ink">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold">{getPlace(stop.placeId)?.name ?? "Stop"}</span>
            <span className="shrink-0 text-muted">{stop.startTime}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2.5 border-t border-line pt-2 text-[12px] text-muted">
        {formatLoopTime(loop.totalMinutes)} · {formatCostRange(loop.estimatedCostMin, loop.estimatedCostMax)}
        {groupSize > 1 ? " per person" : ""}
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onShowRoute}
          className="rounded-[12px] bg-red py-2 text-[13px] font-semibold text-white hover:bg-red-dark"
        >
          Show on map
        </button>
        <Link
          href="/loops"
          className="rounded-[12px] border border-line py-2 text-center text-[13px] font-semibold text-ink"
        >
          See full loop
        </Link>
      </div>
    </div>
  );
}

function SpeakerIcon({ on, small = false }: { on: boolean; small?: boolean }) {
  const size = small ? 13 : 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity={on ? 1 : 0} />
      {on ? (
        <>
          <path d="M15.5 9a4 4 0 0 1 0 6" />
          <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
        </>
      ) : small ? (
        <path d="M15.5 9a4 4 0 0 1 0 6" />
      ) : (
        <path d="m16 9.5 5 5m0-5-5 5" />
      )}
    </svg>
  );
}
