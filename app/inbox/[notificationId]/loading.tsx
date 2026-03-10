export default function NotificationDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="mb-6 h-5 w-44 rounded bg-grey-fill-weak" />
      <div className="rounded-xl border border-grey-stroke-weak p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="h-8 w-36 rounded-full bg-grey-fill-weak" />
          <div className="h-5 w-52 rounded bg-grey-fill-weak" />
        </div>
        <div className="space-y-3">
          <div className="h-5 w-full rounded bg-grey-fill-weak" />
          <div className="h-5 w-full rounded bg-grey-fill-weak" />
          <div className="h-5 w-3/4 rounded bg-grey-fill-weak" />
        </div>
      </div>
    </div>
  );
}
