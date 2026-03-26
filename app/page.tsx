import NotificationsWidget from "@/components/notifications/NotificationsWidget";
import RequestsPanel from "@/components/RequestsPanel";

export const metadata = {
  title: "Dashboard",
};

export default function Page() {
  return (
    <div className="flex h-full min-h-screen">
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-heading-1 font-bold text-grey-text-strong">
            Dashboard
          </h1>
          <NotificationsWidget />
        </div>
        <div className="h-[644px] rounded-lg border-2 border-grey-stroke-weak bg-grey-fill-weaker" />
      </div>
      <RequestsPanel />
    </div>
  );
}
