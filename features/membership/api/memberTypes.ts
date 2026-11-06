import { Hono } from "hono";

// An organization's member types (#336): list, create, update, reorder,
// delete, and set the signup default, at /api/memberTypes. Admin only, and
// 404 while MemberTypesEnabled is off. Mounted in features/app.ts already;
// add routes here.
const app = new Hono();

export default app;
