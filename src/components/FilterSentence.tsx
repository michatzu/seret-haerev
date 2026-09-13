"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BottomSheet, SheetOption } from "./BottomSheet";
import { Caret } from "./Icons";
import {
  DEFAULTS, FROM_LABELS, HALL_LABELS, RADIUS_LABELS, dayLabel, queryToSearch,
  type DayKey, type FromKey, type HallKey, type Query, type RadiusKey,
} from "@/lib/query";

type Key = "day" | "from" | "radius" | "hall";

export function FilterSentence({ q, onDark = false }: { q: Query; onDark?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<Key | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const apply = (patch: Partial<Query>) => {
    setOpen(null);
    router.push(`${pathname}${queryToSearch({ ...q, ...patch }, q)}`, { scroll: false });
  };

  const dayOpts: { v: DayKey; label: string }[] = (["today", "tomorrow", "d2", "d3", "week"] as DayKey[]).map((v) => ({ v, label: dayLabel(v) }));
  const fromOpts: { v: FromKey; label: string }[] = (q.day === "today" ? (["now", "noon", "evening", "night", "all"] as FromKey[]) : (["noon", "evening", "night", "all"] as FromKey[])).map((v) => ({ v, label: FROM_LABELS[v] }));
  const radiusOpts: { v: RadiusKey; label: string }[] = (["5", "15", "30", "all"] as RadiusKey[]).map((v) => ({ v, label: RADIUS_LABELS[v] }));
  const hallOpts: { v: HallKey; label: string }[] = (["all", "imax", "vip", "4dx", "cinematheque", "outdoor"] as HallKey[]).map((v) => ({ v, label: HALL_LABELS[v] }));

  const defaultFrom: FromKey = q.day === "today" ? "now" : "evening";
  const words: { key: Key; label: string; changed: boolean }[] = [
    { key: "day", label: dayLabel(q.day), changed: q.day !== DEFAULTS.day },
    { key: "from", label: FROM_LABELS[q.from], changed: q.from !== defaultFrom },
    { key: "radius", label: RADIUS_LABELS[q.radius], changed: q.radius !== DEFAULTS.radius },
    { key: "hall", label: HALL_LABELS[q.hall], changed: q.hall !== DEFAULTS.hall },
  ];

  const muted = onDark ? "text-[#aab0bb]" : "text-muted";
  const ink = onDark ? "text-[#f3f4f6]" : "text-ink";

  return (
    <>
      <div className={`flex flex-wrap items-center justify-center gap-x-2 text-[14px] ${muted}`}>
        {words.map((w, i) => (
          <span key={w.key} className="flex items-center">
            {i > 0 && <span className="me-2 select-none">·</span>}
            <button
              type="button"
              onClick={() => setOpen(w.key)}
              className={`flex items-center gap-[3px] py-2 font-medium ${w.changed ? "text-accent" : ink}`}
              aria-haspopup="dialog"
            >
              <span className={w.changed ? "border-b border-accent pb-px" : "fword"}>{w.label}</span>
              <Caret width={12} height={12} className={muted} />
            </button>
          </span>
        ))}
      </div>

      <BottomSheet open={open === "day"} onClose={close} title="יום">
        {dayOpts.map((o, i) => (
          <SheetOption key={o.v} first={i === 0} selected={q.day === o.v} onSelect={() => apply({ day: o.v, from: o.v === "today" ? (q.from === "now" || q.from === defaultFrom ? "now" : q.from) : q.from === "now" ? "evening" : q.from, sort: o.v === "week" && q.sort === "time" ? "dist" : q.sort })}>
            {o.label}
          </SheetOption>
        ))}
      </BottomSheet>
      <BottomSheet open={open === "from"} onClose={close} title="שעה">
        {fromOpts.map((o, i) => (
          <SheetOption key={o.v} first={i === 0} selected={q.from === o.v} onSelect={() => apply({ from: o.v })}>{o.label}</SheetOption>
        ))}
      </BottomSheet>
      <BottomSheet open={open === "radius"} onClose={close} title="מרחק">
        {radiusOpts.map((o, i) => (
          <SheetOption key={o.v} first={i === 0} selected={q.radius === o.v} onSelect={() => apply({ radius: o.v })}>{o.label}</SheetOption>
        ))}
      </BottomSheet>
      <BottomSheet open={open === "hall"} onClose={close} title="אולם">
        {hallOpts.map((o, i) => (
          <SheetOption key={o.v} first={i === 0} selected={q.hall === o.v} onSelect={() => apply({ hall: o.v })}>{o.label}</SheetOption>
        ))}
      </BottomSheet>
    </>
  );
}
