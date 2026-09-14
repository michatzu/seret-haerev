import Link from "next/link";
import { FilterSentence, type VenueOption } from "./FilterSentence";
import { LocationButton } from "./LocationButton";
import { ListsLink } from "./ListsLink";
import type { Query } from "@/lib/query";
import type { ResolvedPlace } from "@/lib/location";

export function Header({ q, place, venues, genres }: { q: Query; place: ResolvedPlace; venues: VenueOption[]; genres: string[] }) {
  return (
    <header className="border-b border-line bg-header px-4 pb-2.5 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[520px]">
        <div className="flex min-h-[44px] items-center justify-between gap-2">
          <Link href="/" className="font-serif text-[26px] font-bold leading-none text-ink">סרט הערב</Link>
          <div className="flex items-center gap-0.5">
            <ListsLink />
            <LocationButton label={place.label} source={place.source} />
          </div>
        </div>
        <FilterSentence q={q} venues={venues} genres={genres} />
      </div>
    </header>
  );
}
