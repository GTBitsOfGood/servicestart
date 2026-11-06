// The membership context's React components and widgets, for other contexts:
// import them from "@/features/membership/ui". They're kept out of index.ts, which
// also has to load outside the bundler (seed scripts, Playwright), where their
// CSS imports fail.

export { default as MemberRequestsWidget } from "./widgets/MemberRequestsWidget";
