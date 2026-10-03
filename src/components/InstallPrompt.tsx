"use client";

import { useState, useSyncExternalStore } from "react";
import { Close, ShareIos } from "./Icons";
import { Mark } from "./Mark";
import { acceptOffer, alreadyInstalled, dismiss, dismissed, hasOffer, isIos, subscribeInstall } from "@/lib/install";

/**
 * The offer to put the site on a home screen, made where it pays off.
 *
 * Somebody keeping lists is exactly the person for whom an icon is worth having, which is why
 * this lives here and not on the schedule — and why it is a card in the page rather than
 * something that covers it. It is shown once; closing it is remembered.
 */
export function InstallPrompt() {
  const offered = useSyncExternalStore(subscribeInstall, hasOffer, () => false);
  const [gone, setGone] = useState(false);
  const hidden = useSyncExternalStore(subscribeInstall, () => dismissed() || alreadyInstalled(), () => true);
  const ios = useSyncExternalStore(subscribeInstall, isIos, () => false);

  if (gone || hidden || (!offered && !ios)) return null;

  const close = () => { setGone(true); dismiss(); };

  return (
    <section className="mt-4 flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3.5 text-[13px] leading-[1.6] text-muted">
      <Mark size={34} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="font-medium text-ink">להוסיף את סרט הערב למסך הבית</div>
        {offered ? (
          <>
            <div>כך הרשימות נפתחות בלחיצה אחת, כמו אפליקציה.</div>
            <button type="button" onClick={() => void acceptOffer()} className="mt-0.5 h-9 self-start rounded-lg border border-accent px-4 font-medium text-accent">
              הוספה
            </button>
          </>
        ) : (
          <div>
            בספארי לוחצים על כפתור השיתוף <ShareIos width={14} height={14} className="inline-block align-[-2px] text-ink" /> שבתחתית המסך, ואז על ״הוספה למסך הבית״. כך הרשימות נפתחות בלחיצה אחת, כמו אפליקציה.
          </div>
        )}
      </div>
      <button type="button" onClick={close} aria-label="סגירה" className="-me-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted">
        <Close width={16} height={16} />
      </button>
    </section>
  );
}
