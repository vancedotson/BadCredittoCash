import type { Metadata } from "next";
import { site } from "@/config/site";
import { PublicPageViewTracker } from "@/components/PublicPageViewTracker";
import { ThemeBeforePaint } from "@/components/ThemeBeforePaint";
import { inter, poppins, sourceSerif, staatliches } from "./fonts";
import "./globals.css";

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
      <head>
        <ThemeBeforePaint />
      </head>
      <body className="min-h-full flex flex-col">
        <PublicPageViewTracker />
        {children}
      </body>
    </html>
  );
}
