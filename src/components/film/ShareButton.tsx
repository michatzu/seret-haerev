"use client";

import { useState } from "react";
import { Share } from "../Icons";
import { track } from "@/lib/track";

/**
 * A film is usually chosen with somebody, so its page offers to send it. The phone's own share
 * sheet where there is one (WhatsApp first, for most people here); otherwise the link is copied.
 * The link is the film's plain address: whoever opens it sees screenings near them, not near you.
 */
export function ShareButton({ filmId, title }: { filmId: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${location.origin}/film/${filmId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${title} · סרט הערב`, text: `${title}, איפה ומתי מוקרן`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
      track.share(title);
    } catch {
      // closed the share sheet, or the clipboard was refused: nothing was shared
    }
  }

  return (
    <div className="relative flex items-center">
      {copied && (
        <span role="status" className="absolute end-[52px] whitespace-nowrap rounded-full bg-white/90 px-3 py-1.5 text-[13px] font-medium text-[#101828]">
          הקישור הועתק
        </span>
      )}
      <button type="button" onClick={share} aria-label={`שיתוף: ${title}`} className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-white/15">
        <Share width={20} height={20} />
      </button>
    </div>
  );
}
