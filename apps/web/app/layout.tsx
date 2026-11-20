import type { Metadata } from "next";
import { Header, Footer } from "@/components/brand";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "우리사이 연구소 | 서로를 알아가는 12개의 질문",
    template: "%s | 우리사이 연구소",
  },
  description:
    "같은 질문에 답하고 서로 편한 방식을 발견해보세요. 두 사람의 답변 비교는 무료, 대화 가이드는 선택이에요.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          본문으로 건너뛰기
        </a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
