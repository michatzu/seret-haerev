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

export type PositionFailure = "denied" | "unavailable" | "timeout";

/**
 * Where the device says it is, or why it would not say.
 *
 * The timeout has to cover the permission dialog as well as the fix, because the clock starts the
 * moment we ask and the person has not even seen the question yet. Eight seconds was enough to
 * tell somebody who had just pressed "allow" that we had failed — which is both wrong and the
 * least helpful thing to say at that moment.
 */
export function currentPosition(timeout = 30_000): Promise<Place | PositionFailure> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve("unavailable");
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "המיקום שלי" }),
      (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable"),
      { enableHighAccuracy: false, timeout, maximumAge: 2 * 60_000 },
    );
  });
}

export const gotPlace = (r: Place | PositionFailure): r is Place => typeof r === "object";
