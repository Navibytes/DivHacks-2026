"use client";

import { useEffect } from "react";
import { embedUrl, platformName, videoCredit } from "@/lib/video";
import type { Place, SourceVideo } from "@/lib/types";

// Full-screen player for the TikTok/Instagram post a spot was saved from.
export function VideoSheet({
  place,
  video,
  onClose,
}: {
  place: Place;
  video: SourceVideo;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src = embedUrl(video);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Video about ${place.name}`}
      className="fixed inset-0 z-[1200] flex flex-col items-center justify-center bg-ink/90 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-[400px]" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between text-white">
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{place.name}</p>
            <p className="text-[13px] text-white/70">
              {videoCredit(video)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            autoFocus
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {src ? (
          <iframe
            src={src}
            title={`${platformName(video)} video about ${place.name}`}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            className="aspect-[9/16] max-h-[72dvh] w-full rounded-[16px] bg-black"
          />
        ) : (
          <div className="grid aspect-[9/16] max-h-[72dvh] w-full place-items-center rounded-[16px] bg-black px-6 text-center text-[14px] text-white/80">
            This link can’t be played here. Open it in {platformName(video)} instead.
          </div>
        )}

        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-[14px] font-semibold text-white underline underline-offset-4"
        >
          Open in {platformName(video)} ↗
        </a>
      </div>
    </div>
  );
}
