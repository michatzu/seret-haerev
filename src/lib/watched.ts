"use client";

/**
 * Films the viewer has already seen. Kept in this browser only: no account, no server, nothing
 * that could identify anybody, which is the same promise the privacy page makes about location.
 */
import { useSyncExternalStore } from "react";

const KEY = "watched";
const EVENT = "watched-change";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return []; // private window, blocked storage, corrupted value
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch { /* nothing we can do, and nothing depends on it */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function isWatched(id: string): boolean {
  return read().includes(id);
}

export function toggleWatched(id: string): boolean {
  const ids = read();
  const i = ids.indexOf(id);
  if (i >= 0) ids.splice(i, 1);
  else ids.unshift(id); // most recent first
  write(ids);
  return i < 0;
}

export function clearWatched() {
  write([]);
}

/**
 * The watched list, kept in sync across components and browser tabs. Read through
 * useSyncExternalStore because localStorage is exactly that: a store outside React.
 */
let snapshot: string[] = [];
let snapshotRaw: string | null = null;
const EMPTY: string[] = [];

function getSnapshot(): string[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = null; }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = read(); // a new array only when the stored value actually changed
  }
  return snapshot;
}
const getServerSnapshot = () => EMPTY;

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) onChange(); };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWatched(): { ids: string[]; ready: boolean } {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ids, ready: useHydrated() };
}

/** False during the server render and the first client render, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
const noopSubscribe = () => () => {};
