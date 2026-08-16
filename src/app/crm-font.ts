import localFont from "next/font/local";

// CRM-only. Keeping this face in a separate module prevents public marketing
// pages from preloading a family they never use.
export const openSans = localFont({
  variable: "--font-open-sans",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  src: "./fonts/open-sans-latin-variable.woff2",
  weight: "300 800",
  style: "normal",
});
