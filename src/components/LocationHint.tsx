"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Locate } from "./Icons";
import { currentPosition, gotPlace, savePlace } from "@/lib/placeStore";

/**
 * Until somebody says where they are, the list is a guess made from their internet connection —
 * which in practice means the middle of Tel Aviv, or the city their phone company routes through.
 * Someone who has used the site before knows to go and fix it. Someone arriving for the first time
 * has no reason to suspect anything is wrong, and simply sees the wrong cinemas. So the guess says
 * out loud that it is one, and offers the single tap that settles it.
 */
export function LocationHint({ label }: { label: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "denied" | "failed">("idle");

  const locate = async () => {
    setState("busy");
    const p = await currentPosition();
    // Pressing "allow" and being told we failed is the worst of both: say which it was.
    if (!gotPlace(p)) return setState(p === "denied" ? "denied" : "failed");
    await savePlace(p);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-line bg-card px-3 py-2.5 text-[13px] text-muted">
      <span>
        {state === "denied"
          ? "אין הרשאת מיקום. אפשר לבחור עיר בכפתור למעלה."
          : state === "failed"
            ? "הטלפון לא הצליח לאתר את המיקום. אפשר לנסות שוב, או לבחור עיר בכפתור למעלה."
            : `מציג סרטים באזור ${label}`}
      </span>
      {state !== "denied" && (
        <button type="button" onClick={locate} disabled={state === "busy"} className="flex items-center gap-1 font-medium text-accent">
          <Locate width={14} height={14} />
          {state === "busy" ? "מאתר…" : state === "failed" ? "עוד ניסיון" : "למיקום שלך"}
        </button>
      )}
    </div>
  );
}
