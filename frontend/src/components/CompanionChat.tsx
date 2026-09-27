"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Loopie } from "@/components/Loopie";
import { formatLoopTime } from "@/data/loops";
import { categoryLabel, costLabel } from "@/data/places";
import {
  budgetChoices,
  detectIntent,
  freeSpots,
  groupChoices,
  nearbySpots,
  questions,
  starterPrompts,
  surpriseSpot,
  timeChoices,
  toChatPlace,
  type Intent,
} from "@/lib/companion";
import { askLoopie } from "@/lib/api";
import { usePlan, type LoopAnswers } from "@/lib/plan-store";
import type { LoopPlan, Place } from "@/lib/types";

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
  onClose,
  onSelectPlace,
  onShowRoute,
  className = "absolute bottom-[96px] right-4",
  style,
}: {
  hidden: boolean;
  onClose: () => void;
  onSelectPlace: (place: Place) => void;
  onShowRoute: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const plan = usePlan();
  const [messages, setMessages] = useState<Message[]>([{ id: 0, from: "loopie", text: GREETING }]);
  const [step, setStep] = useState<Step>("start");
  const [typing, setTyping] = useState(false);
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
      text: `Your ${loop.neighborhood} loop is ready!`,
      loop,
      groupSize: answers.current.groupSize,
    });
    setStep("start");
  }

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || step === "building" || typing) return;
    setDraft("");
    add({ from: "user", text });

    if (step === "time" || step === "people" || step === "budget") {
      loopieSays({ text: "Tap one of the options below and I’ll keep going." });
      return;
    }

    // Typed messages go to Gemini; if it's unavailable, fall back to keywords.
    setTyping(true);
    const ai = await askLoopie({
      messages: [...messages, { from: "user" as const, text }].map(({ from, text }) => ({ from, text })),
      places: plan.places.map(toChatPlace),
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

  let choices: { key: string; label: string; onPick: () => void }[] = [];
  if (step === "start") {
    choices = starterPrompts.map((p) => ({ key: p.intent, label: p.label, onPick: () => runIntent(p.intent) }));
  } else if (step === "time") {
    choices = timeChoices.map((c) => ({
      key: c.label,
      label: c.label,
      onPick: () => {
        answers.current.timeHours = c.value;
        loopieSays({ text: questions.people }, "people");
      },
    }));
  } else if (step === "people") {
    choices = groupChoices.map((c) => ({
      key: c.label,
      label: c.label,
      onPick: () => {
        answers.current.groupSize = c.value;
        loopieSays({ text: questions.budget }, "budget");
      },
    }));
  } else if (step === "budget") {
    choices = budgetChoices.map((c) => ({
      key: c.label,
      label: c.label,
      onPick: () => {
        answers.current.budget = c.value;
        finishPlan();
      },
    }));
  }

  return (
    <div
      role="dialog"
      aria-label="Chat with Loopie"
      hidden={hidden}
      style={style}
      className={`chat-in ${className} z-[1002] flex h-[min(480px,calc(100dvh-180px))] w-[min(340px,calc(100vw-32px))] flex-col overflow-hidden rounded-[20px] border border-line bg-paper shadow-[0_8px_28px_rgba(35,26,17,0.18)]`}
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Loopie state={typing ? "thinking" : "idle"} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-ink">Loopie</p>
          <p className="text-[12px] text-muted">{typing ? "Thinking…" : "Your NYC guide"}</p>
        </div>
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
              <p className="w-fit rounded-[16px] rounded-bl-[4px] border border-line bg-paper px-3 py-2 text-[14px] leading-5 text-ink">
                {message.text}
              </p>
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
                            {categoryLabel(place.category)} · {place.distance} · {costLabel(place.estimatedCost)}
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

      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-line px-3 py-2 focus-within:bg-soft/40">
        <label className="sr-only" htmlFor="loopie-input">
          Message Loopie
        </label>
        <input
          id="loopie-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Loopie…"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink placeholder:text-muted focus:outline-none"
        />
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
        {formatLoopTime(loop.totalMinutes)} · ${loop.estimatedCostMin}–{loop.estimatedCostMax}
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
