"use client";

import { useRef, useState, type ReactNode } from "react";
import { Bookmark, EyeOff } from "./Icons";
import { setStatus } from "@/lib/filmLists";

const COMMIT_PX = 72; // past this the gesture counts
const ENGAGE_PX = 12; // before this it might still be a scroll

/**
 * Drag a card sideways to file it: right for "want to see", left for "not interested".
 * Directions are physical, not reading order, so they mean the same thing in Hebrew.
 * Pointer events only, and the gesture yields to vertical scrolling until it is clearly horizontal.
 */
export function SwipeToFile({ filmId, children }: { filmId: string; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<"none" | "x" | "y">("none");
  // the live offset: a fast flick can end in the same frame as its last move, before state catches up
  const offset = useRef(0);

  const end = () => {
    const d = offset.current;
    start.current = null;
    axis.current = "none";
    setDragging(false);
    if (Math.abs(d) >= COMMIT_PX) {
      setGone(true); // let the card slide out before the list re-renders without it
      offset.current = 0;
      setDx(d > 0 ? 400 : -400);
      setTimeout(() => setStatus(filmId, d > 0 ? "want" : "skip"), 160);
      return;
    }
    offset.current = 0;
    setDx(0);
  };

  const progress = Math.min(Math.abs(dx) / COMMIT_PX, 1);
  const armed = Math.abs(dx) >= COMMIT_PX;

  return (
    <div className="relative touch-pan-y select-none">
      {dx !== 0 && (
        <div aria-hidden className={`absolute inset-0 flex items-center justify-between rounded-xl px-5 ${dx > 0 ? "bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]" : "bg-[color-mix(in_srgb,currentColor_8%,transparent)]"}`}>
          <span className={`flex items-center gap-1.5 text-[13px] font-medium transition-opacity ${dx > 0 ? "text-accent" : "text-muted"}`} style={{ opacity: progress }}>
            {dx > 0 ? <Bookmark width={18} height={18} /> : <EyeOff width={18} height={18} />}
            {armed && <span>{dx > 0 ? "רוצה לראות" : "לא מעניין"}</span>}
          </span>
        </div>
      )}
      <div
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dragging ? undefined : "transform 160ms ease-out", opacity: gone ? 0 : 1 }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return; // a mouse drags text and selects; leave it alone
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          axis.current = "none";
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || e.pointerId !== s.id) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (axis.current === "none") {
            if (Math.abs(mx) < ENGAGE_PX && Math.abs(my) < ENGAGE_PX) return;
            axis.current = Math.abs(mx) > Math.abs(my) ? "x" : "y";
            if (axis.current === "x") {
              try { e.currentTarget.setPointerCapture(s.id); } catch { /* capture is a nicety, the gesture works without it */ }
              setDragging(true);
            }
          }
          if (axis.current !== "x") return;
          offset.current = mx;
          setDx(mx);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {children}
      </div>
    </div>
  );
}
