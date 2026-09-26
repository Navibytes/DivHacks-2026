"use client";

import { useEffect } from "react";
import { AddToLoopButton } from "@/components/AddToLoopButton";
import { categoryLabel, costLabel, sourceLabel, statusLabel } from "@/data/places";
import type { Place } from "@/lib/types";

export function PlaceDetails({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-ink/35"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-title"
        onClick={(event) => event.stopPropagation()}
        className="sheet-in w-full max-w-[430px] rounded-t-[20px] bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={place.image} alt={place.name} className="h-44 w-full rounded-[16px] object-cover" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-paper text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-[12px] font-semibold text-red">{statusLabel(place)}</p>
        <h2 id="place-title" className="mt-1 text-[22px] font-bold tracking-tight text-ink">
          {place.name}
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          {place.neighborhood} · {place.distance}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13px]">
          <div>
            <dt className="text-muted">Category</dt>
            <dd className="mt-1 font-semibold text-ink">{categoryLabel(place.category)}</dd>
          </div>
          <div>
            <dt className="text-muted">Cost</dt>
            <dd className="mt-1 font-semibold text-ink">{costLabel(place.estimatedCost)}</dd>
          </div>
        </dl>
        {sourceLabel(place.source) ? (
          <p className="mt-3 text-[12px] text-muted">{sourceLabel(place.source)}</p>
        ) : null}

        <AddToLoopButton placeId={place.id} className="mt-5 w-full" />
      </div>
    </div>
  );
}
