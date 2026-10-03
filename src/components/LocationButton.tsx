"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet, SheetOption } from "./BottomSheet";
import { Caret, Locate, Pin } from "./Icons";
import { CITIES, distanceKm, type Place } from "@/lib/geo";
import { currentPosition, locationAllowed, remembered, savePlace } from "@/lib/placeStore";

/** Far enough from where the list thinks you are to be worth redrawing it. */
const MOVED_KM = 1.5;
/** What the place is called once it comes from the device rather than from a list of cities. */
const PRECISE = "המיקום שלי";

export function LocationButton({ label, source, here }: { label: string; source: "cookie" | "ip" | "default"; here: { lat: number; lng: number } }) {
  const onTheSpot = source === "cookie" && label === PRECISE;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const settled = useRef(false);

  /**
   * Once per load, before anybody has to think about it: if the permission is already granted,
   * the position is simply read and the list follows the viewer from city to city. Failing that,
   * a choice this browser remembers is written back as a cookie — the home-screen app and Safari
   * do not share one, and Safari throws away the kind a script writes.
   */
  useEffect(() => {
    if (settled.current) return;
    settled.current = true;
    let cancelled = false;
    (async () => {
      if (await locationAllowed()) {
        const p = await currentPosition();
        // Somebody who has allowed this once means it: the device wins over a city picked before,
        // and over a guess made from the connection, however close either happens to be today.
        if (p && !cancelled && (!onTheSpot || distanceKm(p, here) > MOVED_KM) && (await savePlace(p))) router.refresh();
        return;
      }
      if (source === "cookie") return;
      const kept = remembered();
      if (kept && !cancelled && (await savePlace(kept))) router.refresh();
    })();
    return () => { cancelled = true; };
  }, [here, source, onTheSpot, router]);

  const choose = (p: Place) => {
    setOpen(false);
    void savePlace(p).then(() => router.refresh());
  };

  /** Asks the device for its position (this is what triggers the browser's permission prompt). */
  const locate = () => {
    if (!("geolocation" in navigator)) return setError("הדפדפן הזה לא תומך באיתור מיקום");
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        choose({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: PRECISE });
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED ? "לא ניתנה הרשאת מיקום. אפשר לאשר אותה בהגדרות הדפדפן, או פשוט לבחור עיר מהרשימה." : "לא הצלחנו לאתר את המיקום. אפשר לבחור עיר מהרשימה.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const precise = onTheSpot;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-[44px] items-center gap-[5px] py-2 text-[14px] font-medium text-ink" aria-haspopup="dialog">
        <Pin width={15} height={15} className="text-accent" />
        <span>{label}</span>
        <Caret width={12} height={12} className="text-muted" />
      </button>
      <BottomSheet open={open} onClose={close} title={source === "cookie" ? "מיקום" : `מיקום · כרגע ${label}, לפי חיבור האינטרנט`}>
        <button type="button" onClick={locate} disabled={busy} className={`flex min-h-[50px] w-full items-center gap-2 px-0.5 text-start text-[16px] font-medium ${precise ? "text-ink" : "text-accent"}`}>
          <Locate width={18} height={18} />
          <span>{busy ? "מאתר את המיקום…" : "המיקום המדויק שלי"}</span>
        </button>
        {error && <div className="px-0.5 pb-2 text-[13px] text-muted">{error}</div>}
        {CITIES.map((c) => (
          <SheetOption key={c.label} selected={label === c.label} onSelect={() => choose(c)}>{c.label}</SheetOption>
        ))}
      </BottomSheet>
    </>
  );
}
