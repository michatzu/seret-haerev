import { HallRow } from "./HallRow";
import { formatDistance } from "@/lib/geo";
import { hallOrder, hallType } from "@/lib/query";
import type { Screening, Venue } from "@/lib/types";

export function VenueCard({ venue, distanceKm, screenings, film }: { venue: Venue; distanceKm: number; screenings: Screening[]; film: string }) {
  const groups = new Map<string, Screening[]>();
  for (const s of screenings) {
    const k = hallType(s, venue);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
  }
  const rows = [...groups.entries()].sort((a, b) => hallOrder(a[0], b[0]));
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-card p-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-ink">{venue.name}</span>
        <span className="text-[13px] text-muted">{formatDistance(distanceKm)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map(([label, ss]) => (
          <HallRow key={label} label={label} screenings={ss} film={film} venue={venue.name} />
        ))}
      </div>
    </div>
  );
}
