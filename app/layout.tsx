import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 휴대폰에서 화면 너비에 맞추고, 주소창 색을 앱 색으로 맞춘다. (PLAN 17번)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "시민단체 찾기", statusBarStyle: "default" },
  title: "우리동네 시민단체 찾기",
  description: "간담회를 열 지역의 시민단체를 출처와 함께 찾아 드립니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
