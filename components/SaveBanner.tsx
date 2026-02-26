"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import BogBanner from "@/components/bog/BogBanner/BogBanner";

interface SaveBannerProps {
  status: "success" | "error" | null;
}

export default function SaveBanner({ status }: SaveBannerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => {
      router.replace("/profile");
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, router]);

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
            : "Changes were not saved, please try again later."}
        </span>
      }
      className="mb-6"
    />
  );
}
