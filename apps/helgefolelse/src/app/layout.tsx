import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "wdth"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "helgefølelse — levende tidevann gjennom arbeidsuken",
  description:
    "Hvor dypt står du i helgen? Et levende tidevann gjennom arbeidsuken. How deep are you standing in the weekend? A live tide through the working week.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" className={`${bricolage.variable} ${jetbrainsMono.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
