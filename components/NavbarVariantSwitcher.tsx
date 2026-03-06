"use client";

import { useNavbarVariant } from "@/components/NavbarVariantContext";

const VARIANTS = [
  { value: "sunset-vertical-sidebar", label: "Vertical Sidebar" },
  { value: "sunset-vertical-icon", label: "Vertical Icons" },
  { value: "sunset-horizontal-left", label: "Horizontal (Tabs Left)" },
  { value: "sunset-horizontal-center", label: "Horizontal (Tabs Center)" },
  { value: "sunset-horizontal-right", label: "Horizontal (Tabs Right)" },
] as const;

export function NavbarVariantSwitcher() {
  const { variant, setVariant } = useNavbarVariant();

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="navbar-variant"
        className="text-sm font-medium text-[#22070B]"
      >
        Navbar variant (testing)
      </label>
      <select
        id="navbar-variant"
        value={variant}
        onChange={(e) =>
          setVariant(e.target.value as (typeof VARIANTS)[number]["value"])
        }
        className="max-w-xs rounded border border-[#22070B]/20 bg-white px-3 py-2 text-[14px] text-[#22070B] focus:outline-none focus:ring-2 focus:ring-[#FC5B43]/40"
      >
        {VARIANTS.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}
