"use client";

import { useEffect, useState } from "react";
import { Loopie } from "@/components/Loopie";
import { sourceLabel } from "@/data/places";
import { applyVideoDetails, detailsFromVideo } from "@/lib/enrich";
import { useLocation } from "@/lib/location-store";
import { detectSource, extractSpot } from "@/lib/new-spot";
import { usePlan } from "@/lib/plan-store";
import type { Place } from "@/lib/types";

// Paste a link, and the spot's name, type, and description are pulled from the post.
export function AddSpotSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (place: Place) => void;
}) {
  const { addSpot } = usePlan();
  const here = useLocation().origin;
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const source = sourceLabel(detectSource(link));
  const reading = status === "reading";

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!link.trim() || reading) return;
    setStatus("reading");
    try {
      const basic = await extractSpot(link.trim(), here);
      // Let Loopie read the caption for a summary, must-try and tags.
      const details = await detailsFromVideo(basic.name, link.trim());
      const place = {
        ...applyVideoDetails(basic, details, false),
        description: details.description ?? basic.description,
      };
      addSpot(place);
      onSaved(place);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Couldn’t read that link.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center bg-ink/35"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-spot-title"
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        className="sheet-in w-full max-w-[430px] rounded-t-[20px] bg-paper p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="add-spot-title" className="text-[22px] font-bold tracking-tight text-ink">
              Add a spot
            </h2>
            <p className="mt-1 text-[14px] leading-5 text-muted">
              Paste the video you saw it in. Loopie figures out the rest.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <label className="mt-5 block text-[13px] font-semibold text-ink">
          Link
          <input
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="Paste a TikTok, Instagram, or Maps link"
            autoFocus
            disabled={reading}
            className="mt-2 w-full rounded-[12px] border border-line bg-paper px-3 py-3 text-[15px] text-ink placeholder:text-muted disabled:opacity-60"
          />
        </label>
        <p
          className={`mt-1.5 min-h-[18px] text-[12px] ${status === "error" ? "text-red-dark" : "text-red"}`}
          aria-live="polite"
        >
          {status === "error" ? error : (source ?? "")}
        </p>

        {reading ? (
          <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-soft px-4 py-3" role="status">
            <Loopie state="thinking" size={40} />
            <p className="text-[14px] font-semibold text-ink">Watching the video for details…</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!link.trim() || reading}
          className="mt-4 w-full rounded-[16px] bg-red py-4 text-[16px] font-semibold text-white hover:bg-red-dark disabled:opacity-40"
        >
          {reading ? "Adding…" : "Add spot"}
        </button>
      </form>
    </div>
  );
}
