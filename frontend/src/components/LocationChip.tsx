"use client";

import { useLocation } from "@/lib/location-store";

// Small chip on the map showing where distances are measured from.
// Tapping it asks for location again (e.g. after allowing it in settings).
export function LocationChip({ farFromSaves }: { farFromSaves?: number }) {
  const location = useLocation();
  const live = location.origin !== null;

  const label = live
    ? location.area
      ? `Near you · ${location.area}`
      : "Near you"
    : location.status === "locating"
      ? "Finding you…"
      : location.status === "denied"
        ? "Location blocked · tap to retry"
        : "Location unavailable · tap to retry";

  const hint =
    location.status === "denied"
      ? "Allow location for this site in your browser settings, then tap to retry."
      : live && farFromSaves
        ? `You’re ${farFromSaves.toFixed(1)} mi from your nearest save.`
        : undefined;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={location.retry}
        disabled={live || location.status === "locating"}
        title={hint}
        className={`flex items-center gap-1.5 rounded-full border bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[0_1px_2px_rgba(35,26,17,0.08)] ${
          live ? "border-[#2f80ed]/40" : "border-line"
        }`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
          className={live ? "text-[#2f80ed]" : "text-muted"}
        >
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
        <span aria-live="polite">{label}</span>
      </button>
      {hint ? <p className="max-w-[260px] rounded-[10px] bg-paper/95 px-2.5 py-1.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
