"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { setStatus } from "@/lib/filmLists";

const COMMIT_PX = 78; // past this the gesture counts
const ENGAGE_PX = 10; // below this it might still be a scroll
const RUBBER = 0.55; // resistance once the card is already past the commit point
const SETTLE_MS = 190;

/**
 * Drag a card sideways to file it: right for "want to see", left for "not interested". Directions
 * are physical, not reading order, so they mean the same thing on a Hebrew page.
 *
 * The card is moved by writing to its style inside a single animation frame rather than through
 * React state: a re-render per pointermove makes a list of eighty cards stutter. React is only
 * involved once, at the end, when the film actually changes list.
 */
export function SwipeToFile({ filmId, children }: { filmId: string; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const g = useRef({ id: -1, x: 0, y: 0, axis: "none" as "none" | "x" | "y", dx: 0, swiped: false });

  const paint = useCallback(() => {
    frame.current = 0;
    const { dx } = g.current;
    const el = card.current;
    if (el) el.style.transform = dx ? `translate3d(${dx}px,0,0)` : "";
    const progress = Math.min(Math.abs(dx) / COMMIT_PX, 1);
    const armed = Math.abs(dx) >= COMMIT_PX;
    const show = (node: HTMLDivElement | null, on: boolean) => {
      if (!node) return;
      node.style.opacity = on ? String(0.25 + 0.75 * progress) : "0";
      node.dataset.armed = on && armed ? "1" : "0";
    };
    show(right.current, dx > 0);
    show(left.current, dx < 0);
  }, []);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  }, [paint]);

  /** Distance the card actually moves: it follows the finger, then resists past the commit point. */
  const damp = (raw: number) => {
    const over = Math.abs(raw) - COMMIT_PX;
    if (over <= 0) return raw;
    return Math.sign(raw) * (COMMIT_PX + over * RUBBER);
  };

  const settle = useCallback((to: number, then?: () => void) => {
    const el = card.current;
    if (!el) return then?.();
    el.style.transition = `transform ${SETTLE_MS}ms cubic-bezier(.22,.61,.36,1)`;
    g.current.dx = to;
    schedule();
    window.setTimeout(() => {
      el.style.transition = "";
      then?.();
    }, SETTLE_MS);
  }, [schedule]);

  const finish = useCallback(() => {
    const { dx, axis } = g.current;
    g.current.id = -1;
    g.current.axis = "none";
    if (axis !== "x") return;
    if (Math.abs(dx) >= COMMIT_PX) {
      const status = dx > 0 ? "want" : "skip";
      settle(dx > 0 ? window.innerWidth : -window.innerWidth, () => {
        g.current.dx = 0;
        setStatus(filmId, status); // the card is hidden by the list stylesheet from here on
      });
      return;
    }
    settle(0, () => { g.current.dx = 0; schedule(); });
  }, [filmId, settle, schedule]);

  return (
    <div className="relative">
      {/* hints sit behind the card and never move, so there is nothing to lay out mid-gesture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-between overflow-hidden rounded-xl px-5">
        <div ref={left} style={{ opacity: 0 }} className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-none data-[armed=1]:text-ink">
          <EyeOffGlyph />
          <span>לא מעניין</span>
        </div>
        <div ref={right} style={{ opacity: 0 }} className="flex items-center gap-1.5 text-[13px] font-medium text-accent">
          <BookmarkGlyph />
          <span>רוצה לראות</span>
        </div>
      </div>

      <div
        ref={card}
        className="relative touch-pan-y"
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" || g.current.id !== -1) return;
          g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: "none", dx: 0, swiped: false };
          if (card.current) card.current.style.transition = "";
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (s.id !== e.pointerId) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (s.axis === "none") {
            if (Math.abs(mx) < ENGAGE_PX && Math.abs(my) < ENGAGE_PX) return;
            // a gesture that started vertically belongs to the scroller, and never comes back
            s.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
            if (s.axis === "x") {
              s.swiped = true;
              try { e.currentTarget.setPointerCapture(s.id); } catch { /* capture is a nicety */ }
            }
          }
          if (s.axis !== "x") return;
          s.dx = damp(mx);
          schedule();
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          // the release of a swipe must not also open the film
          if (!g.current.swiped) return;
          g.current.swiped = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </div>
  );
}

const BookmarkGlyph = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z" /></svg>
);
const EyeOffGlyph = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M3 3l18 18M10.6 6.1A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.3 3.9M6.5 8.1A16 16 0 0 0 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8" />
    <path d="M9.9 9.9a3.2 3.2 0 0 0 4.3 4.3" />
  </svg>
);
