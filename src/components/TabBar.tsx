"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film as FilmIcon, ListIcon } from "./Icons";
import { idsWith, useFilmLists } from "@/lib/filmLists";

/**
 * Two destinations, so they belong at the thumb rather than squeezed into the top bar beside the
 * location, which is a filter and not a place to go.
 */
export function TabBar() {
  const path = usePathname();
  const { store, ready } = useFilmLists();
  const saved = idsWith(store, "want").length;
  if (path.startsWith("/film/")) return null; // a film page is a detail view, not a tab

  const tabs = [
    { href: "/", label: "הסרטים", Icon: FilmIcon, on: path === "/", count: 0 },
    { href: "/lists", label: "הרשימות שלי", Icon: ListIcon, on: path.startsWith("/lists"), count: saved },
  ];

  return (
    <nav aria-label="ניווט ראשי" className="sticky bottom-0 z-30 mt-auto border-t border-line bg-header pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5">
      <div className="mx-auto flex max-w-[520px]">
        {tabs.map(({ href, label, Icon, on, count }) => (
          <Link key={href} href={href} aria-current={on ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${on ? "text-accent" : "text-muted"}`}>
            <span className="relative">
              <Icon width={21} height={21} />
              {ready && count > 0 && (
                <span className="absolute -end-2 -top-1 min-w-[15px] rounded-full bg-accent px-1 text-[10px] font-semibold leading-[15px] text-accent-ink">{count}</span>
              )}
            </span>
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
