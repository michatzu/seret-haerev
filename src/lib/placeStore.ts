"use client";

import type { Place } from "./geo";

/**
 * Keeping the chosen place, from the browser's side.
 *
 * Three things conspire to lose it: Safari discards cookies written by scripts, an app added to
 * the home screen keeps its own cookie jar that starts empty, and a person who travels wants the
 * list to follow them rather than remember where they were last week. So the choice is written by
 * the server, mirrored here in case the cookie is dropped anyway, and — when the viewer has
 * already granted the permission once — quietly replaced by where they actually are.
 */
const KEY = "place";

export function remembered(): Place | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Place>;
    if (typeof p?.lat === "number" && typeof p?.lng === "number" && typeof p?.label === "string") return p as Place;
  } catch { /* private window, blocked storage, a value from an older shape */ }
  return null;
}

/** Writes the place as a real cookie and keeps a copy here. Resolves false if the server refused. */
export async function savePlace(p: Place): Promise<boolean> {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* nothing below depends on it */ }
  try {
    const res = await fetch("/api/location", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Has the viewer already allowed this site to see where they are? */
export async function locationAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
    return status?.state === "granted";
  } catch {
    // Safari answered this query only from 16 onwards; older ones simply do not tell us.
    return false;
  }
}

export function currentPosition(timeout = 8000): Promise<Place | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "המיקום שלי" }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout, maximumAge: 2 * 60_000 },
    );
  });
}
