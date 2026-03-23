export default async function EventsWidget() {
  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-8">
      <h3 className="font-[family-name:var(--font-open-sans)] text-3xl font-semibold text-black">
        Events
      </h3>
      <div className="mt-4 flex flex-1 items-center justify-center text-xl text-grey-text-weak">
        No upcoming events
      </div>
    </div>
  );
}
