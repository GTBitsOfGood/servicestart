"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BogIcon from "@/components/bog/BogIcon/BogIcon";
import { ProfileAvatar } from "@/components/navigation/ProfileAvatar";
import authClient from "@/lib/authClient";
import { useActiveOrganization } from "@/lib/hooks/useActiveOrganization";

export function UserProfileMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { organization } = useActiveOrganization();
  const session = authClient.useSession();

  async function handleSignOut() {
    setOpen(false);
    await authClient.signOut();
    router.push("/login");
  }

  const user = session.data?.user;
  const rawRole = (organization?.data as { role?: string } | undefined)?.role;
  const displayName =
    user?.name ?? (user?.email as string | undefined) ?? "User";
  const displayRole = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "Member";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
          open ? "bg-[#FCDAD1]" : "hover:bg-[#FCDAD1]"
        }`}
      >
        <ProfileAvatar size="lg" />
        <div className="flex flex-col items-start gap-0 text-paragraph-2 pr-10">
          <span className="leading-none text-[14px] font-normal text-[#22070B]">
            {displayName}
          </span>
          <span className="leading-none text-[10px] font-normal text-[#22070B]">
            {displayRole}
          </span>
        </div>
        <BogIcon
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color="#22070B"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 flex w-[214px] flex-col items-end rounded border border-[rgba(34,7,11,0.10)] bg-[#F9F9F9] p-1 text-[#22070B] shadow-[0_8px_20px_rgba(0,0,0,0.16)] text-paragraph-2">
          <div className="flex w-full flex-col gap-3 rounded bg-white p-4">
            <button className="text-left font-normal hover:text-[#22070B] text-[14px]">
              Profile
            </button>
            <button className="text-left font-normal hover:text-[#22070B] text-[14px]">
              Settings
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-left font-normal text-[14px] text-[#C73A3A]"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
