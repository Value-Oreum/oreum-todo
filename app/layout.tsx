import type { Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
export const metadata = {
  title: "OREUM WORKs",
  description: "함께 보고, 가볍게 기록하고, 놓치지 않는 업무 현황판",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
