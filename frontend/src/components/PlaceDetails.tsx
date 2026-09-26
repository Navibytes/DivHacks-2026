"use client";

import { useEffect, useState } from "react";
import { AddToLoopButton } from "@/components/AddToLoopButton";
import { DirectionsIcon, PlaceFacts, directionsUrl } from "@/components/PlaceFacts";
import { VideoPreview } from "@/components/VideoPreview";
import { VideoSheet } from "@/components/VideoSheet";
import { categoryLabel, sourceLabel, statusLabel } from "@/data/places";
import { platformName } from "@/lib/video";
import type { Place } from "@/lib/types";

export function PlaceDetails({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (playing) return; // Escape closes the video first
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, playing]);

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
        className="sheet-in max-h-[92dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[20px] bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div className="relative">
          <VideoPreview
            place={place}
            onPlay={() => setPlaying(true)}
            className="block h-48 w-full rounded-[16px]"
          />
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
          {categoryLabel(place.category)} · {place.neighborhood} · {place.distance}
        </p>

        {place.description ? (
          <p className="mt-3 text-[14px] leading-6 text-ink">{place.description}</p>
        ) : null}

        <div className="mt-4 border-t border-line pt-4">
          <PlaceFacts place={place} />
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Found on{" "}
          {place.video
            ? `${platformName(place.video)} · ${place.video.creator}`
            : (sourceLabel(place.source)?.replace("Saved from ", "") ?? "LocalLoop")}
        </p>

        <div className={`mt-5 grid gap-2 ${place.video ? "grid-cols-[1fr_1fr_auto]" : "grid-cols-[1fr_auto]"}`}>
          <AddToLoopButton placeId={place.id} />
          {place.video ? <WatchVideoButton onClick={() => setPlaying(true)} /> : null}
          <a
            href={directionsUrl(place)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Directions to ${place.name}`}
            className="grid w-12 place-items-center rounded-[16px] border border-line text-ink hover:border-red hover:text-red"
          >
            <DirectionsIcon />
          </a>
        </div>
      </div>

      {playing && place.video ? (
        <div onClick={(event) => event.stopPropagation()}>
          <VideoSheet place={place} video={place.video} onClose={() => setPlaying(false)} />
        </div>
      ) : null}
    </div>
  );
}

export function WatchVideoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-[16px] border border-line bg-paper py-3 text-[14px] font-semibold text-ink hover:border-red hover:text-red"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
      </svg>
      Watch video
    </button>
  );
}
