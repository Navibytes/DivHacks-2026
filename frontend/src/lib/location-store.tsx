"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { areaName, type Area, type Point } from "@/lib/geo";

// Where the app plans from. By default that's the user's real location (GPS);
// they can also choose an area to explore ("I'm heading to Park Slope"), and
// then distances, "near me", Loopie and loops are all measured from there.
// Nothing is assumed: with no GPS and no chosen area, `origin` is null and
// distances simply aren't shown. Area names come from OpenStreetMap.

export type LocationStatus = "locating" | "on" | "denied" | "unavailable";

type LocationState = {
  /** Where distances are measured from: the chosen area, else your GPS position, else null. */
  origin: Point | null;
  /** Name for `origin`, e.g. "Williamsburg"; null until known. */
  area: string | null;
  /** "gps" = your real location; "chosen" = an area you picked to explore. */
  source: "gps" | "chosen" | null;
  /** Your real position (for the "you are here" dot), regardless of any chosen area. */
  here: Point | null;
  /** GPS status. */
  status: LocationStatus;
  /** Ask for location again (e.g. after the user allowed it in settings). */
  retry: () => void;
  /** Explore an area instead of your current location. */
  chooseArea: (area: Area) => void;
  /** Go back to your real location. */
  backToMyLocation: () => void;
};

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("locating");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Area | null>(null);
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

  const chooseArea = useCallback((next: Area) => setChosen(next), []);
  const backToMyLocation = useCallback(() => setChosen(null), []);

  const value = useMemo<LocationState>(
    () =>
      chosen
        ? {
            origin: { lat: chosen.lat, lng: chosen.lng },
            area: chosen.name,
            source: "chosen",
            here: origin,
            status,
            retry: start,
            chooseArea,
            backToMyLocation,
          }
        : {
            origin,
            area: origin ? area : null,
            source: origin ? "gps" : null,
            here: origin,
            status,
            retry: start,
            chooseArea,
            backToMyLocation,
          },
    [chosen, origin, area, status, start, chooseArea, backToMyLocation],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used inside LocationProvider");
  return context;
}
