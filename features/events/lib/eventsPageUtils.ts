export type EventsPageEvent = {
  id: string;
  name: string;
  location: string;
  coverImageUrl: string | null;
  startTimestamp: string | null;
  publishedAt: string | null;
};

export function bucketEventsForPage(
  rows: EventsPageEvent[],
  now: Date,
  isAdmin: boolean,
): {
  upcoming: EventsPageEvent[];
  drafts: EventsPageEvent[];
  past: EventsPageEvent[];
} {
  const visible = isAdmin ? rows : rows.filter((e) => e.publishedAt != null);

  const upcoming: EventsPageEvent[] = [];
  const drafts: EventsPageEvent[] = [];
  const past: EventsPageEvent[] = [];
  const nowMs = now.getTime();

  for (const e of visible) {
    if (!e.publishedAt) {
      drafts.push(e);
      continue;
    }
    const startMs = e.startTimestamp
      ? new Date(e.startTimestamp).getTime()
      : null;
    if (startMs == null || Number.isNaN(startMs) || startMs > nowMs) {
      upcoming.push(e);
    } else {
      past.push(e);
    }
  }

  const byStartAsc = (a: EventsPageEvent, b: EventsPageEvent) => {
    const ta = a.startTimestamp
      ? new Date(a.startTimestamp).getTime()
      : Number.POSITIVE_INFINITY;
    const tb = b.startTimestamp
      ? new Date(b.startTimestamp).getTime()
      : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a.name.localeCompare(b.name);
  };

  const byStartDesc = (a: EventsPageEvent, b: EventsPageEvent) => {
    const ta = a.startTimestamp
      ? new Date(a.startTimestamp).getTime()
      : Number.NEGATIVE_INFINITY;
    const tb = b.startTimestamp
      ? new Date(b.startTimestamp).getTime()
      : Number.NEGATIVE_INFINITY;
    if (ta !== tb) return tb - ta;
    return a.name.localeCompare(b.name);
  };

  upcoming.sort(byStartAsc);
  past.sort(byStartDesc);
  drafts.sort((a, b) => a.name.localeCompare(b.name));

  return { upcoming, drafts, past };
}
