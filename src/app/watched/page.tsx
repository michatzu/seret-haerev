import type { Metadata } from "next";
import { WatchedList } from "@/components/WatchedList";

export const metadata: Metadata = { title: "צפיתי" };

export default function WatchedPage() {
  return <WatchedList />;
}
