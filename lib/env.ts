/** Validate configuration when the operation that needs it runs. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Set it in .env (see .env.template and README.md) or your deployment environment.`,
    );
  }
  return value;
}

export function getEmailSenderDomain(): string {
  return requireEnv("EMAIL_SENDER_DOMAIN").toLowerCase();
}

/** Resolve the preview branch placeholder without initializing a connection. */
export function getDbUrl(branchName?: string): string {
  const dbUrl = requireEnv("DB_URL");
  branchName ??= process.env.NEXT_PUBLIC_BRANCH_NAME || "main";
  if (branchName.startsWith("pull/") && branchName.endsWith("/head")) {
    branchName = `pr${branchName.slice("pull/".length, -"/head".length)}`;
  }
  return dbUrl.replace("<branch>", branchName);
}
