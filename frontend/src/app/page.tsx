"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilterChip } from "@/components/FilterChip";
import { Loopie } from "@/components/Loopie";
import { PlaceCard } from "@/components/PlaceCard";
import { PlaceDetails } from "@/components/PlaceDetails";
import { PlanningOverlay } from "@/components/PlanningOverlay";
import { SectionHeader } from "@/components/SectionHeader";
import { usePlan } from "@/lib/plan-store";
import { placesMessage, usePlaces } from "@/lib/places-store";
import type { BudgetOption, Place, TimeOption, VibeOption } from "@/lib/types";

const timeOptions: { value: TimeOption; label: string }[] = [
  { value: 1, label: "1 hr" },
  { value: 2, label: "2 hrs" },
  { value: 3, label: "3 hrs" },
  { value: 4, label: "More" },
];

const budgetOptions: { value: BudgetOption; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "under20", label: "<$20" },
  { value: "under40", label: "<$40" },
  { value: "any", label: "Any" },
];

const vibeOptions: { value: VibeOption; label: string }[] = [
  { value: "coffee", label: "Coffee" },
  { value: "food", label: "Food" },
  { value: "books", label: "Books" },
  { value: "art", label: "Art" },
  { value: "outdoors", label: "Outdoors" },
  { value: "surprise", label: "Surprise me" },
];

export default function HomePage() {
  const router = useRouter();
  const plan = usePlan();
  const { places, isLoading, error } = usePlaces();
  const nearbySaved = places.filter((place) => place.saved).slice(0, 3);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  async function onBuild() {
    await plan.buildLoop();
    router.push("/loops");
  }

  return (
    <div className="space-y-8">
      {plan.isPlanning ? <PlanningOverlay /> : null}
      {selectedPlace ? (
        <PlaceDetails place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      ) : null}

      <header className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold tracking-[0.08em] text-red uppercase">
            LocalLoop
          </p>
          <h1 className="mt-4 text-[32px] font-extrabold leading-tight tracking-tight text-ink">
            Where to today?
          </h1>
          <p className="mt-2 max-w-[16rem] text-[15px] leading-6 text-muted">
            Turn your saves into a plan that fits your day.
          </p>
        </div>
        <Loopie state="idle" size={72} />
      </header>

      <section className="rounded-[16px] border border-line bg-paper px-4 py-3">
        <p className="text-[13px] font-semibold text-ink">Using nearby locations</p>
      </section>

      <section className="space-y-3">
        <SectionHeader title="How much time do you have?" />
        <div className="flex flex-wrap gap-2">
          {timeOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={plan.timeHours === option.value}
              onClick={() => plan.setTime(option.value)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="What’s your budget?" />
        <div className="flex flex-wrap gap-2">
          {budgetOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={plan.budget === option.value}
              onClick={() => plan.setBudget(option.value)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="What sounds good?" />
        <div className="flex flex-wrap gap-2">
          {vibeOptions.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={plan.vibes.includes(option.value)}
              onClick={() => plan.toggleVibe(option.value)}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={onBuild}
        className="w-full rounded-[16px] bg-red py-4 text-[16px] font-semibold text-white"
      >
        Build my loop
      </button>

      <section className="space-y-3">
        <SectionHeader title="Saved near you" />
        {placesMessage({ isLoading, error }) ? (
          <p role={error ? "alert" : "status"} className="text-[14px] text-muted">
            {placesMessage({ isLoading, error })}
          </p>
        ) : null}
        <div className="space-y-3">
          {nearbySaved.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              variant="nearby"
              onClick={() => setSelectedPlace(place)}
            />
          ))}
          {!isLoading && !error && nearbySaved.length === 0 ? (
            <p className="text-[14px] text-muted">No saved locations yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
