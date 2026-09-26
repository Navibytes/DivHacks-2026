// Square button that flips Saved Spots between map and list.
export function ViewToggle({
  view,
  onToggle,
}: {
  view: "map" | "list";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={view === "map" ? "Show as list" : "Show on map"}
      className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] border border-line bg-paper text-ink shadow-[0_1px_2px_rgba(35,26,17,0.06)]"
    >
      {view === "map" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="4.5" cy="6" r="1.3" fill="currentColor" />
          <circle cx="4.5" cy="12" r="1.3" fill="currentColor" />
          <circle cx="4.5" cy="18" r="1.3" fill="currentColor" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 5.5 3 7.2v12.3l5-1.7 8 1.7 5-1.7V5.5L16 7.2 8 5.5ZM8 5.5v12.3M16 7.2v12.3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
