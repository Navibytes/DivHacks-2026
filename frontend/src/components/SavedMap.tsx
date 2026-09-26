"use client";

import { useMemo, useState } from "react";
import { AddSpotSheet } from "@/components/AddSpotSheet";
import { CompanionButton } from "@/components/CompanionButton";
import { CompanionChat } from "@/components/CompanionChat";
import { MapBottomSheet } from "@/components/MapBottomSheet";
import { MapCanvas } from "@/components/MapCanvas";
import { MapSearch } from "@/components/MapSearch";
import { PlaceDetails } from "@/components/PlaceDetails";
import { ViewToggle } from "@/components/ViewToggle";
import { placesMessage, usePlaces } from "@/lib/places-store";
import { usePlan } from "@/lib/plan-store";
import type { Place } from "@/lib/types";

export function SavedMap({
  showRoute,
  onShowRoute,
  onHideRoute,
  onShowList,
}: {
  showRoute: boolean;
  onShowRoute: () => void;
  onHideRoute: () => void;
  onShowList: () => void;
}) {
  const { loop, getPlace, savedPlaces, places } = usePlan();
  const placesStatus = placesMessage(usePlaces());
  const [selected, setSelected] = useState<Place | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Keep the chat mounted after first open so the conversation survives closing it.
  const [chatStarted, setChatStarted] = useState(false);
  const [chatQuestion, setChatQuestion] = useState<{ id: number; text: string }>();
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number; key: number }>();

  // All saved spots, plus a picked event/find so its pin shows while selected.
  const visible = useMemo(
    () => (selected && !savedPlaces.includes(selected) ? [...savedPlaces, selected] : savedPlaces),
    [savedPlaces, selected],
  );

  const route = useMemo(
    () =>
      showRoute
        ? loop.stops
            .map((stop) => getPlace(stop.placeId))
            .filter((place): place is Place => Boolean(place))
        : [],
    [showRoute, loop, getPlace],
  );

  return (
    <div className="relative -mx-5 -my-6 min-h-[480px] flex-1">
      <MapCanvas
        places={visible}
        route={route}
        selectedId={selected?.id}
        focus={focus}
        onSelect={setSelected}
      />

      <div className="absolute inset-x-4 top-4 z-[1000] space-y-3">
        {placesStatus ? (
          <p role="status" className="rounded-[12px] bg-paper px-3 py-2 text-[13px] text-muted shadow-[0_1px_2px_rgba(35,26,17,0.06)]">
            {placesStatus}
          </p>
        ) : null}
        <MapSearch
          places={places}
          trailing={<ViewToggle view="map" onToggle={onShowList} />}
          onPickPlace={(place) => {
            setChatOpen(false);
            setSelected(place);
          }}
          onPickArea={(area) => {
            setSelected(null);
            setFocus({ lat: area.lat, lng: area.lng, zoom: 15, key: Date.now() });
          }}
          onAskLoopie={(text) => {
            setSelected(null);
            setChatStarted(true);
            setChatOpen(true);
            setChatQuestion({ id: Date.now(), text });
          }}
        />
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

      {!selected ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="absolute bottom-5 left-4 z-[1000] flex items-center gap-2 rounded-full bg-red px-5 py-3 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(35,26,17,0.18)] hover:bg-red-dark"
        >
          <span aria-hidden="true" className="text-[18px] leading-none">+</span>
          Add a spot
        </button>
      ) : null}

      {!selected ? (
        <CompanionButton
          open={chatOpen}
          onToggle={() => {
            setChatStarted(true);
            setChatOpen((current) => !current);
          }}
        />
      ) : null}

      {chatStarted ? (
        <CompanionChat
          hidden={!chatOpen || Boolean(selected)}
          question={chatQuestion}
          onClose={() => setChatOpen(false)}
          onSelectPlace={(place) => {
            setChatOpen(false);
            setSelected(place);
          }}
          onShowRoute={() => {
            setChatOpen(false);
            onShowRoute();
          }}
        />
      ) : null}

      {adding ? (
        <AddSpotSheet
          onClose={() => setAdding(false)}
          onSaved={(place) => {
            setAdding(false);
            setSelected(place);
          }}
        />
      ) : null}

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
