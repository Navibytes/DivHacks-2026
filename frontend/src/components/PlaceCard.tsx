import type { Place } from "@/lib/types";
import { categoryLabel, priceLabel, sourceLabel, statusLabel } from "@/data/places";

export function PlaceCard({
  place,
  variant = "saved",
  onClick,
}: {
  place: Place;
  variant?: "nearby" | "saved" | "find";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full gap-3 rounded-[16px] border border-line bg-paper p-3 text-left shadow-[0_1px_2px_rgba(35,26,17,0.04)]"
    >
      <span className="relative shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={place.image}
          alt=""
          className={`rounded-[12px] object-cover ${variant === "nearby" ? "h-16 w-16" : "h-20 w-20"}`}
        />
        {place.video ? (
          <span className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded-full bg-white/95 text-red">
            <svg width="8" height="8" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.2-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
            </svg>
            <span className="sr-only">Has video</span>
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-ink">{place.name}</p>
        <p className="mt-1 text-[13px] text-muted">
          {place.neighborhood} · {place.distance}
        </p>
        {variant === "nearby" ? (
          <p className="mt-2 text-[12px] font-semibold text-red">Saved</p>
        ) : variant === "find" ? (
          <>
            <p className="mt-2 text-[12px] text-muted">
              {categoryLabel(place.category)} · {priceLabel(place)}
            </p>
            <p className="mt-1 text-[12px] font-semibold text-red">{statusLabel(place)}</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-[12px] text-muted">{categoryLabel(place.category)}</p>
            {sourceLabel(place.source) ? (
              <p className="mt-1 text-[12px] text-muted">{sourceLabel(place.source)}</p>
            ) : null}
          </>
        )}
      </div>
    </button>
  );
}
