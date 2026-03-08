"use client";

import { useState } from "react";
import SendEmailModal from "@/components/SendEmailModal";

export default function Page() {
  const [open, setOpen] = useState(true);

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">App Router</h1>
      <SendEmailModal
        isOpen={open}
        onClose={() => setOpen(false)}
        recipients={[
          { id: "user-1", name: "Alex Johnson" },
          { id: "user-2", name: "Sam Lee" },
          { id: "user-3", name: "Priya Patel" },
        ]}
        initialRecipientIds={["user-1", "user-3"]}
      />
    </div>
  );
}
