import Link from "next/link";
import { FilterSentence } from "./FilterSentence";
import { LocationButton } from "./LocationButton";
import type { Query } from "@/lib/query";
import type { ResolvedPlace } from "@/lib/location";

export function Header({ q, place }: { q: Query; place: ResolvedPlace }) {
  return (
    <header className="border-b border-line bg-header px-4 pb-2.5 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[520px]">
        <div className="flex min-h-[44px] items-center justify-between">
          <Link href="/" className="font-serif text-[26px] font-bold leading-none text-ink">סרט הערב</Link>
          <LocationButton label={place.label} source={place.source} />
        </div>
        <FilterSentence q={q} />
      </div>
    </header>
  );
}
