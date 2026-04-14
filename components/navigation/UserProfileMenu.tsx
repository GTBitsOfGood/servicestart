"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function UserProfileMenu({
  direction,
  verticalFlyout = "end",
  hostOpen,
  showChevron = true,
  inlineFooterProfile = false,
}: {
  direction: "horizontal" | "vertical";
  verticalFlyout?: "start" | "end";
  hostOpen?: boolean;
  showChevron?: boolean;
  inlineFooterProfile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [userLabelsMounted, setUserLabelsMounted] = useState(false);
  const router = useRouter();
  const { organization } = useActiveOrganization();
  const session = authClient.useSession();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserLabelsMounted(true);
  }, []);

  useEffect(() => {
    if (hostOpen === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
  }, [hostOpen]);

  async function handleSignOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/login");
  }

  const rawRole = (organization?.data as { role?: string } | undefined)?.role;
  const displayName =
    session.data?.user?.name ??
    (session.data?.user?.email as string | undefined) ??
    "";
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "";

  const flyoutOpensStart =
    direction === "vertical" && verticalFlyout === "start";
  const compactFlyout = direction === "vertical";
  const flyoutLinkClass = cn(
    "text-left font-normal hover:text-grey-text-strong",
    compactFlyout ? "text-lg" : "text-xl",
  );

  const menuIconName =
    direction === "horizontal"
      ? open
        ? "caret-up"
        : "caret-down"
      : flyoutOpensStart
        ? open
          ? "caret-right"
          : "caret-left"
        : open
          ? "caret-left"
          : "caret-right";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full cursor-pointer gap-3 justify-between rounded-md px-3 py-2 text-left transition-colors",
          flyoutOpensStart && "flex-row-reverse",
          inlineFooterProfile ? "flex-nowrap items-center" : "items-start",
          open ? "bg-brand-text/10" : "hover:bg-brand-text/10",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 gap-3 items-center",
            inlineFooterProfile && "flex-row flex-nowrap items-center",
          )}
        >
          <ProfileAvatar
            size="lg"
            className={inlineFooterProfile ? "shrink-0" : undefined}
          />
          {userLabelsMounted && (displayName || displayRole) ? (
            <div className="flex min-w-0 flex-col gap-0">
              <span className="min-w-0 truncate leading-none font-normal text-grey-text-strong">
                {displayName}
              </span>
              <span className="min-w-0 truncate leading-none font-normal text-grey-text-weak">
                {displayRole}
              </span>
            </div>
          ) : null}
          {showChevron ? (
            <BogIcon
              name={menuIconName}
              size={14}
              weight="regular"
              className="shrink-0 text-grey-text-strong"
            />
          ) : null}
        </div>
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 flex flex-col items-stretch rounded border border-grey-stroke-weak bg-solid-bg-sunken p-1 text-grey-text-strong shadow-lg text-small",
            compactFlyout ? "w-max max-w-[min(100%,11rem)]" : "w-[214px]",
            direction === "horizontal" && "right-0 top-full mt-2",
            direction === "vertical" &&
              verticalFlyout === "end" &&
              "bottom-0 left-full",
            direction === "vertical" &&
              verticalFlyout === "start" &&
              "bottom-0 right-full mr-2",
          )}
        >
          <div
            className={cn(
              "flex w-full flex-col rounded bg-solid-bg-base",
              compactFlyout ? "gap-2 px-3 py-2.5" : "gap-3 p-4",
            )}
          >
            <Link href="/profile" className={flyoutLinkClass}>
              Profile
            </Link>
            <Link href="/settings" className={flyoutLinkClass}>
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(
                "cursor-pointer text-left font-normal text-status-red-text",
                compactFlyout ? "text-lg" : "text-xl",
              )}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
