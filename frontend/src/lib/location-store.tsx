"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { areaName, type Point } from "@/lib/geo";

// Where the user is, from the browser's location (GPS). Nothing is assumed:
// until location is known, `origin` is null and distances simply aren't shown.
// `area` is the real neighborhood name for that spot (OpenStreetMap lookup).

export type LocationStatus = "locating" | "on" | "denied" | "unavailable";

type LocationState = {
  /** Where the user is, or null if unknown (not allowed / not available yet). */
  origin: Point | null;
  /** Neighborhood name for `origin`, e.g. "Williamsburg"; null until known. */
  area: string | null;
  status: LocationStatus;
  /** Ask for location again (e.g. after the user allowed it in settings). */
  retry: () => void;
};

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("locating");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setStatus("locating");
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        // Ignore GPS jitter under ~20m so distances don't flicker.
        setOrigin((current) =>
          current && Math.abs(current.lat - next.lat) < 0.0002 && Math.abs(current.lng - next.lng) < 0.0002
            ? current
            : next,
        );
        setStatus("on");
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
    );
  }, []);

  // Ask as soon as the app opens: location is what makes the app work.
  useEffect(() => {
    const timer = setTimeout(start, 0);
    return () => {
      clearTimeout(timer);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [start]);

  // Real neighborhood name for where you are.
  useEffect(() => {
    if (!origin) return;
    let active = true;
    void areaName(origin).then((name) => {
      if (active) setArea(name);
    });
    return () => {
      active = false;
    };
  }, [origin]);

  const value = useMemo<LocationState>(
    () => ({ origin, area: origin ? area : null, status, retry: start }),
    [origin, area, status, start],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used inside LocationProvider");
  return context;
}
