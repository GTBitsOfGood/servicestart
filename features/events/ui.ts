// The events context's React components and widgets, for other contexts:
// import them from "@/features/events/ui". They're kept out of index.ts, which
// also has to load outside the bundler (seed scripts, Playwright), where their
// CSS imports fail.

export { default as EventsWidget } from "./widgets/EventsWidget";
export { default as WeeklyCalendarWidget } from "./widgets/WeeklyCalendarWidget";
