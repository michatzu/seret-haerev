import type { Metadata } from "next";
import { ListsView } from "@/components/ListsView";

export const metadata: Metadata = { title: "הרשימות שלי" };

export default function ListsPage() {
  return <ListsView />;
}
