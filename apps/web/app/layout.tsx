import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Agent Platform",
  description: "Browser-based Agent Operating Platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
