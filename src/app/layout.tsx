import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar · Life OS",
  description: "一个安静、清晰、可执行的个人操作系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
