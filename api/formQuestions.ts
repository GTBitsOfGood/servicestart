import { Hono } from "hono";

// The question builder's API (#321): GET and PUT /:formId/questions.
// Mounted at /api/forms before api/forms.ts, so that sub-app's admin
// middleware doesn't run here; check auth in this file.
const app = new Hono();

export default app;
