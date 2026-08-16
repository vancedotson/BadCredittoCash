import localFont from "next/font/local";

// Keep the brand typography inside the app. Using local subsets makes builds
// deterministic and prevents a blocked Google Fonts request from silently
// replacing every face with Arial or Times New Roman.
export const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  src: [
    { path: "./fonts/poppins-latin-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700.woff2", weight: "700", style: "normal" },
  ],
});

export const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
  src: "./fonts/inter-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
});

export const sourceSerif = localFont({
  variable: "--font-source-serif",
  display: "swap",
  fallback: ["Georgia", "serif"],
  src: [
    {
      path: "./fonts/source-serif-4-latin-variable.woff2",
      weight: "200 900",
      style: "normal",
    },
    {
      path: "./fonts/source-serif-4-latin-variable-italic.woff2",
      weight: "200 900",
      style: "italic",
    },
  ],
});

export const staatliches = localFont({
  variable: "--font-staatliches",
  display: "swap",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
  src: "./fonts/staatliches-latin-400.woff2",
  weight: "400",
  style: "normal",
});
