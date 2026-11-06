// The navigation context's React components and widgets, for other contexts:
// import them from "@/features/navigation/ui". They're kept out of index.ts, which
// also has to load outside the bundler (seed scripts, Playwright), where their
// CSS imports fail.

export { default as OrganizationLogo } from "./components/OrganizationLogo";
