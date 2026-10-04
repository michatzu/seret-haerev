"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Pull down to fetch the schedule again.
 *
 * An app added to the home screen has no browser chrome: no address bar, no reload, and no pull
 * to refresh of its own. The schedule it is showing was rendered whenever the page last loaded,
 * which may have been yesterday, and the only way out was to close the app and open it again.
 *
 * The gesture is read by hand rather than with a library because the cards are swiped sideways
 * for the lists, and a drag that is going sideways has to be left alone. Nothing is held in React
 * state while a finger is down — the indicator is moved directly, the way the card swipe is.
 */
const TRIGGER_PX = 72;
const MAX_PX = 110;
/** Below this a drag is still ambiguous; past it, a sideways drag belongs to the card. */
const DECIDE_PX = 8;

export function PullToRefresh() {
  const router = useRouter();
  const arrow = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const el = arrow.current;
    if (!el) return;
    let startY = 0, startX = 0, pulling = false, decided = false, dy = 0;

    const show = (y: number, spinning = false) => {
      el.style.transform = `translate3d(-50%, ${y}px, 0)`;
      el.style.opacity = String(Math.min(1, y / TRIGGER_PX));
      el.dataset.ready = y >= TRIGGER_PX ? "1" : "0";
      el.dataset.spinning = spinning ? "1" : "0";
    };
    const hide = () => {
      el.style.transition = "transform .25s ease, opacity .25s ease";
      show(0);
      window.setTimeout(() => { el.style.transition = ""; }, 260);
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      pulling = true;
      decided = false;
      dy = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const t = e.touches[0];
      dy = t.clientY - startY;
      const dx = t.clientX - startX;
      if (!decided) {
        if (Math.abs(dy) < DECIDE_PX && Math.abs(dx) < DECIDE_PX) return;
        // sideways belongs to the card underneath, and upwards is just scrolling
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0) { pulling = false; return; }
        decided = true;
      }
      if (e.cancelable) e.preventDefault(); // hold the page still so the pull is ours
      show(Math.min(MAX_PX, dy * 0.55));
    };

    const onEnd = () => {
      if (!pulling || !decided) { pulling = false; return; }
      pulling = false;
      if (dy * 0.55 < TRIGGER_PX) return hide();
      busy.current = true;
      show(TRIGGER_PX, true);
      router.refresh();
      // The refresh is a server round trip with no completion event to listen for; a second is
      // both long enough to have happened and short enough not to feel stuck.
      window.setTimeout(() => { busy.current = false; hide(); }, 1000);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  return (
    <div
      ref={arrow}
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-[max(10px,env(safe-area-inset-top))] z-50 flex h-9 w-9 items-center justify-center rounded-full bg-toast text-toast-ink opacity-0 shadow-[0_4px_14px_rgba(16,24,40,0.3)] data-[spinning=1]:animate-spin"
      style={{ transform: "translate3d(-50%, 0, 0)" }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 11a8 8 0 1 0-.6 4" />
        <path d="M20 4v7h-7" />
      </svg>
    </div>
  );
}
