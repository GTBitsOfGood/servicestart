import { breakpoints } from "..//breakpoints/breakpoints";
import { useWindowSize } from "react-use";

function getBreakpoint(width: number) {
  const entries = Object.entries(breakpoints).reverse();
  for (const [label, minWidth] of entries) {
    if (width >= minWidth) {
      return label;
    }
  }
  return entries[0][0];
}

export function useResponsive() {
  const { width } = useWindowSize();
  return getBreakpoint(width);
}
