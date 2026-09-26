"use client";

import { platformName } from "@/lib/video";
import type { Place } from "@/lib/types";

// Place photo that doubles as a play button for the source video.
// Falls back to a plain photo when the spot has no video.
export function VideoPreview({
  place,
  onPlay,
  className = "",
}: {
  place: Place;
  onPlay: () => void;
  className?: string;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={place.image} alt={place.name} className="h-full w-full object-cover" />
  );

  if (!place.video) {
    return <div className={`overflow-hidden ${className}`}>{image}</div>;
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play the ${platformName(place.video)} video about ${place.name}`}
      className={`group relative overflow-hidden ${className}`}
    >
      {image}
      <span className="absolute inset-0 bg-ink/20 transition-colors group-hover:bg-ink/35" />
      <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-red shadow-[0_2px_8px_rgba(35,26,17,0.25)]">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}
