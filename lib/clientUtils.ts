export function getBaseUrl() {
  return (
    (process.env.NEXT_PUBLIC_BASE_URL?.includes("main--")
      ? process.env.NEXT_PUBLIC_PROD_URL
      : process.env.NEXT_PUBLIC_BASE_URL) || "http://localhost:3000"
  );
}
