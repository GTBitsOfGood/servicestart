"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BogBanner from "@/components/bog/BogBanner/BogBanner";

interface SaveBannerProps {
  status: "success" | "error" | "unsaved" | null;
  /** Existing profile saves return to the profile; settings can opt out. */
  redirectPath?: string | null;
}

export default function SaveBanner({
  status,
  redirectPath = "/profile",
}: SaveBannerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!status || status === "unsaved" || !redirectPath) return;
    const timer = setTimeout(() => {
      router.replace(redirectPath);
    }, 5000);
    return () => clearTimeout(timer);
  }, [redirectPath, status, router]);

  if (!status) return null;

  return (
    <BogBanner
      type={
        status === "success"
          ? "success"
          : status === "unsaved"
            ? "warning"
            : "error"
      }
      variant="surface"
      highContrast
      content={
        <span>
          {status === "success"
            ? "Changes were saved successfully!"
            : status === "unsaved"
              ? "You have unsaved changes."
              : "Changes were not saved, please try again later."}
        </span>
      }
      className="mb-6"
    />
  );
}
