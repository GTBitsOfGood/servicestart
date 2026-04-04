import serveImage from "@/api/serveImage";
import { handle } from "hono/netlify";

export const GET = handle(serveImage);
