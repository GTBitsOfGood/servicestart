import BogIcon from "../bog/BogIcon/BogIcon";

export default function NotificationCounter({
  unreadCount,
}: {
  unreadCount: number;
}) {
  return (
    <button className="relative cursor-pointer">
      <span className="relative inline-flex">
        <BogIcon name="bell" size={22} className="text-grey-text-strong" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-status-red-text px-1 text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </span>
    </button>
  );
}
