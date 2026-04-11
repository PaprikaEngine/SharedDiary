import type { Metadata } from "next";
import { Noto_Serif_JP, Lora, Zen_Maru_Gothic, Yomogi } from "next/font/google";
import "./globals.css";

const notoSerifJP = Noto_Serif_JP({
  variable: "--font-noto-serif-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-zen-maru-gothic",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const yomogi = Yomogi({
  variable: "--font-yomogi",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "SharedDiary - 交換日記",
  description: "懐かしい交換日記を、もう一度。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSerifJP.variable} ${lora.variable} ${zenMaruGothic.variable} ${yomogi.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">{children}</body>
    </html>
  );
}
