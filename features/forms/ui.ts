// The forms context's React components and widgets, for other contexts:
// import them from "@/features/forms/ui". They're kept out of index.ts, which
// also has to load outside the bundler (seed scripts, Playwright), where their
// CSS imports fail.

export { default as ApplicationStatusWidget } from "./widgets/ApplicationStatusWidget";
export { default as FormsCompletedWidget } from "./widgets/FormsCompletedWidget";
export { default as FormsProgressWidget } from "./widgets/FormsProgressWidget";
export { default as FormsTodoWidget } from "./widgets/FormsTodoWidget";
