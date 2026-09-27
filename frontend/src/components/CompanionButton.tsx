"use client";

import { useEffect, useState } from "react";
import { Loopie } from "@/components/Loopie";

const NUDGE_EVERY_MS = 15_000;
const NUDGE_SHOWS_MS = 4_000;

// Floating Loopie in the map's bottom-right corner. Every 15s (while the chat
// is closed) it bounces and asks if you need help.
export function CompanionButton({
  open,
  onToggle,
  className = "absolute bottom-5 right-4",
  style,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [nudging, setNudging] = useState(false);

  useEffect(() => {
    if (open) return;
    let hide: ReturnType<typeof setTimeout>;
    const nudge = () => {
      setNudging(true);
      hide = setTimeout(() => setNudging(false), NUDGE_SHOWS_MS);
    };
    const first = setTimeout(nudge, 3_000); // say hi soon after the map loads
    const every = setInterval(nudge, NUDGE_EVERY_MS);
    return () => {
      clearTimeout(first);
      clearTimeout(hide);
      clearInterval(every);
      setNudging(false);
    };
  }, [open]);

  return (
    <div className={`${className} z-[1001] flex items-end gap-2`} style={style}>
      {nudging && !open ? (
        <button
          type="button"
          onClick={onToggle}
          className="bubble-in mb-3 whitespace-nowrap rounded-[16px] rounded-br-[4px] border border-line bg-paper px-3 py-2 text-[14px] font-semibold text-ink shadow-[0_4px_14px_rgba(35,26,17,0.12)]"
        >
          Hey, need help?
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Close chat with Loopie" : "Chat with Loopie"}
        aria-expanded={open}
        className={`grid h-16 w-16 place-items-center rounded-full border border-line bg-paper shadow-[0_4px_14px_rgba(35,26,17,0.16)] hover:border-red ${
          nudging && !open ? "companion-bounce" : ""
        } ${open ? "border-red" : ""}`}
      >
        {/* Static Loopie inside the button; the whole button does the bouncing. */}
        <span className="loopie-still">
          <Loopie state={nudging || open ? "happy" : "idle"} size={52} />
        </span>
      </button>
    </div>
  );
}
