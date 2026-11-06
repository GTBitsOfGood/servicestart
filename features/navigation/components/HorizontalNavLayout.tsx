"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { HorizontalNav } from "@/features/navigation/components/HorizontalNav";
import { MobileSidebarNav } from "@/features/navigation/components/MobileSidebarNav";

export function HorizontalNavLayout({
  alignment,
  mobileNav,
  children,
  footer,
}: {
  alignment: ComponentProps<typeof HorizontalNav>["alignment"];
  mobileNav: ComponentProps<typeof MobileSidebarNav>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const desktopRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useLayoutEffect(() => {
    const container = desktopRef.current;
    const header = container?.querySelector("header");
    if (!container || !header) return;

    const measure = () => {
      // A hidden desktop header remains measurable so it can expand again.
      if (!header.clientWidth) return;
      const style = getComputedStyle(header);
      const children = Array.from(header.children) as HTMLElement[];
      const requiredWidth =
        children.reduce(
          (width, child) => width + child.getBoundingClientRect().width,
          0,
        ) +
        parseFloat(style.paddingLeft) +
        parseFloat(style.paddingRight) +
        (parseFloat(style.columnGap) || 0) * (children.length - 1);
      setCollapsed(requiredWidth > header.clientWidth + 1);
    };

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    for (const child of header.children) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [mobileNav.items, alignment]);

  return (
    <div className="flex min-h-screen flex-col bg-app-shell-bg">
      <div className="relative">
        <div
          ref={desktopRef}
          aria-hidden={collapsed || undefined}
          inert={collapsed || undefined}
          className={
            collapsed
              ? "invisible pointer-events-none absolute inset-x-0 top-0 hidden md:block"
              : "hidden md:block"
          }
        >
          <HorizontalNav items={mobileNav.items} alignment={alignment} />
        </div>
        <MobileSidebarNav {...mobileNav} desktopVisible={collapsed} />
      </div>
      <main className="flex flex-1 flex-col overflow-auto">
        <div
          className={
            collapsed
              ? "flex-1 px-6 py-4 pt-20"
              : "flex-1 px-6 py-4 pt-20 md:pt-4"
          }
        >
          {children}
        </div>
        {footer}
      </main>
    </div>
  );
}
