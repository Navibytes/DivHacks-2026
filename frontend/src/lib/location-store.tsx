"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { neighborhoods } from "@/data/neighborhoods";
import { milesBetween, nearestNeighborhood } from "@/lib/new-spot";

// Where the user is. Uses the browser's location (GPS) when allowed; otherwise,
// or when "Pretend I'm in SoHo" is on, uses SoHo so demos look right anywhere.
// Everything distance-related (place distances, "near me", the loop's area,
// Loopie's answers) reads `origin` and `area` from here.

type Point = { lat: number; lng: number };
export type LocationMode = "gps" | "demo";
export type LocationStatus = "idle" | "locating" | "on" | "denied" | "unavailable";

type LocationState = {
  /** The point distances are measured from. */
  origin: Point;
  /** Human name for where you are: a neighborhood, or "Nearby" outside known ones. */
  area: string;
  mode: LocationMode;
  status: LocationStatus;
  /** True when the origin is the user's real position. */
  isLive: boolean;
  enableGps: () => void;
  pretendSoHo: () => void;
};

const SOHO = neighborhoods[0];
/** Farther than this from every known neighborhood center, call the area "Nearby". */
const AREA_RADIUS_MILES = 1.5;
const STORAGE_KEY = "localloop-location";

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<LocationMode>("gps");
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<Point | null>(null);
  const watchId = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    if (watchId.current !== null) return;
    setStatus("locating");
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("on");
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  }, []);

  // Restore the saved choice, and only start GPS on load if permission was
  // already granted (so there's no surprise prompt; otherwise wait for a tap).
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage blocked: default to GPS mode.
    }
    if (saved === "demo") {
      // Applied after the first render so the server and browser markup match.
      void Promise.resolve().then(() => setMode("demo"));
      return;
    }
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (permission.state === "granted") startWatching();
      })
      .catch(() => {});
  }, [startWatching]);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  const remember = (next: LocationMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not critical.
    }
  };

  const enableGps = useCallback(() => {
    setMode("gps");
    remember("gps");
    startWatching();
  }, [startWatching]);

  const pretendSoHo = useCallback(() => {
    setMode("demo");
    remember("demo");
  }, []);

  const value = useMemo<LocationState>(() => {
    const isLive = mode === "gps" && coords !== null;
    const origin = isLive ? coords : { lat: SOHO.lat, lng: SOHO.lng };
    const nearest = nearestNeighborhood(origin);
    const area = milesBetween(origin, nearest) <= AREA_RADIUS_MILES ? nearest.name : "Nearby";
    return { origin, area, mode, status, isLive, enableGps, pretendSoHo };
  }, [mode, coords, status, enableGps, pretendSoHo]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used inside LocationProvider");
  return context;
}

/** "0.3 mi". Kept numeric-first: sorting code reads the number back out. */
export function formatMiles(miles: number) {
  return `${miles.toFixed(1)} mi`;
}
