import Link from "next/link";
import type { ReactNode } from "react";
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="35"
      height="35"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22 9C14 2 3 8 5 18c1 6 7 10 15 17 8-7 14-11 15-17C37 8 26 2 18 9"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M15 17c3-4 7-4 10 0m-9 8c3 2 5 2 8 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="우리사이 연구소 홈">
          <BrandMark />
          <span>
            우리사이 연구소<span className="brand-en">WOORISAI LAB</span>
          </span>
        </Link>
        <nav aria-label="주 메뉴">
          <Link href="/sample">결과 미리보기</Link>
          <Link href="/#how" className="desktop-link">
            이용 방법
          </Link>
          <Link href="/start" className="nav-start">
            무료로 시작
          </Link>
        </nav>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link className="brand" href="/">
            <BrandMark />
            <span>우리사이 연구소</span>
          </Link>
          <p>다른 마음을, 함께 알아가는 시간.</p>
        </div>
        <div className="footer-links">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/refund">취소·환불 안내</Link>
          <Link href="/support">도움말</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <p>
          설문 응답에 기반한 대화 참고 콘텐츠입니다. 전문 심리검사·상담·미래
          예측을 제공하지 않습니다.
        </p>
        <span>© 2026 Woorisai Lab</span>
      </div>
    </footer>
  );
}
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
