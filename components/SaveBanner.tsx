"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BogBanner from "@/components/bog/BogBanner/BogBanner";

interface SaveBannerProps {
  status: "success" | "error" | null;
  /** Where to go 5 seconds after the banner shows; without it, it stays. */
  redirectTo?: string;
  /** Replaces the generic error text, e.g. with the server's reason. */
  errorMessage?: string;
}

export default function SaveBanner({
  status,
  redirectTo,
  errorMessage,
}: SaveBannerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!status || !redirectTo) return;
    const timer = setTimeout(() => {
      router.replace(redirectTo);
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, redirectTo, router]);

  if (!status) return null;

  return (
    <BogBanner
      type={status === "success" ? "success" : "error"}
      variant="surface"
      highContrast
      content={
        <span>
          {status === "success"
            ? "Changes were saved successfully!"
            : (errorMessage ??
              "Changes were not saved, please try again later.")}
        </span>
      }
      className="mb-6"
    />
  );
}
