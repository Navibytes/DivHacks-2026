// "12:50 PM" <-> minutes since midnight, for small UI-side time math.
export function parseClock(label: string) {
  const [time, period] = label.split(" ");
  const [h, m] = time.split(":").map(Number);
  return ((h % 12) + (period === "PM" ? 12 : 0)) * 60 + m;
}

export function formatClock(minutes: number) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}
