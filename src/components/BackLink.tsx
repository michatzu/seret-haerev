"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Back, meaning back — not a second trip to the list.
 *
 * Following a link to the list pushes a new entry and lands at the top of it, which is a long way
 * from where you were reading. Going back through history instead returns the browser to the exact
 * place it left, scroll and open groups and all. On the home screen there is no browser chrome to
 * do this with, so this chevron is the only way, and it has to be the real thing.
 *
 * It stays an anchor underneath: a film page reached from a shared link has nothing behind it, and
 * then the href is the way home.
 */
export function BackLink({ href, children, ...rest }: { href: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const router = useRouter();
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const nav = (window as { navigation?: { canGoBack?: boolean } }).navigation;
        const canGoBack = nav?.canGoBack ?? window.history.length > 1;
        if (!canGoBack) return;
        e.preventDefault();
        router.back();
      }}
    >
      {children}
    </a>
  );
}
