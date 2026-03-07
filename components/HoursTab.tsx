"use client";

import { useMemo, useState } from "react";
import BogTable, {
  ColumnHeaderCellContent,
  TableRow,
} from "@/components/bog/BogTable/BogTable";
import BogButton from "@/components/bog/BogButton/BogButton";
import BogIcon from "@/components/bog/BogIcon/BogIcon";

interface EventRow {
  id: string;
  name: string;
  location: string;
  startTimestamp: string;
  duration: string;
  eventContact: string;
}

interface HoursTabProps {
  events: EventRow[];
}

function intervalToMinutes(duration: string): number {
  const parts = duration.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1];
  return 0;
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const columnHeaders: ColumnHeaderCellContent[] = [
  { content: "Date", datatype: "string" },
  { content: "Hours", datatype: "number" },
  { content: "Event Name", datatype: "string" },
  { content: "Event Contact", datatype: "string" },
];

export default function HoursTab({ events }: HoursTabProps) {
  const [search, setSearch] = useState("");

  const filteredEvents = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.eventContact.toLowerCase().includes(q) ||
        formatDate(e.startTimestamp).toLowerCase().includes(q),
    );
  }, [events, search]);

  const totalMinutes = useMemo(
    () =>
      filteredEvents.reduce((acc, e) => acc + intervalToMinutes(e.duration), 0),
    [filteredEvents],
  );

  const rows: TableRow[] = filteredEvents.map((event) => ({
    cells: [
      { content: formatDate(event.startTimestamp) },
      { content: formatMinutes(intervalToMinutes(event.duration)) },
      { content: event.name },
      { content: event.eventContact },
    ],
  }));

  const handleExport = () => {
    const header = ["Date", "Hours", "Event Name", "Event Contact"];
    const csvRows = [
      header.join(","),
      ...filteredEvents.map((e) =>
        [
          `"${formatDate(e.startTimestamp)}"`,
          formatMinutes(intervalToMinutes(e.duration)),
          `"${e.name}"`,
          `"${e.eventContact}"`,
        ].join(","),
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "volunteer-hours.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-[30px]">
      <div className="flex items-center justify-between mb-6">
        <p className="text-paragraph-2 font-semibold text-black">
          Total Hours: {formatMinutes(totalMinutes)}
        </p>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 border border-black/20 rounded-md px-4 py-2">
            <input
              type="text"
              placeholder="Enter text to search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-paragraph-2 outline-none bg-transparent w-120 placeholder:text-black/40"
            />
            <BogIcon name="search" size={16} className="text-black/40" />
          </div>

          <BogButton
            variant="primary"
            size="medium"
            onClick={handleExport}
            className="bg-[#FC5B43] flex items-center gap-2"
          >
            <BogIcon name="download" size={16} />
            Export
          </BogButton>
        </div>
      </div>

      <BogTable columnHeaders={columnHeaders} rows={rows} size="responsive" />
    </div>
  );
}
