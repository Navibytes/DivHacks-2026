"use client";

import { useMemo, useState } from "react";
import { MapBottomSheet } from "@/components/MapBottomSheet";
import { MapCanvas } from "@/components/MapCanvas";
import { PlaceDetails } from "@/components/PlaceDetails";
import { ViewToggle } from "@/components/ViewToggle";
import { getPlace, savedPlaces } from "@/data/places";
import { usePlan } from "@/lib/plan-store";
import type { Place } from "@/lib/types";

export function SavedMap({
  showRoute,
  onHideRoute,
  onShowList,
}: {
  showRoute: boolean;
  onHideRoute: () => void;
  onShowList: () => void;
}) {
  const { loop } = usePlan();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return savedPlaces.filter(
      (place) =>
        !q ||
        place.neighborhood.toLowerCase().includes(q) ||
        place.name.toLowerCase().includes(q),
    );
  }, [query]);

  const route = useMemo(
    () =>
      showRoute
        ? loop.stops
            .map((stop) => getPlace(stop.placeId))
            .filter((place): place is Place => Boolean(place))
        : [],
    [showRoute, loop],
  );

  return (
    <div className="relative -mx-5 -my-6 min-h-[480px] flex-1">
      <MapCanvas
        places={visible}
        route={route}
        selectedId={selected?.id}
        onSelect={setSelected}
      />

      <div className="absolute inset-x-4 top-4 z-[1000] space-y-3">
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-[16px] border border-line bg-paper px-4 shadow-[0_1px_2px_rgba(35,26,17,0.06)]">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-muted">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="sr-only">Search saved spots</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved spots"
              className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-muted focus:outline-none"
            />
          </label>
          <ViewToggle view="map" onToggle={onShowList} />
        </div>
        {showRoute ? (
          <div className="flex items-center justify-between rounded-[12px] bg-ink px-3 py-2 text-[13px] text-white">
            <span>
              Your {loop.neighborhood} loop · {loop.stops.length} stops
            </span>
            <button
              type="button"
              onClick={onHideRoute}
              className="font-semibold underline underline-offset-2"
            >
              Hide
            </button>
          </div>
        ) : null}
      </div>

      {selected ? (
        <MapBottomSheet
          key={selected.id}
          place={selected}
          onClose={() => setSelected(null)}
          onViewDetails={() => setDetailsOpen(true)}
        />
      ) : null}
      {selected && detailsOpen ? (
        <PlaceDetails place={selected} onClose={() => setDetailsOpen(false)} />
      ) : null}
    </div>
  );
}
