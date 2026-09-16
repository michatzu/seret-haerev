import type { Metadata, Viewport } from "next";
import { ListStyles } from "@/components/ListStyles";
import { UndoBar } from "@/components/UndoBar";
import { TabBar } from "@/components/TabBar";
import { Analytics } from "@vercel/analytics/next";
import { Tracking } from "@/components/Tracking";
import { Frank_Ruhl_Libre, IBM_Plex_Sans_Hebrew } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans_Hebrew({
  variable: "--font-plex",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const frank = Frank_Ruhl_Libre({
  variable: "--font-frank",
  subsets: ["hebrew", "latin"],
  weight: ["500", "700"],
  display: "swap",
});

const TITLE = "סרט הערב";
const DESCRIPTION = "מה מוקרן לידך היום, בכל בתי הקולנוע בישראל, במקום אחד.";

/**
 * Every share preview needs an absolute address for the image, and a relative one silently
 * becomes localhost. Vercel hands us the production domain; a domain of our own would go in
 * NEXT_PUBLIC_SITE_URL and win.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  applicationName: TITLE,
  // So "add to home screen" opens without browser chrome, under the right name.
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: "black-translucent" },
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: "he_IL",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171b22" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${plex.variable} ${frank.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <ListStyles />
        {children}
        <TabBar />
        <UndoBar />
        <Tracking />
        <Analytics />
      </body>
    </html>
  );
}
