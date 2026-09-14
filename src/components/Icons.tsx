import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

export const Caret = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
);
export const ChevronBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ChevronForward = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 6l6 6-6 6" /></svg>
);
export const Pin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
);
export const Check = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12l5 5L20 7" /></svg>
);
export const Close = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Play = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M8 5.5v13l10-6.5z" /></svg>
);
export const Share = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.9l7.6-4.4M8.2 13.1l7.6 4.4" /></svg>
);
export const Film = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>
);
export const Locate = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></svg>
);

export const Eye = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3.2" /></svg>
);

export const EyeOff = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 3l18 18M10.6 6.1A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.3 3.9M6.5 8.1A16 16 0 0 0 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8" /><path d="M9.9 9.9a3.2 3.2 0 0 0 4.3 4.3" /></svg>
);
export const Bookmark = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z" /></svg>
);
export const BookmarkFilled = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z" /></svg>
);
