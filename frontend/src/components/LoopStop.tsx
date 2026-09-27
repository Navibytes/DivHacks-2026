import { categoryLabel, priceLabel } from "@/data/places";
import type { LoopStop as LoopStopType, Place } from "@/lib/types";

export function LoopStop({
  stop,
  place,
  index,
  status = "upcoming",
}: {
  stop: LoopStopType;
  place: Place;
  index: number;
  status?: "upcoming" | "current" | "done";
}) {
  const isEvent = place.kind === "event";

  return (
    <li className="relative pl-12">
      {stop.travelMinutesFromPrevious > 0 ? (
        <p className="flex items-center gap-1.5 py-3 text-[13px] text-muted">
          <WalkIcon />
          {stop.travelMinutesFromPrevious} min walk
        </p>
      ) : null}

      <div className="relative">
        <span
          className={`absolute -left-12 top-4 grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold ring-4 ring-cream ${
            status === "done" ? "bg-soft text-red" : "bg-red text-white"
          }`}
          aria-hidden="true"
        >
          {status === "done" ? "✓" : index}
        </span>

        <article
          className={`flex gap-3 rounded-[16px] border bg-paper p-3 ${
            status === "current" ? "border-red" : "border-line"
          } ${status === "done" ? "opacity-60" : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={place.image} alt="" className="h-16 w-16 shrink-0 rounded-[12px] object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[16px] font-semibold leading-snug text-ink">
                <span className="sr-only">Stop {index}: </span>
                {place.name}
              </h3>
              <span className="shrink-0 text-[13px] font-semibold text-ink">{stop.startTime}</span>
            </div>
            <p className={`mt-0.5 text-[12px] font-semibold ${isEvent || status === "current" ? "text-red" : "text-muted"}`}>
              {status === "current" ? "Up next" : stop.reason}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              {categoryLabel(place.category)} · {priceLabel(place)} · {stop.duration} min
            </p>
          </div>
        </article>
      </div>
    </li>
  );
}

function WalkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="13" cy="4.5" r="2" fill="currentColor" />
      <path
        d="m9 21 2.5-6.5L14 17v4M8 11l3-3.5 3.5 1.5 2 3.5M11.5 14.5 12.5 9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
