"use client";

import { useSyncExternalStore } from "react";

export type LocalDateTimeFormat = "long" | "monthDay";

const FORMATS: Record<
  LocalDateTimeFormat,
  { client: Intl.DateTimeFormatOptions; server: Intl.DateTimeFormatOptions }
> = {
  long: {
    client: { dateStyle: "long", timeStyle: "short" },
    server: { dateStyle: "long", timeZone: "UTC" },
  },
  monthDay: {
    client: { month: "2-digit", day: "2-digit" },
    server: { month: "2-digit", day: "2-digit", timeZone: "UTC" },
  },
};

const subscribe = () => () => {};

/**
 * A date and time in the viewer's time zone. The server, which doesn't know
 * it, renders just the date.
 */
export default function LocalDateTime({
  iso,
  format = "long",
}: {
  iso: string;
  format?: LocalDateTimeFormat;
}) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const options = FORMATS[format];
  const text = new Date(iso).toLocaleString(
    "en-US",
    isClient ? options.client : options.server,
  );
  return <time dateTime={iso}>{text}</time>;
}
