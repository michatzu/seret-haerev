"use client";

import { captureInstallOffer } from "@/lib/install";

/**
 * Android announces that it is willing to install the site, once, soon after a page loads — and
 * refuses to do it later unless the announcement was kept. Nothing is rendered here; this exists
 * to be in the layout, where it is listening before anybody has navigated anywhere.
 */
captureInstallOffer();

export function InstallCapture() {
  return null;
}
