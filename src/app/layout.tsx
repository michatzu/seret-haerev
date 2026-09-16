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

export const metadata: Metadata = {
  title: { default: "סרט הערב", template: "%s · סרט הערב" },
  description: "מה מוקרן לידך היום, בכל בתי הקולנוע בישראל, במקום אחד.",
  applicationName: "סרט הערב",
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
