export function FilterChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-[12px] border px-3 py-2 text-[13px] font-semibold ${
        selected
          ? "border-red bg-soft text-red"
          : "border-line bg-paper text-ink"
      }`}
    >
      {label}
    </button>
  );
}
