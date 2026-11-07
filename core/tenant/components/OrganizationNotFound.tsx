"use client";

/**
 * Deliberately unbranded: a missing organization has no branding, and rendering
 * placeholder colors is the failure this fixes. No sign-in form either — if
 * there is a box, people type in it, and they are back at the dead end.
 */
export default function OrganizationNotFound({
  host: requestedHost,
  protocol: requestedProtocol,
}: { host?: string; protocol?: "http:" | "https:" } = {}) {
  const host =
    requestedHost ??
    (typeof window === "undefined" ? "" : window.location.host);
  const protocol =
    requestedProtocol ??
    (typeof window === "undefined" ? "https:" : window.location.protocol);
  // `acme.servicestart.com` -> `servicestart.com`. Avoids a config value;
  // NEXT_PUBLIC_BASE_URL points at a single tenant and is unusable here.
  const parentDomain = host.split(".").slice(1).join(".");

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center"
      data-testid="organization-not-found"
    >
      <h1 className="text-grey-text-strong">
        There&rsquo;s no nonprofit at <span className="break-all">{host}</span>.
      </h1>
      <p className="text-desktop-paragraph-1 text-grey-text-weak">
        Check the spelling, or ask whoever sent you the link.
      </p>
      {parentDomain && (
        <a
          className="text-desktop-paragraph-2 font-bold text-grey-text-strong underline"
          href={`${protocol}//${parentDomain}`}
        >
          Go to ServiceStart &rarr;
        </a>
      )}
    </div>
  );
}
