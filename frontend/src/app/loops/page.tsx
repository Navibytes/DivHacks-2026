"use client";

import Link from "next/link";
import { useState } from "react";
import { Loopie } from "@/components/Loopie";
import { LoopStop } from "@/components/LoopStop";
import { formatLoopTime } from "@/data/loops";
import { getPlace } from "@/data/places";
import { usePlan } from "@/lib/plan-store";
import type { Place } from "@/lib/types";

export default function LoopsPage() {
  const { loop } = usePlan();
  // null = not started; otherwise the index of the stop you're at.
  const [current, setCurrent] = useState<number | null>(null);

  const stops = loop.stops
    .map((stop) => ({ stop, place: getPlace(stop.placeId) }))
    .filter((item): item is { stop: (typeof loop.stops)[number]; place: Place } =>
      Boolean(item.place),
    );

  const finished = current !== null && current >= stops.length;
  const message =
    current === null
      ? "Your loop is ready."
      : finished
        ? "That’s a wrap. Nice loop!"
        : `Head to ${stops[current].place.name}.`;

  function advance() {
    setCurrent((value) => (value === null ? 0 : value + 1));
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/" className="text-[13px] font-semibold text-red">
          ← Edit plan
        </Link>
        <h1 className="mt-3 text-[28px] font-extrabold tracking-tight text-ink">Your Loop</h1>
        <p className="mt-3 text-[18px] font-semibold text-ink">{loop.neighborhood}</p>
        <p className="mt-1 text-[14px] text-muted">
          {formatLoopTime(loop.totalMinutes)} · ${loop.estimatedCostMax} estimated
        </p>
      </header>

      <div className="flex items-center gap-3 rounded-[16px] border border-line bg-paper px-4 py-3">
        <Loopie key={message} state={current === null || finished ? "happy" : "idle"} size={56} />
        <p className="text-[16px] font-semibold text-ink" aria-live="polite">
          {message}
        </p>
      </div>

      <ol className="relative">
        <span
          aria-hidden="true"
          className="absolute bottom-10 left-[15px] top-8 w-0.5 rounded-full bg-line"
        />
        {stops.map(({ stop, place }, index) => (
          <LoopStop
            key={stop.id}
            stop={stop}
            place={place}
            index={index + 1}
            status={
              current === null || index > current
                ? "upcoming"
                : index === current
                  ? "current"
                  : "done"
            }
          />
        ))}
      </ol>

      <dl className="grid grid-cols-2 rounded-[16px] border border-line bg-paper p-4 text-[13px]">
        <div>
          <dt className="text-muted">Total time</dt>
          <dd className="mt-1 text-[16px] font-semibold text-ink">
            {formatLoopTime(loop.totalMinutes)}
          </dd>
        </div>
        <div className="border-l border-line pl-4">
          <dt className="text-muted">Estimated cost</dt>
          <dd className="mt-1 text-[16px] font-semibold text-ink">
            ${loop.estimatedCostMin}–{loop.estimatedCostMax}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        {finished ? (
          <button
            type="button"
            onClick={() => setCurrent(null)}
            className="w-full rounded-[16px] bg-red py-4 text-[16px] font-semibold text-white hover:bg-red-dark"
          >
            Start over
          </button>
        ) : (
          <button
            type="button"
            onClick={advance}
            className="w-full rounded-[16px] bg-red py-4 text-[16px] font-semibold text-white hover:bg-red-dark"
          >
            {current === null
              ? "Start my loop"
              : current === stops.length - 1
                ? "Finish loop"
                : "Next stop"}
          </button>
        )}
        <Link
          href="/saved?route=1"
          className="block w-full rounded-[16px] border border-line bg-paper py-4 text-center text-[16px] font-semibold text-ink"
        >
          View on map
        </Link>
      </div>
    </div>
  );
}
