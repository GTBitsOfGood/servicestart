/**
 * This deployment's base URL. Main branch deploys use the production URL;
 * local development falls back to localhost.
 */
export function getBaseUrl() {
  return (
    (process.env.NEXT_PUBLIC_BASE_URL?.includes("main--")
      ? process.env.NEXT_PUBLIC_PROD_URL
      : process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000"
  );
}
