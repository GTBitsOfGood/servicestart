type JunoNumericIdObject = {
  low: unknown;
};

export function parseJunoNumericId(rawId: unknown): number {
  if (typeof rawId === "number") return rawId;
  if (typeof rawId === "string") return Number(rawId);
  if (rawId && typeof rawId === "object" && "low" in rawId) {
    return Number((rawId as JunoNumericIdObject).low);
  }
  return Number.NaN;
}

export function buildAzureBlobBaseUrl(accountName: string): string {
  return `https://${accountName}.blob.core.windows.net`;
}
