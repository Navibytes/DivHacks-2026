import type { Place } from "@/lib/types";

// Extra details about a place. Every line is optional: if the data isn't
// there, the line simply doesn't render, so sparse spots stay tidy.

export function PlaceFacts({ place }: { place: Place }) {
  const chips = [
    place.rating ? `★ ${place.rating.score.toFixed(1)} (${formatCount(place.rating.count)})` : null,
    place.priceLevel
      ? "$".repeat(place.priceLevel)
      : place.estimatedCost > 0
        ? `~$${place.estimatedCost} / person`
        : "Free",
    ...(place.tags ?? []).filter((tag) => tag !== "Free").slice(0, 3),
  ].filter((chip): chip is string => Boolean(chip));

  const rows = [
    place.hours ? { icon: <ClockIcon />, label: "When", text: place.hours } : null,
    place.address ? { icon: <PinIcon />, label: "Address", text: place.address } : null,
    place.mustTry ? { icon: <StarIcon />, label: "Must try", text: place.mustTry } : null,
    place.savedAt ? { icon: <BookmarkIcon />, label: "Saved", text: savedAgo(place.savedAt) } : null,
  ].filter((row) => row !== null);

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-1.5" aria-label="Quick facts">
        {chips.map((chip) => (
          <li
            key={chip}
            className="rounded-full border border-line bg-cream px-2.5 py-1 text-[12px] font-semibold text-ink"
          >
            {chip}
          </li>
        ))}
      </ul>

      {rows.length ? (
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-2.5 text-[13px]">
              <span className="mt-px text-red" aria-hidden="true">
                {row.icon}
              </span>
              <dt className={row.label === "Must try" ? "shrink-0 font-semibold text-ink" : "sr-only"}>
                {row.label}
              </dt>
              <dd className="text-ink">{row.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Google Maps directions to the place (by address when we have one). */
export function directionsUrl(place: Place) {
  const destination = place.address
    ? `${place.name}, ${place.address}, New York, NY`
    : `${place.lat},${place.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function formatCount(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(count);
}

function savedAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 0) return "Saved recently";
  if (days === 0) return "Saved today";
  if (days === 1) return "Saved yesterday";
  if (days < 7) return `Saved ${days} days ago`;
  if (days < 14) return "Saved last week";
  if (days < 60) return `Saved ${Math.floor(days / 7)} weeks ago`;
  return `Saved ${Math.floor(days / 30)} months ago`;
}

const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg {...iconProps}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 3.5h12v17l-6-3.6-6 3.6v-17Z" />
    </svg>
  );
}

export function DirectionsIcon() {
  return (
    <svg {...iconProps} width={18} height={18}>
      <path d="M3 11.5 21 3l-8.5 18-2.2-7.3L3 11.5Z" />
    </svg>
  );
}
