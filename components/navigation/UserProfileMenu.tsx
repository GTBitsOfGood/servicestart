"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

export function UserProfileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { organization } = useActiveOrganization();
  const session = authClient.useSession();

  useEffect(() => setMounted(true), []);

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
        className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
          open ? "bg-brand-text/10" : "hover:bg-brand-text/10"
        }`}
      >
        <ProfileAvatar size="lg" />
        {mounted && (displayName || displayRole) && (
          <div className="flex flex-col items-start gap-0 text-small pr-10">
            <span className="leading-none font-normal text-grey-text-strong">
              {displayName}
            </span>
            <span className="leading-none text-small font-normal text-grey-text-weak">
              {displayRole}
            </span>
          </div>
        )}
        <BogIcon
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          className="text-grey-text-strong"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 flex w-[214px] flex-col items-end rounded border border-grey-stroke-weak bg-solid-bg-sunken p-1 text-grey-text-strong shadow-lg text-small">
          <div className="flex w-full flex-col gap-3 rounded bg-solid-bg-base p-4">
            <button className="text-left font-normal hover:text-grey-text-strong">
              Profile
            </button>
            <button className="text-left font-normal hover:text-grey-text-strong">
              Settings
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-left font-normal text-status-red-text"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
