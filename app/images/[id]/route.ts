import serveImage from "@/core/files/api/serveImage";
import { handle } from "hono/netlify";

export const GET = handle(serveImage);
