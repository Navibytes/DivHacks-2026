"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loopie } from "@/components/Loopie";
import { usePlaces } from "@/lib/places-store";

export function BottomNav() {
  const pathname = usePathname();
  const { places } = usePlaces();
  const items = [
    { href: "/saved", label: "Saved Spots", icon: SavedIcon, match: ["/saved"] },
    { href: "/finds", label: "New Finds", icon: FindsIcon, match: ["/finds"], badge: places.filter((place) => !place.saved).length },
    // The companion owns planning: the form at "/" and the generated loop at "/loops".
    { href: "/", label: "AI Companion", icon: CompanionIcon, match: ["/", "/loops"] },
  ];

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm"
    >
      <ul className="grid grid-cols-3">
        {items.map((item) => {
          const active = item.match.some((path) =>
            path === "/" ? pathname === "/" : pathname.startsWith(path),
          );
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-semibold ${
                  active ? "text-red" : "text-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon active={active} />
                  {item.badge ? (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red px-1 text-[10px] font-bold leading-none text-white">
                      {item.badge}
                      <span className="sr-only"> new</span>
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SavedIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4-7 4v-16a1 1 0 0 1 1-1Z"
        stroke={active ? "#B63A2B" : "#7A6A63"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? "#FBE8E4" : "none"}
      />
      <path
        d="M12 13.2 9.4 10.7a1.6 1.6 0 0 1 2.3-2.3l.3.3.3-.3a1.6 1.6 0 0 1 2.3 2.3L12 13.2Z"
        fill={active ? "#B63A2B" : "#7A6A63"}
      />
    </svg>
  );
}

function FindsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke={active ? "#B63A2B" : "#7A6A63"}
        strokeWidth="1.8"
        fill={active ? "#FBE8E4" : "none"}
      />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill={active ? "#B63A2B" : "#7A6A63"} />
    </svg>
  );
}

function CompanionIcon({ active }: { active: boolean }) {
  return (
    <span className={`nav-loopie block ${active ? "" : "grayscale opacity-60"}`}>
      <Loopie state="idle" size={24} />
    </span>
  );
}
