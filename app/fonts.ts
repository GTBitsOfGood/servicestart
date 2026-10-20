import { Fredoka, Lexend } from "next/font/google";
import localFont from "next/font/local";

const fredoka = Fredoka({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-family-fredoka",
});

const lexend = Lexend({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-family-lexend",
});

const openSans = localFont({
  src: "../public/fonts/opensans-regular-webfont.woff2",
  display: "swap",
  weight: "400",
  style: "normal",
  variable: "--font-family-open-sans",
});

const visby = localFont({
  src: "../public/fonts/visbyextrabold-webfont.woff2",
  display: "swap",
  weight: "400",
  style: "normal",
  variable: "--font-family-visby",
});

export const themeFontVariableClassNames = [
  fredoka.variable,
  lexend.variable,
  openSans.variable,
  visby.variable,
].join(" ");
