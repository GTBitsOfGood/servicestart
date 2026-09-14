export default function OrganizationNotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-grey-text-strong">Organization not found</h1>
      <p className="text-desktop-paragraph-1 text-grey-text-weak">
        Check the spelling of your organization&rsquo;s address, or ask whoever
        sent you the link.
      </p>
    </main>
  );
}
