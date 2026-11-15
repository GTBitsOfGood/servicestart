import serveImage from "@/features/media/api/serveImage";
import { handle } from "hono/netlify";

export const GET = handle(serveImage);
