export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

export const getSizeFromBreakpoint = (
  breakpoint: string,
): "small" | "medium" | "large" => {
  if (breakpoint === "mobile") return "small";
  if (breakpoint === "tablet") return "medium";
  return "large";
};

export const getNumericalSizeFromBreakpoint = (
  breakpoint: string,
): "1" | "2" | "3" => {
  if (breakpoint === "mobile") return "1";
  if (breakpoint === "tablet") return "2";
  return "3";
};

export const getAltNumericalSizeFromBreakpoint = (
  breakpoint: string,
): "1" | "3" | "5" => {
  if (breakpoint === "mobile") return "1";
  if (breakpoint === "tablet") return "3";
  return "5";
};
