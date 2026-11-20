import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="flow-main">
      <div className="narrow center">
        <h1>이 페이지를 찾을 수 없어요.</h1>
        <p className="muted">주소를 다시 확인하거나 처음부터 시작해주세요.</p>
        <Link href="/" className="button primary">
          홈으로
        </Link>
      </div>
    </main>
  );
}
