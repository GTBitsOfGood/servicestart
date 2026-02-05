"use client";

import api from "@/lib/api";
import { useEffect } from "react";

// export const metadata = {
//   title: "App Router",
// };

export default function Page() {
  useEffect(() => {
    api.ping.$get().then(async (response) => {
      console.log("Ping response:", await response.text());
    });
  });

  return <h1>App Router</h1>;
}
