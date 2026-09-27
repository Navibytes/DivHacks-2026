"use client";

import { useState } from "react";
import { useLocation } from "@/lib/location-store";

// Small chip on the map: shows where distances are measured from, and lets
// you switch between your real location and "Pretend I'm in SoHo" (for demos).
export function LocationChip({
  farFromSaves,
  onPretendSoHo,
}: {
  /** Miles to the closest saved spot, when that's far (shown as a hint). */
  farFromSaves?: number;
  onPretendSoHo: () => void;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const label =
    location.mode === "demo"
      ? "Pretending: SoHo"
      : location.isLive
        ? `Near you · ${location.area}`
        : location.status === "locating"
          ? "Finding you…"
          : location.status === "denied"
            ? "Location off · using SoHo"
            : "Use my location";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 rounded-full border bg-paper px-3 py-1.5 text-[12px] font-semibold shadow-[0_1px_2px_rgba(35,26,17,0.08)] ${
          location.isLive ? "border-[#2f80ed]/40 text-ink" : "border-line text-ink"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className={location.isLive ? "text-[#2f80ed]" : "text-red"}>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
        {label}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="text-muted">
          <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div role="menu" className="sheet-in absolute left-0 top-[calc(100%+6px)] z-10 w-64 rounded-[14px] border border-line bg-paper p-1.5 shadow-[0_8px_24px_rgba(35,26,17,0.14)]">
          <MenuItem
            checked={location.mode === "gps"}
            title="Use my location"
            detail={
              location.status === "denied"
                ? "Location is blocked. Allow it in your browser’s site settings."
                : location.isLive && farFromSaves
                  ? `You’re ${farFromSaves.toFixed(1)} mi from your nearest save.`
                  : "Distances from where you are right now."
            }
            onClick={() => {
              location.enableGps();
              setOpen(false);
            }}
          />
          <MenuItem
            checked={location.mode === "demo"}
            title="Pretend I’m in SoHo"
            detail="Handy for demos away from your saves."
            onClick={() => {
              location.pretendSoHo();
              onPretendSoHo();
              setOpen(false);
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
