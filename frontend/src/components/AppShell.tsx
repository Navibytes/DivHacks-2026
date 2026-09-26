"use client";

import { BottomNav } from "@/components/BottomNav";
import { PlanProvider } from "@/lib/plan-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PlanProvider>
      <div className="phone-shell flex min-h-dvh flex-col">
        <main className="flex flex-1 flex-col px-5 pb-6 pt-6">{children}</main>
        <BottomNav />
      </div>
    </PlanProvider>
  );
}
