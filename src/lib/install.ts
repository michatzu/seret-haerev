"use client";

/**
 * Adding the site to a home screen, which the two phone platforms treat very differently.
 *
 * Android fires an event offering to do it, and will only do it from a gesture inside the page —
 * so the event has to be caught the moment it arrives, long before anybody reaches the list where
 * we offer it. iOS has never exposed anything at all: there the most we can do is say where the
 * button is. And an app already on a home screen asks for nothing.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "install-dismissed";
const EVENT = "install-offer-change";

let offer: InstallEvent | null = null;
let listening = false;

export function captureInstallOffer() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for a button of our own rather than letting the browser bar take it
    offer = e as InstallEvent;
    window.dispatchEvent(new CustomEvent(EVENT));
  });
  window.addEventListener("appinstalled", () => {
    offer = null;
    window.dispatchEvent(new CustomEvent(EVENT));
  });
}

export function subscribeInstall(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}
export const hasOffer = () => !!offer;

/** Android only, and only straight out of a tap: the browser refuses it otherwise. */
export async function acceptOffer(): Promise<boolean> {
  if (!offer) return false;
  await offer.prompt();
  const { outcome } = await offer.userChoice;
  offer = null;
  window.dispatchEvent(new CustomEvent(EVENT));
  return outcome === "accepted";
}

export function alreadyInstalled(): boolean {
  if (typeof window === "undefined") return true;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

export const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function dismissed(): boolean {
  try { return localStorage.getItem(DISMISSED) === "1"; } catch { return false; }
}
export function dismiss() {
  try { localStorage.setItem(DISMISSED, "1"); } catch { /* nothing depends on it */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}
