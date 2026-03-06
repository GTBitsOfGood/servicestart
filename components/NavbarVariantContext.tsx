"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import useOrganizationConfig from "@/lib/hooks/useOrganizationConfig";
import { OrganizationConfigKey } from "@/lib/schema";

export type NavbarVariant =
  | "sunset-vertical-sidebar"
  | "sunset-vertical-icon"
  | "sunset-horizontal-left"
  | "sunset-horizontal-center"
  | "sunset-horizontal-right";

const ALLOWED: NavbarVariant[] = [
  "sunset-vertical-sidebar",
  "sunset-vertical-icon",
  "sunset-horizontal-left",
  "sunset-horizontal-center",
  "sunset-horizontal-right",
];

const DEFAULT_VARIANT: NavbarVariant = "sunset-vertical-sidebar";
const DEFAULT_NAVBAR_COLOR: "red" | "white" = "red";

type ContextValue = {
  variant: NavbarVariant;
  setVariant: (v: NavbarVariant) => void;
  navbarColor: "red" | "white";
};

const NavbarVariantContext = createContext<ContextValue | null>(null);

export function NavbarVariantProvider({ children }: { children: ReactNode }) {
  const { navbar_variant, navbar_color } = useOrganizationConfig([
    OrganizationConfigKey.NavbarVariant,
    OrganizationConfigKey.NavbarColor,
  ]);
  const [override, setOverride] = useState<NavbarVariant | null>(null);

  const variant: NavbarVariant = useMemo(() => {
    if (override) return override;
    if (navbar_variant && ALLOWED.includes(navbar_variant as NavbarVariant)) {
      return navbar_variant as NavbarVariant;
    }
    return DEFAULT_VARIANT;
  }, [override, navbar_variant]);

  const navbarColor: "red" | "white" = useMemo(() => {
    if (navbar_color === "white") return "white";
    return DEFAULT_NAVBAR_COLOR;
  }, [navbar_color]);

  const setVariant = useCallback((v: NavbarVariant) => {
    setOverride(v);
  }, []);

  const value = useMemo(
    () => ({ variant, setVariant, navbarColor }),
    [variant, setVariant, navbarColor],
  );

  return (
    <NavbarVariantContext.Provider value={value}>
      {children}
    </NavbarVariantContext.Provider>
  );
}

export function useNavbarVariant(): ContextValue {
  const ctx = useContext(NavbarVariantContext);
  if (!ctx) {
    return {
      variant: DEFAULT_VARIANT,
      setVariant: () => {},
      navbarColor: DEFAULT_NAVBAR_COLOR,
    };
  }
  return ctx;
}
