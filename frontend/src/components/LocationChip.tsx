"use client";

import { useState } from "react";
import { useLocation } from "@/lib/location-store";

// Chip on the map showing where the app is planning from: your real location
// ("Near you · Williamsburg") or an area you chose ("Exploring · Park Slope").
// The menu switches between them; areas are picked from the search bar.
export function LocationChip({
  farFromSaves,
  onBackToMe,
}: {
  farFromSaves?: number;
  /** Called when switching back to your location (e.g. to re-center the map). */
  onBackToMe?: () => void;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const exploring = location.source === "chosen";
  const live = location.here !== null;

  const label = exploring
    ? `Exploring · ${location.area}`
    : live
      ? location.area
        ? `Near you · ${location.area}`
        : "Near you"
      : location.status === "locating"
        ? "Finding you…"
        : location.status === "denied"
          ? "Location blocked"
          : "Location unavailable";

  const myLocationDetail =
    location.status === "denied"
      ? "Blocked. Allow location for this site in your browser settings, then tap here."
      : location.status === "unavailable"
        ? "Couldn’t get your location. Tap to try again."
        : !exploring && farFromSaves
          ? `You’re ${farFromSaves.toFixed(1)} mi from your nearest save.`
          : "Plan from where you are right now.";

  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 rounded-full border bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink shadow-[0_1px_2px_rgba(35,26,17,0.08)] ${
          exploring ? "border-red/40" : live ? "border-[#2f80ed]/40" : "border-line"
        }`}
      >
        {exploring ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="text-red">
            <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.8" r="2.3" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className={live ? "text-[#2f80ed]" : "text-muted"}>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
          </svg>
        )}
        <span aria-live="polite">{label}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="text-muted">
          <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {exploring ? (
        <button
          type="button"
          onClick={() => {
            location.backToMyLocation();
            onBackToMe?.();
          }}
          aria-label="Stop exploring and go back to my location"
          className="grid h-7 w-7 place-items-center rounded-full border border-line bg-paper text-muted shadow-[0_1px_2px_rgba(35,26,17,0.08)] hover:text-red"
        >
          <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}

      {open ? (
        <div role="menu" className="sheet-in absolute left-0 top-[calc(100%+6px)] z-10 w-64 rounded-[14px] border border-line bg-paper p-1.5 shadow-[0_8px_24px_rgba(35,26,17,0.14)]">
          <MenuItem
            checked={!exploring}
            title="My location"
            detail={myLocationDetail}
            onClick={() => {
              location.backToMyLocation();
              if (!live) location.retry();
              else onBackToMe?.();
              setOpen(false);
            }}
          />
          <MenuItem
            checked={exploring}
            title={exploring ? `Exploring ${location.area}` : "Choose an area…"}
            detail={exploring ? "Pick another area in the search bar." : "Going somewhere later? Search for a neighborhood."}
            onClick={() => {
              setOpen(false);
              document.getElementById("map-search-input")?.focus();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  checked,
  title,
  detail,
  onClick,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-start gap-2 rounded-[10px] px-2.5 py-2 text-left hover:bg-cream"
    >
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${checked ? "border-red bg-red" : "border-line"}`}>
        {checked ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      <span>
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="block text-[12px] leading-4 text-muted">{detail}</span>
      </span>
    </button>
  );
}
