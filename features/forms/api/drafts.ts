import { Hono } from "hono";

// A member's saved answers for a form (#338): GET, PUT, and DELETE
// /api/forms/:formId/draft. Mounted at /api/forms before forms.ts (in
// features/app.ts already), so that sub-app's admin middleware doesn't run
// here. Add routes here.
const app = new Hono();

export default app;
