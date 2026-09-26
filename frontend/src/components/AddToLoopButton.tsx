"use client";

import { usePlan } from "@/lib/plan-store";

export function AddToLoopButton({
  placeId,
  className = "",
}: {
  placeId: string;
  className?: string;
}) {
  const { addToLoop, isInLoop } = usePlan();
  const added = isInLoop(placeId);

  return (
    <button
      type="button"
      onClick={() => addToLoop(placeId)}
      disabled={added}
      className={`rounded-[16px] py-3 text-[14px] font-semibold transition-colors ${
        added
          ? "border border-line bg-soft text-red"
          : "bg-red text-white hover:bg-red-dark"
      } ${className}`}
    >
      <span aria-live="polite">{added ? "✓ In your loop" : "Add to loop"}</span>
    </button>
  );
}
