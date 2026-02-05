// import ping from "@/lib/ping/ping";
// import { Hono } from "hono";
// import { handle } from "hono/netlify";
// import { PageConfig } from "next/dist/types";

// export const config: PageConfig = {
//   api: {
//     bodyParser: false,
//   },
// };

// const app = new Hono().basePath("/api");

// app.route("/ping", ping).get("/", (c) => {
//   return c.text("API is running");
// });

// export const GET = handle(app);
// export const POST = handle(app);
// export const PUT = handle(app);
// export const DELETE = handle(app);
// export const PATCH = handle(app);

// export type AppType = typeof app;

import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

app.get("/hello", (c) => {
  return c.json({
    message: "Hello Next.js!",
  });
});

export const GET = handle(app);
export const POST = handle(app);
