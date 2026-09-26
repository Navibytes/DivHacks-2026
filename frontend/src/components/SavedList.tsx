"use client";

import { useMemo, useState } from "react";
import { FilterChip } from "@/components/FilterChip";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceDetails } from "@/components/PlaceDetails";
import { ViewToggle } from "@/components/ViewToggle";
import { savedPlaces } from "@/data/places";
import type { Place } from "@/lib/types";

const filters = ["All", "Food", "Coffee", "Arts"] as const;

export function SavedList({ onShowMap }: { onShowMap: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [selected, setSelected] = useState<Place | null>(null);

  const places = useMemo(() => {
    return savedPlaces.filter((place) => {
      const matchesQuery = place.name.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (filter === "Food") return place.category === "food";
      if (filter === "Coffee") return place.category === "coffee";
      if (filter === "Arts") return place.category === "art" || place.category === "books";
      return true;
    });
  }, [query, filter]);

  return (
    <div className="space-y-5">
      {selected ? <PlaceDetails place={selected} onClose={() => setSelected(null)} /> : null}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight">Saved spots</h1>
          <p className="mt-1 text-[14px] text-muted">{savedPlaces.length} places you wanted to try</p>
        </div>
        <ViewToggle view="list" onToggle={onShowMap} />
      </header>
      <label className="block">
        <span className="sr-only">Search saved spots</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search saved spots"
          className="w-full rounded-[16px] border border-line bg-paper px-4 py-3 text-[15px] text-ink placeholder:text-muted"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <FilterChip
            key={item}
            label={item}
            selected={filter === item}
            onClick={() => setFilter(item)}
          />
        ))}
      </div>
      <div className="space-y-3">
        {places.map((place) => (
          <PlaceCard key={place.id} place={place} onClick={() => setSelected(place)} />
        ))}
        {places.length === 0 ? (
          <p className="text-[14px] text-muted">No saved spots match that search.</p>
        ) : null}
      </div>
    </div>
  );
}
