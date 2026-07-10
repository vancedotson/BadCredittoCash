import type { Metadata } from "next";
import { Poppins, Inter, Source_Serif_4, Staatliches } from "next/font/google";
import { site } from "@/config/site";
import "./globals.css";

// Headlines — Poppins (SemiBold/Bold). Body — Inter. Quotes — Source Serif 4.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["600", "700"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

// Display face for the hero headline (Brian LaRossa, Erica Carras) — caps only.
const staatliches = Staatliches({
  variable: "--font-staatliches",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: site.seo.title,
    template: `%s — ${site.name}`,
  },
  description: site.seo.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${inter.variable} ${sourceSerif.variable} ${staatliches.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          // Set the theme before paint to avoid a flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
