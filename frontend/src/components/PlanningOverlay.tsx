"use client";

import { Loopie } from "@/components/Loopie";

export function PlanningOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#231a11]/35 p-6"
    >
      <div className="w-full max-w-[360px] rounded-[20px] bg-paper px-6 py-10 text-center">
        <div className="flex justify-center">
          <Loopie state="thinking" size={96} />
        </div>
        <p className="mt-6 text-[22px] font-semibold text-ink">Building your loop…</p>
        <p className="mt-2 text-[14px] leading-6 text-muted">
          Finding places that fit your time, budget, and location.
        </p>
      </div>
    </div>
  );
}
