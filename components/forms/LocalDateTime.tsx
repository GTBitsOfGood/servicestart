"use client";

import { useSyncExternalStore } from "react";

const FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "long",
  timeStyle: "short",
};

const subscribe = () => () => {};

/**
 * A date and time in the viewer's time zone. The server, which doesn't know
 * it, renders just the date.
 */
export default function LocalDateTime({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const text = new Date(iso).toLocaleString(
    "en-US",
    isClient ? FORMAT : { dateStyle: "long", timeZone: "UTC" },
  );
  return <time dateTime={iso}>{text}</time>;
}
