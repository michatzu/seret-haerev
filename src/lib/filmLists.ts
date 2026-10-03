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

/**
 * What is kept about a filed film, beyond which list it is in.
 *
 * The schedule only ever holds what is playing now, so a film filed in March is a stranger to the
 * server by May — and a list that asks the server who its films are is a list that empties itself.
 * The name is written down at the moment of filing, so the list can always draw itself, with or
 * without a schedule and with or without a network.
 */
export interface Entry {
  status: FilmStatus;
  title: string;
  year?: number;
  /** when it was filed, so a list can be read newest first */
  at: number;
}

type Store = Partial<Record<string, Entry>>;
export type { Store };

/** The status of one film, or nothing if it is in no list. */
export const statusOf = (store: Store, id: string): FilmStatus | undefined => store[id]?.status;

/** An older store kept the status alone; a film filed then has no name until one is learnt. */
function asEntry(v: unknown): Entry | undefined {
  if (typeof v === "string" && (STATUSES as string[]).includes(v)) return { status: v as FilmStatus, title: "", at: 0 };
  if (v && typeof v === "object") {
    const e = v as Partial<Entry>;
    if (typeof e.status === "string" && (STATUSES as string[]).includes(e.status)) {
      return { status: e.status, title: typeof e.title === "string" ? e.title : "", year: typeof e.year === "number" ? e.year : undefined, at: typeof e.at === "number" ? e.at : 0 };
    }
  }
  return undefined;
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const store: Store = {};
        for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
          const e = asEntry(v);
          if (e) store[id] = e;
        }
        return store;
      }
    }
    // migrate the old watched-only list on first read
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy) as unknown;
      if (Array.isArray(ids)) {
        const store: Store = {};
        for (const id of ids) if (typeof id === "string") store[id] = { status: "watched", title: "", at: 0 };
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
let last: { id: string; title: string; status: FilmStatus; previous: Entry | undefined; at: number } | null = null;
export const lastChange = () => last;

/** Sets the status, or clears it when the film already carries it. Returns the status now in force. */
export function setStatus(id: string, status: FilmStatus, title = "", year?: number): FilmStatus | undefined {
  const store = read();
  const was = store[id];
  const next = was?.status === status ? undefined : status;
  if (next) store[id] = { status: next, title: title || was?.title || "", year: year ?? was?.year, at: Date.now() };
  else delete store[id];
  last = next ? { id, title, status: next, previous: was, at: Date.now() } : null;
  write(store);
  return next;
}

/** Writes down a name we have only just learnt, for a film filed before we kept one. */
export function rememberTitles(known: { id: string; title: string; year?: number }[]) {
  const store = read();
  let changed = false;
  for (const f of known) {
    const e = store[f.id];
    if (e && !e.title && f.title) { store[f.id] = { ...e, title: f.title, year: e.year ?? f.year }; changed = true; }
  }
  if (changed) write(store);
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
  for (const [id, e] of Object.entries(store)) if (e?.status === status) delete store[id];
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
  return entriesWith(store, status).map((e) => e.id);
}

/** Everything filed under one status, newest first, each with whatever was known when it was filed. */
export function entriesWith(store: Store, status: FilmStatus): (Entry & { id: string })[] {
  return Object.entries(store)
    .flatMap(([id, e]) => (e && e.status === status ? [{ ...e, id }] : []))
    .sort((a, b) => b.at - a.at);
}

/** False during the server render and the first client render, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
const noopSubscribe = () => () => {};

/* ---- the whole store, for backup and for a code shared between devices ---- */

/** Everything filed here, in the shape the sync code stores. */
export function allEntries(): Store {
  return read();
}

/**
 * Folds a list that arrived from elsewhere into this one, keeping whichever filing is newer.
 * Nothing is ever dropped: restoring a code on a device that already has films adds to it.
 */
export function mergeIn(incoming: Store): number {
  const store = read();
  let added = 0;
  for (const [id, v] of Object.entries(incoming)) {
    const e = asEntry(v);
    if (!e) continue;
    const mine = store[id];
    if (!mine || e.at > mine.at) {
      store[id] = { ...e, title: e.title || mine?.title || "" };
      added++;
    }
  }
  if (added) write(store);
  return added;
}
