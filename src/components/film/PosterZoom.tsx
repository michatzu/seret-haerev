"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Close } from "../Icons";

/** Poster that opens full-size on tap. */
export function PosterZoom({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="shrink-0" aria-label="הגדלת הפוסטר">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={110} height={165} className="h-[165px] w-[110px] rounded-lg bg-black/20 object-cover shadow-[0_10px_30px_rgba(0,0,0,0.55)]" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,10,14,0.92)]" role="dialog" aria-modal="true" aria-label={alt} onClick={close}>
            <button type="button" onClick={close} aria-label="סגירה" className="absolute left-4 top-[max(16px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white">
              <Close width={20} height={20} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-[86vh] max-w-[92vw] rounded-lg object-contain shadow-[0_20px_60px_rgba(0,0,0,0.6)]" onClick={(e) => e.stopPropagation()} />
          </div>,
          document.body,
        )}
    </>
  );
}
