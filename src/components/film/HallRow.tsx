"use client";

import { screeningsCount } from "@/lib/format";

import { useState } from "react";
import { TimePill } from "../TimePill";
import type { Screening } from "@/lib/types";

const SHOW = 3;

/** One hall type inside a venue card: a few times, "+N" expands the rest. */
export function HallRow({ label, screenings }: { label: string; screenings: Screening[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? screenings : screenings.slice(0, SHOW);
  const rest = screenings.length - shown.length;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[38px] shrink-0 text-[12px] font-medium text-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        {shown.map((s) => (
          <TimePill key={s.id} s={s} big tag={s.dubbedLang === "ru" ? "רוסית" : s.dubbedLang === "en" ? "אנגלית" : s.attrs.includes("dubbed") ? "מדובב" : s.attrs.includes("3d") && label !== "3D" ? "3D" : undefined} />
        ))}
        {rest > 0 && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-[38px] items-center rounded-md bg-plus-bg px-2.5 text-[14px] font-medium text-plus-ink" aria-label={`עוד ${screeningsCount(rest)}`}>
            +{rest}
          </button>
        )}
      </div>
    </div>
  );
}
