"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BottomSheet, CheckOption, DoneButton, SheetOption } from "./BottomSheet";
import { Caret } from "./Icons";
import { formatDistance } from "@/lib/geo";
import { GENRES } from "@/lib/genres";
import {
  DEFAULT_RADIUS, FROM_LABELS, HALLS, HALL_LABELS, RADIUS_LABELS, dayLabel, defaultFrom, fromLabel, genresLabel, hallsLabel, queryToSearch, venuesLabel,
  type Band, type DayKey, type FromKey, type HallKey, type Query, type RadiusKey,
} from "@/lib/query";

export interface VenueOption { id: string; name: string; km: number }
type Key = "day" | "from" | "radius" | "halls" | "venues" | "genres";

export function FilterSentence({ q, venues, genres, showGenres = true }: { q: Query; venues: VenueOption[]; genres: string[]; showGenres?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState<Key | null>(null);
  const close = useCallback(() => setOpen(null), []);

  const go = (next: Query, keepOpen = false) => {
    if (!keepOpen) setOpen(null);
    router.replace(`${pathname}${queryToSearch(next)}`, { scroll: false });
  };
  const toggle = <T extends string>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const venueNames = new Map(venues.map((v) => [v.id, v.name]));
  const df = defaultFrom(q.day);
  const words: { key: Key; label: string; changed: boolean }[] = [
    { key: "day", label: dayLabel(q.day), changed: q.day !== "today" },
    { key: "from", label: fromLabel(q.from), changed: !(q.from.length === df.length && q.from.every((f) => df.includes(f))) },
    { key: "radius", label: RADIUS_LABELS[q.radius], changed: q.radius !== DEFAULT_RADIUS },
    { key: "halls", label: hallsLabel(q.halls), changed: q.halls.length > 0 },
    { key: "venues", label: venuesLabel(q.venues, venueNames), changed: q.venues.length > 0 },
    ...(showGenres ? [{ key: "genres" as Key, label: genresLabel(q.genres), changed: q.genres.length > 0 }] : []),
  ];

  const bands: Band[] = ["noon", "evening", "night"];
  const availableGenres = GENRES.filter((g) => genres.includes(g.key));

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-2 text-[14px] leading-tight text-muted">
        {words.map((w, i) => (
          <span key={w.key} className="flex items-center">
            {i > 0 && <span className="me-2 select-none">·</span>}
            <button type="button" onClick={() => setOpen(w.key)} className={`flex items-center gap-[3px] py-2 font-medium ${w.changed ? "text-accent" : "text-ink"}`} aria-haspopup="dialog">
              <span className={w.changed ? "border-b border-accent pb-px" : "fword"}>{w.label}</span>
              <Caret width={12} height={12} className="text-muted" />
            </button>
          </span>
        ))}
      </div>

      {/* day: single */}
      <BottomSheet open={open === "day"} onClose={close} title="יום">
        {(["today", "tomorrow", "d2", "d3", "week"] as DayKey[]).map((d, i) => (
          <SheetOption key={d} first={i === 0} selected={q.day === d} onSelect={() => go({ ...q, day: d, from: d === "today" ? (q.from.length === 1 && q.from[0] === "evening" && q.day !== "today" ? ["now"] : q.from) : q.from.includes("now") ? ["evening"] : q.from, sort: d === "week" && q.sort === "time" ? "dist" : q.sort })}>
            {dayLabel(d)}
          </SheetOption>
        ))}
      </BottomSheet>

      {/* time: "now" is exclusive, bands combine, "all day" clears */}
      <BottomSheet open={open === "from"} onClose={close} title="שעה" footer={<DoneButton onClick={close} />}>
        {q.day === "today" && (
          <SheetOption first selected={q.from.includes("now")} onSelect={() => go({ ...q, from: ["now"] }, true)}>{FROM_LABELS.now}</SheetOption>
        )}
        {bands.map((b, i) => (
          <CheckOption key={b} first={i === 0 && q.day !== "today"} checked={q.from.includes(b)} onToggle={() => go({ ...q, from: toggle(q.from.filter((f) => f !== "now") as FromKey[], b) }, true)}>
            {FROM_LABELS[b]}
          </CheckOption>
        ))}
        <SheetOption selected={q.from.length === 0} onSelect={() => go({ ...q, from: [] }, true)}>כל היום</SheetOption>
      </BottomSheet>

      {/* radius: single */}
      <BottomSheet open={open === "radius"} onClose={close} title="מרחק">
        {(["5", "15", "30", "all"] as RadiusKey[]).map((r, i) => (
          <SheetOption key={r} first={i === 0} selected={q.radius === r} onSelect={() => go({ ...q, radius: r })}>{RADIUS_LABELS[r]}</SheetOption>
        ))}
      </BottomSheet>

      {/* halls: multi */}
      <BottomSheet open={open === "halls"} onClose={close} title="אולם" footer={<DoneButton onClick={close} />}>
        <SheetOption first selected={q.halls.length === 0} onSelect={() => go({ ...q, halls: [] }, true)}>כל האולמות</SheetOption>
        {HALLS.map((h) => (
          <CheckOption key={h} checked={q.halls.includes(h)} onToggle={() => go({ ...q, halls: toggle(q.halls, h as HallKey) }, true)}>{HALL_LABELS[h]}</CheckOption>
        ))}
      </BottomSheet>

      {/* venues: multi, nearest first */}
      <BottomSheet open={open === "venues"} onClose={close} title="בתי קולנוע" footer={<DoneButton onClick={close} />}>
        <SheetOption first selected={q.venues.length === 0} onSelect={() => go({ ...q, venues: [] }, true)}>כל בתי הקולנוע</SheetOption>
        {venues.map((v) => (
          <CheckOption key={v.id} checked={q.venues.includes(v.id)} onToggle={() => go({ ...q, venues: toggle(q.venues, v.id) }, true)} hint={formatDistance(v.km)}>
            {v.name}
          </CheckOption>
        ))}
      </BottomSheet>

      {/* genres: multi */}
      {showGenres && (
        <BottomSheet open={open === "genres"} onClose={close} title="ז׳אנר" footer={<DoneButton onClick={close} />}>
          <SheetOption first selected={q.genres.length === 0} onSelect={() => go({ ...q, genres: [] }, true)}>כל הז׳אנרים</SheetOption>
          {availableGenres.map((g) => (
            <CheckOption key={g.key} checked={q.genres.includes(g.key)} onToggle={() => go({ ...q, genres: toggle(q.genres, g.key) }, true)}>{g.label}</CheckOption>
          ))}
        </BottomSheet>
      )}
    </>
  );
}
