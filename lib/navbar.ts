import type { IconName } from "@/components/bog/BogIcon/BogIcon";

export type Subpage = {
  label: string;
  href: string;
};

export type NavbarItem = {
  label: string;
  href: string;
  icon: IconName;
  subpages?: Subpage[];
};

export const NAVBAR_ITEMS: NavbarItem[] = [
  { label: "Home", href: "/", icon: "house" },
  {
    label: "Menu Item",
    href: "/menu-parent",
    icon: "chats",
    subpages: [
      { label: "Subpage", href: "/subpage-1" },
      { label: "Subpage", href: "/subpage-2" },
    ],
  },
  { label: "Menu Item", href: "/menu-2", icon: "calendar" },
];
