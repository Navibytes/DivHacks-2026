import { AddToLoopButton } from "@/components/AddToLoopButton";
import { categoryLabel, statusLabel } from "@/data/places";
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
  return (
    <div
      role="dialog"
      aria-label={place.name}
      className="sheet-in absolute inset-x-0 bottom-0 z-[1001] rounded-t-[20px] border-t border-line bg-paper p-4 shadow-[0_-4px_16px_rgba(35,26,17,0.06)]"
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={place.image} alt={place.name} className="h-20 w-20 shrink-0 rounded-[12px] object-cover" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-red">{statusLabel(place)}</p>
          <h2 className="mt-0.5 truncate text-[18px] font-bold text-ink">{place.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {place.neighborhood} · {place.distance} · {categoryLabel(place.category)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <AddToLoopButton placeId={place.id} />
        <button
          type="button"
          onClick={onViewDetails}
          className="rounded-[16px] border border-line py-3 text-[14px] font-semibold text-ink"
        >
          View details
        </button>
      </div>
    </div>
  );
}
