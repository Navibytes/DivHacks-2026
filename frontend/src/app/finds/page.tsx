"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CompanionButton } from "@/components/CompanionButton";
import { CompanionChat } from "@/components/CompanionChat";
import { PlaceDetails } from "@/components/PlaceDetails";
import { platformLabel, unmatchedVideos } from "@/data/unmatched";
import type { UnmatchedVideo } from "@/data/unmatched";
import type { PlaceSearchResponse } from "@/lib/place-search";
import type { Place } from "@/lib/types";

type SearchState = {
  loading: boolean;
  error?: string;
  result?: PlaceSearchResponse;
};

export default function NewFindsPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<Record<string, SearchState>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  async function searchPlace(event: FormEvent<HTMLFormElement>, video: UnmatchedVideo) {
    event.preventDefault();
    const form = event.currentTarget;
    const query = new FormData(form).get("query");
    if (typeof query !== "string" || !query.trim()) return;

    setSearches((current) => ({ ...current, [video.id]: { loading: true } }));
    try {
      const response = await fetch("/api/place-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          platform: platformLabel(video.platform),
          caption: video.caption,
          aiClue: video.aiClue,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI search failed. Please try again.");
      if (data.error) throw new Error(data.error);
      setSearches((current) => ({ ...current, [video.id]: { loading: false, result: data as PlaceSearchResponse } }));
    } catch (error) {
      setSearches((current) => ({
        ...current,
        [video.id]: {
          loading: false,
          error: error instanceof Error ? error.message : "AI search failed. Please try again.",
        },
      }));
    }
  }

  return (
    <div className="space-y-5 pb-2">
      {selectedPlace ? <PlaceDetails place={selectedPlace} onClose={() => setSelectedPlace(null)} /> : null}
      <header className="border-b border-line pb-4">
        <p className="text-[12px] font-bold uppercase text-red">The location queue</p>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-ink">Help find the spot</h1>
        <p className="mt-2 max-w-[340px] text-[14px] leading-6 text-muted">
          Loopie couldn’t match these imported videos to a place. Search the clue on Maps and help pin it down.
        </p>
        <div className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-ink" aria-live="polite">
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-soft px-2 text-red">
            {unmatchedVideos.length}
          </span>
          clips need a location
        </div>
      </header>
      <div className="space-y-3">
        {unmatchedVideos.map((video) => (
          <article key={video.id} className="overflow-hidden rounded-[14px] border border-line bg-paper shadow-[var(--shadow)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <span className="text-[12px] font-bold text-red">{platformLabel(video.platform)}</span>
              <span className="text-[12px] text-muted">Saved {video.savedAgo}</span>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[12px] font-semibold text-muted">{video.creator}</p>
                <h2 className="mt-1 text-[16px] font-bold leading-6 text-ink">{video.caption}</h2>
              </div>
              <div className="border-l-2 border-red pl-3">
                <p className="text-[11px] font-bold uppercase text-muted">What Loopie noticed</p>
                <p className="mt-1 text-[13px] leading-5 text-ink">{video.aiClue}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-[13px] font-semibold">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  Open video <span aria-hidden="true">↗</span>
                </a>
                <form onSubmit={(event) => searchPlace(event, video)} className="flex min-w-0 flex-1 gap-2">
                  <label className="sr-only" htmlFor={`location-${video.id}`}>Place name or area to search with AI</label>
                  <input
                    id={`location-${video.id}`}
                    name="query"
                    type="search"
                    required
                    placeholder="Place name or area"
                    className="min-w-0 flex-1 border-b border-line bg-transparent py-1 text-[13px] font-normal text-ink placeholder:text-muted focus:border-red focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searches[video.id]?.loading}
                    className="shrink-0 rounded-[8px] bg-red px-3 py-2 text-[12px] font-bold text-white hover:bg-red-dark disabled:opacity-60"
                  >
                    {searches[video.id]?.loading ? "Searching…" : "Find with AI"}
                  </button>
                </form>
              </div>
              {searches[video.id]?.error ? (
                <p role="alert" className="text-[12px] leading-5 text-red-dark">{searches[video.id]?.error}</p>
              ) : null}
              {searches[video.id]?.result ? (
                <div className="border-t border-line pt-3" aria-live="polite">
                  {searches[video.id].result?.found ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase text-muted">AI web match · {searches[video.id].result?.confidence} confidence</p>
                          <h3 className="mt-1 text-[15px] font-bold text-ink">{searches[video.id].result?.name}</h3>
                          {searches[video.id].result?.address ? (
                            <p className="mt-0.5 text-[12px] leading-5 text-muted">{searches[video.id].result?.address}</p>
                          ) : null}
                          <p className="mt-2 text-[12px] leading-5 text-ink">{searches[video.id].result?.reason}</p>
                        </div>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([searches[video.id].result?.name, searches[video.id].result?.address].filter(Boolean).join(" "))}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-[8px] border border-line px-3 py-2 text-[12px] font-bold text-ink hover:border-ink"
                        >
                          Check map
                        </a>
                      </div>
                      {searches[video.id].result?.sources.length ? (
                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                          <span className="font-semibold text-muted">Sources</span>
                          {searches[video.id].result?.sources.map((source) => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="max-w-full truncate text-red underline underline-offset-2">
                              {source.title}
                            </a>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-2 text-[11px] leading-4 text-muted">AI suggestions can be wrong. Check the source and map before saving.</p>
                    </>
                  ) : (
                    <p className="text-[13px] leading-5 text-muted">No confident match found. Try adding a neighborhood or a more specific name.</p>
                  )}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <CompanionButton
        open={chatOpen}
        onToggle={() => {
          setChatStarted(true);
          setChatOpen((current) => !current);
        }}
        className=""
        style={{
          position: "fixed",
          bottom: "calc(76px + env(safe-area-inset-bottom))",
          right: "max(calc((100vw - 430px) / 2 + 16px), 16px)",
        }}
      />
      {chatStarted ? (
        <CompanionChat
          hidden={!chatOpen || Boolean(selectedPlace)}
          onClose={() => setChatOpen(false)}
          onSelectPlace={setSelectedPlace}
          onShowRoute={() => {
            setChatOpen(false);
            router.push("/saved?route=1");
          }}
          className=""
          style={{
            position: "fixed",
            bottom: "calc(148px + env(safe-area-inset-bottom))",
            right: "max(calc((100vw - 430px) / 2 + 16px), 16px)",
          }}
        />
      ) : null}
    </div>
  );
}
