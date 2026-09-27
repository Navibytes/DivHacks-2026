"use client";

import { useEffect, useMemo, useState } from "react";
import { Loopie } from "@/components/Loopie";
import { placeMeta, statusLabel } from "@/data/places";
import { searchAreas, type Area } from "@/lib/geo";
import { useLocation } from "@/lib/location-store";
import { searchPlaces } from "@/lib/search";
import type { Place } from "@/lib/types";

type Option =
  | { kind: "place"; id: string; place: Place }
  | { kind: "area"; id: string; area: Area }
  | { kind: "ask"; id: string; text: string };

// Map search: as you type, suggests matching places and neighborhoods, and
// always offers to ask Loopie (Gemini) about what you typed.
export function MapSearch({
  places,
  onPickPlace,
  onPickArea,
  onAskLoopie,
  trailing,
}: {
  places: Place[];
  onPickPlace: (place: Place) => void;
  onPickArea: (area: Area) => void;
  onAskLoopie: (question: string) => void;
  /** Rendered to the right of the input (the map/list toggle). */
  trailing?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const text = query.trim();
  const here = useLocation().origin;
  const matches = useMemo(() => searchPlaces(text, places), [text, places]);

  // Real neighborhoods/towns from OpenStreetMap, looked up after a short pause in typing.
  const [areaResults, setAreaResults] = useState<{ query: string; areas: Area[] }>({ query: "", areas: [] });
  useEffect(() => {
    if (text.length < 3) return;
    let active = true;
    const timer = setTimeout(() => {
      void searchAreas(text, here).then((areas) => {
        if (active) setAreaResults({ query: text, areas });
      });
    }, 450);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text, here]);
  const areas = areaResults.query === text ? areaResults.areas : [];
  const results = { places: matches, areas };
  const options: Option[] = text
    ? [
        ...results.places.map((place) => ({ kind: "place" as const, id: `place-${place.id}`, place })),
        ...results.areas.map((area) => ({
          kind: "area" as const,
          id: `area-${area.name}-${area.lat.toFixed(3)}`,
          area,
        })),
        { kind: "ask" as const, id: "ask-loopie", text },
      ]
    : [];
  const showList = open && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);

  function pick(option: Option) {
    setOpen(false);
    setQuery("");
    setActive(0);
    if (option.kind === "place") onPickPlace(option.place);
    else if (option.kind === "area") onPickArea(option.area);
    else onAskLoopie(option.text);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      setOpen(true);
      setActive((activeIndex + 1) % options.length);
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      setActive((activeIndex - 1 + options.length) % options.length);
    } else if (event.key === "Enter" && options.length) {
      event.preventDefault();
      pick(options[activeIndex]);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      if (open) setOpen(false);
      else setQuery("");
    }
  }

  const noMatches = text && !results.places.length && !results.areas.length;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-[16px] border border-line bg-paper px-4 shadow-[0_1px_2px_rgba(35,26,17,0.06)] focus-within:border-red">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-muted">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="sr-only">Search places, neighborhoods, or ask Loopie</span>
          <input
            id="map-search-input"
            role="combobox"
            aria-expanded={showList}
            aria-controls="map-search-results"
            aria-autocomplete="list"
            aria-activedescendant={showList ? options[activeIndex]?.id : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Search spots, areas, or ask Loopie"
            autoComplete="off"
            className="w-full bg-transparent py-3 text-[15px] text-ink placeholder:text-muted focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery("")}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cream text-muted"
            >
              <svg width="9" height="9" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </label>
        {trailing}
      </div>

      {showList ? (
        <ul
          id="map-search-results"
          role="listbox"
          aria-label="Search results"
          className="sheet-in absolute inset-x-0 top-[calc(100%+8px)] max-h-[min(420px,60dvh)] overflow-y-auto rounded-[16px] border border-line bg-paper p-1.5 shadow-[0_8px_24px_rgba(35,26,17,0.14)]"
        >
          {noMatches ? (
            <li className="px-3 pb-1 pt-2 text-[13px] text-muted" aria-hidden="true">
              No spots match “{text}”.
            </li>
          ) : null}
          {options.map((option, index) => (
            <li
              key={option.id}
              id={option.id}
              role="option"
              aria-selected={index === activeIndex}
              // Keep focus in the input so the list doesn't close before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2 ${
                index === activeIndex ? "bg-cream" : ""
              } ${option.kind === "ask" && index > 0 ? "mt-1 border-t border-line pt-2.5" : ""}`}
            >
              {option.kind === "place" ? <PlaceRow place={option.place} /> : null}
              {option.kind === "area" ? <AreaRow area={option.area} /> : null}
              {option.kind === "ask" ? <AskRow text={option.text} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PlaceRow({ place }: { place: Place }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={place.image} alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{place.name}</span>
        <span className="block truncate text-[12px] text-muted">
          {placeMeta(place)}
        </span>
      </span>
      <span className="shrink-0 text-[11px] font-semibold text-red">
        {place.kind === "event" ? "Today" : place.saved ? "Saved" : statusLabel(place)}
      </span>
    </>
  );
}

function AreaRow({ area }: { area: Area }) {
  return (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-soft text-red" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
          <circle cx="12" cy="9.8" r="2.3" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">{area.name}</span>
        <span className="block truncate text-[12px] text-muted">
          {area.detail ? `${area.detail} · show on map` : "Show on map"}
        </span>
      </span>
    </>
  );
}

function AskRow({ text }: { text: string }) {
  return (
    <>
      <span className="loopie-still grid h-10 w-10 shrink-0 place-items-center" aria-hidden="true">
        <Loopie state="happy" size={36} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink">
          Ask Loopie about “{text}”
        </span>
        <span className="block text-[12px] text-muted">Get ideas from your saves</span>
      </span>
    </>
  );
}
