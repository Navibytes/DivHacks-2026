"use client";

import { useState } from "react";
import { AddToLoopButton } from "@/components/AddToLoopButton";
import { DirectionsIcon, PlaceFacts, directionsUrl } from "@/components/PlaceFacts";
import { WatchVideoButton } from "@/components/PlaceDetails";
import { VideoPreview } from "@/components/VideoPreview";
import { VideoSheet } from "@/components/VideoSheet";
import { placeMeta, statusLabel } from "@/data/places";
import { videoCredit } from "@/lib/video";
import type { Place } from "@/lib/types";

export function MapBottomSheet({
  place,
  onClose,
  onViewDetails,
}: {
  place: Place;
  onClose: () => void;
  onViewDetails: () => void;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div
      role="dialog"
      aria-label={place.name}
      className="sheet-in absolute inset-x-0 bottom-0 z-[1001] max-h-[72%] overflow-y-auto rounded-t-[20px] border-t border-line bg-paper p-4 shadow-[0_-4px_16px_rgba(35,26,17,0.06)]"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close place details"
        className="mx-auto -mt-1 mb-3 block h-5 w-12 rounded-full"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-line" />
      </button>

      <div className="flex gap-3">
        <VideoPreview
          place={place}
          onPlay={() => setPlaying(true)}
          className="h-24 w-20 shrink-0 rounded-[12px]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-red">
            {place.video
              ? `From ${videoCredit(place.video)}`
              : statusLabel(place)}
          </p>
          <button
            type="button"
            onClick={onViewDetails}
            className="mt-0.5 block max-w-full truncate text-left text-[18px] font-bold text-ink hover:underline"
          >
            {place.name}
          </button>
          <p className="mt-0.5 text-[13px] text-muted">
            {placeMeta(place)}
          </p>
          {place.description ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-ink">{place.description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <PlaceFacts place={place} />
      </div>

      <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
        <AddToLoopButton placeId={place.id} />
        {place.video ? (
          <WatchVideoButton onClick={() => setPlaying(true)} />
        ) : (
          <button
            type="button"
            onClick={onViewDetails}
            className="rounded-[16px] border border-line py-3 text-[14px] font-semibold text-ink"
          >
            View details
          </button>
        )}
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

      {playing && place.video ? (
        <VideoSheet place={place} video={place.video} onClose={() => setPlaying(false)} />
      ) : null}
    </div>
  );
}
