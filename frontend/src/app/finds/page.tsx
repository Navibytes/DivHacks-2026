"use client";

import { useState } from "react";
import { FilterChip } from "@/components/FilterChip";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceDetails } from "@/components/PlaceDetails";
import { newFinds } from "@/data/places";
import type { Place } from "@/lib/types";

const filters = [
  { id: "all", label: "All" },
  { id: "event", label: "Happening today" },
  { id: "find", label: "Hidden gems" },
] as const;

export default function NewFindsPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [selected, setSelected] = useState<Place | null>(null);

  const shown = newFinds.filter((place) => filter === "all" || place.kind === filter);

  return (
    <div className="space-y-5">
      {selected ? <PlaceDetails place={selected} onClose={() => setSelected(null)} /> : null}
      <header>
        <h1 className="text-[28px] font-extrabold tracking-tight">New finds</h1>
        <p className="mt-1 text-[14px] leading-6 text-muted">
          Local events and spots near your saves you haven’t found yet.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <FilterChip
            key={item.id}
            label={item.label}
            selected={filter === item.id}
            onClick={() => setFilter(item.id)}
          />
        ))}
      </div>
      <div className="space-y-3">
        {shown.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            variant="find"
            onClick={() => setSelected(place)}
          />
        ))}
        {shown.length === 0 ? (
          <p className="text-[14px] text-muted">Nothing new here right now.</p>
        ) : null}
      </div>
    </div>
  );
}
