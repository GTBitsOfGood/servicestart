export default async function NewsletterWidget() {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-8">
      <h3 className="font-[family-name:var(--font-open-sans)] text-3xl font-semibold text-black">
        Newsletter
      </h3>
      <div className="mt-4 flex flex-1 items-center justify-center text-xl text-grey-text-weak">
        No newsletters yet
      </div>
    </div>
  );
}
