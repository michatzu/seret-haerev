"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BottomSheet, SheetOption } from "./BottomSheet";
import { Caret, Locate, Pin } from "./Icons";
import { CITIES, type Place } from "@/lib/geo";

const COOKIE = "loc";

function setLocCookie(p: Place) {
  document.cookie = `${COOKIE}=${p.lat.toFixed(5)},${p.lng.toFixed(5)},${encodeURIComponent(p.label)}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LocationButton({ label, source }: { label: string; source: "cookie" | "ip" | "default" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = useCallback(() => setOpen(false), []);

  const choose = (p: Place) => {
    setLocCookie(p);
    setOpen(false);
    router.refresh();
  };

  /** Asks the device for its position (this is what triggers the browser's permission prompt). */
  const locate = () => {
    if (!("geolocation" in navigator)) return setError("הדפדפן הזה לא תומך באיתור מיקום");
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        choose({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "המיקום שלי" });
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED ? "לא ניתנה הרשאת מיקום. אפשר לאשר אותה בהגדרות הדפדפן, או פשוט לבחור עיר מהרשימה." : "לא הצלחנו לאתר את המיקום. אפשר לבחור עיר מהרשימה.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const precise = source === "cookie" && label === "המיקום שלי";

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
