import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";
export const metadata = {
  title: "What to do for OREUM",
  description: "함께 보고, 가볍게 기록하고, 놓치지 않는 업무 매트릭스",
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
