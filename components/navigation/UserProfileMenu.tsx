"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";
import Link from "next/link";

export function UserProfileMenu({
  direction,
  verticalFlyout = "end",
  hostOpen,
  showChevron = true,
  avatarLayout = "horizontal",
}: {
  direction: "horizontal" | "vertical";
  verticalFlyout?: "start" | "end";
  hostOpen?: boolean;
  showChevron?: boolean;
  /** Stacked avatar above name, or avatar left of name (design variants). */
  avatarLayout?: "vertical" | "horizontal";
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { organization } = useActiveOrganization();
  const session = authClient.useSession();

  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (hostOpen === false) {
      setOpen(false);
    }
  }, [hostOpen]);

  async function handleSignOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/login");
  }

  const user = session.data?.user;
  const rawRole = (organization?.data as { role?: string } | undefined)?.role;
  const displayName = user?.name ?? (user?.email as string | undefined) ?? "";
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`cursor-pointer flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors ${
          open ? "bg-brand-text/10" : "hover:bg-brand-text/10"
        }`}
      >
        {avatarLayout === "vertical" ? (
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            <ProfileAvatar size="lg" />
            {mounted && (displayName || displayRole) && (
              <div className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="min-w-0 truncate text-paragraph-1 font-semibold text-grey-text-strong">
                  {displayName}
                </span>
                <span className="min-w-0 truncate text-paragraph-2 text-grey-text-weak">
                  {displayRole}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <ProfileAvatar size="lg" />
            {mounted && (displayName || displayRole) && (
              <div className="flex min-w-0 flex-col items-start gap-0">
                <span className="min-w-0 truncate leading-none font-normal text-grey-text-strong">
                  {displayName}
                </span>
                <span className="min-w-0 truncate leading-none font-normal text-grey-text-weak">
                  {displayRole}
                </span>
              </div>
            )}
          </div>
        )}
        {showChevron ? (
          <BogIcon
            name={
              open
                ? direction == "horizontal"
                  ? "chevron-up"
                  : "chevron-left"
                : direction == "horizontal"
                  ? "chevron-down"
                  : "chevron-right"
            }
            size={14}
            className="text-grey-text-strong"
          />
        ) : null}
      </button>

      {open && (
        <div
          className={`absolute z-50 ${
            direction === "horizontal"
              ? "right-0 top-full"
              : verticalFlyout === "end"
                ? "left-full bottom-0"
                : "right-full bottom-0"
          } mt-2 flex w-[214px] flex-col items-end rounded border border-grey-stroke-weak bg-solid-bg-sunken p-1 text-grey-text-strong 
                      shadow-lg text-small ${direction === "vertical" && verticalFlyout === "start" ? "mr-2" : ""}`}
        >
          <div className="flex w-full flex-col gap-3 rounded bg-solid-bg-base p-4">
            <Link
              href="/profile"
              className="text-left text-xl font-normal hover:text-grey-text-strong"
            >
              Profile
            </Link>
            <Link
              href="/settings"
              className="text-left text-xl font-normal hover:text-grey-text-strong"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="cursor-pointer text-left text-xl font-normal text-status-red-text"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
