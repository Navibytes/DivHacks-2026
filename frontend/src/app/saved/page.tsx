"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SavedList } from "@/components/SavedList";
import { SavedMap } from "@/components/SavedMap";

// Saved Spots tab: map by default, `?view=list` for the list,
// `?route=1` to draw the current loop on the map.
export default function SavedSpotsPage() {
  return (
    <Suspense fallback={<div className="-mx-5 -mt-6 h-[70dvh] bg-soft" />}>
      <SavedSpots />
    </Suspense>
  );
}

function SavedSpots() {
  const router = useRouter();
  const params = useSearchParams();

  if (params.get("view") === "list") {
    return <SavedList onShowMap={() => router.replace("/saved")} />;
  }

  return (
    <SavedMap
      showRoute={params.get("route") === "1"}
      onHideRoute={() => router.replace("/saved")}
      onShowList={() => router.replace("/saved?view=list")}
    />
  );
}
