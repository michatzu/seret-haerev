"use client";

/**
 * The viewer's own three lists: films they mean to see, films they have seen, and films they would
 * rather not be offered again. A film sits in at most one of them, so this is a single status per
 * film rather than three sets. Kept in this browser only, like the location choice: no account,
 * no server, nothing that could identify anybody.
 */
import { useSyncExternalStore } from "react";

export type FilmStatus = "want" | "watched" | "skip";
export const STATUSES: FilmStatus[] = ["want", "watched", "skip"];

export const STATUS_LABEL: Record<FilmStatus, string> = {
  want: "מעניין",
  watched: "צפיתי",
  skip: "לא מעניין",
};

const KEY = "film-lists";
const LEGACY_KEY = "watched"; // the first version stored only an array of watched ids
const EVENT = "film-lists-change";

type Store = Partial<Record<string, FilmStatus>>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Store;
    }
    // migrate the old watched-only list on first read
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy) as unknown;
      if (Array.isArray(ids)) {
        const store: Store = {};
        for (const id of ids) if (typeof id === "string") store[id] = "watched";
        localStorage.setItem(KEY, JSON.stringify(store));
        localStorage.removeItem(LEGACY_KEY);
        return store;
      }
    }
  } catch { /* private window, blocked storage, corrupted value */ }
  return {};
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* nothing depends on it succeeding */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** The most recent filing, so it can be undone; kept in memory only, it is not worth persisting. */
let last: { id: string; title: string; status: FilmStatus; previous: FilmStatus | undefined; at: number } | null = null;
export const lastChange = () => last;

/** Sets the status, or clears it when the film already carries it. Returns the status now in force. */
export function setStatus(id: string, status: FilmStatus, title = ""): FilmStatus | undefined {
  const store = read();
  const previous = store[id];
  const next = previous === status ? undefined : status;
  if (next) store[id] = next;
  else delete store[id];
  last = next ? { id, title, status: next, previous, at: Date.now() } : null;
  write(store);
  return next;
}

/** Puts the last filed film back where it was. */
export function undoLast() {
  if (!last) return;
  const store = read();
  if (last.previous) store[last.id] = last.previous;
  else delete store[last.id];
  last = null;
  write(store);
}

export function clearList(status: FilmStatus) {
  const store = read();
  for (const [id, s] of Object.entries(store)) if (s === status) delete store[id];
  write(store);
}

/* ---- reading, through useSyncExternalStore: localStorage is a store outside React ---- */

let snapshot: Store = {};
let snapshotRaw: string | null = null;
const EMPTY: Store = {};

function getSnapshot(): Store {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { raw = null; }
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = read(); // a new object only when the stored value actually changed
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

export function useFilmLists(): { store: Store; ready: boolean } {
  return { store: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), ready: useHydrated() };
}

/** Ids carrying one status, most recently added last (object insertion order). */
export function idsWith(store: Store, status: FilmStatus): string[] {
  return Object.entries(store).filter(([, s]) => s === status).map(([id]) => id);
}

/** False during the server render and the first client render, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
const noopSubscribe = () => () => {};
