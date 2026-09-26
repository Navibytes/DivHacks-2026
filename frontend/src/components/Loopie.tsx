type LoopieState = "idle" | "thinking" | "happy";

// Loopie: LocalLoop's NYC guide. A little brick-red gumdrop with a
// Liberty-style crown and a map-pin torch. Animations live in globals.css.
const CROWN =
  "M26 33.5 23 26.5l7.5 2.5 1.5-7.5 4.5 5.5L40 18.5l3.5 8.5 4.5-5.5 1.5 7.5 7.5-2.5-3 7q-14-7-28 0Z";

export function Loopie({
  state = "idle",
  size = 72,
}: {
  state?: LoopieState;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={`loopie loopie-${state} shrink-0`}
    >
      <ellipse cx="40" cy="74" rx="17" ry="3" fill="#EADDD8" />

      {/* torch arm + map-pin flame */}
      <path d="M59 56 69 46" stroke="#B63A2B" strokeWidth="5" strokeLinecap="round" />
      <rect x="66.5" y="40" width="6" height="5" rx="1.5" fill="#9E2F22" />
      <path
        d="M69.5 39.5c-2.6-2.8-3.8-4.7-3.8-6.3a3.8 3.8 0 0 1 7.6 0c0 1.6-1.2 3.5-3.8 6.3Z"
        fill="#F2B84B"
      />

      {/* body */}
      <path
        d="M18 50c0-16 10-26 22-26s22 10 22 26c0 12-9 20-22 20s-22-8-22-20Z"
        fill="#B63A2B"
      />
      <ellipse cx="28" cy="41" rx="4.5" ry="3" fill="#FFFFFF" opacity="0.16" />

      {/* Liberty-style crown */}
      <path
        d={CROWN}
        fill="#F2B84B"
        stroke="#F2B84B"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* face */}
      {state === "happy" ? (
        <g stroke="#231A11" strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d="M30.5 46q3-5 6 0" />
          <path d="M43.5 46q3-5 6 0" />
        </g>
      ) : (
        <g className="loopie-eyes" fill="#231A11">
          <rect x="31" y="39" width="6" height="10" rx="3" />
          <rect x="43" y="39" width="6" height="10" rx="3" />
        </g>
      )}
      <circle cx="27.5" cy="54" r="3" fill="#E8836F" opacity="0.7" />
      <circle cx="52.5" cy="54" r="3" fill="#E8836F" opacity="0.7" />
      <path
        d={state === "happy" ? "M35 54q5 5 10 0" : "M36.5 54.5q3.5 3 7 0"}
        fill="none"
        stroke="#231A11"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
