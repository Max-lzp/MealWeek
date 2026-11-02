import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MealWeek · 运动与饮食手记",
  description: "记录每一餐，读懂这一周。浏览器本地保存的个人运动饮食实验。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
