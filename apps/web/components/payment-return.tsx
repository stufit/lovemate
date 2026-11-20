"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { OrderView } from "@woorisai/shared";
import { post, errorText } from "@/lib/api";
import { PageIntro } from "./brand";
export function PaymentReturn({ orderId }: { orderId: string }) {
  const [data, setData] = useState<(OrderView & { sessionId: string }) | null>(
    null,
  );
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    post<OrderView & { sessionId: string }>("/payments/confirm", { orderId })
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [orderId, retry]);
  return (
    <main id="main" className="flow-main">
      <div className="narrow">
        <PageIntro
          eyebrow="서버에서 확인하는 구매 상태"
          title={
            data?.status === "PAID"
              ? "대화 가이드가 준비됐어요."
              : "결제 상태를 확인하고 있어요."
          }
        >
          주소에 표시된 성공 여부 대신 서버의 검증 결과를 확인해요.
        </PageIntro>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {data && (
          <div className="panel center">
            <p>
              현재 상태:{" "}
              {
                (
                  {
                    PAID: "완료",
                    PENDING: "확인 중",
                    FAILED: "실패",
                    CANCELED: "취소",
                    REFUNDED: "환불",
                  } as const
                )[data.status]
              }
            </p>
            <Link
              className="button primary"
              style={{ marginTop: 20 }}
              href={`/s/${data.sessionId}/${data.status === "PAID" ? "report" : "checkout"}`}
            >
              {data.status === "PAID" ? "가이드 열기" : "결제 화면으로"}
            </Link>
          </div>
        )}
        <div className="inline-links">
          <button
            className="button outline"
            onClick={() => setRetry((n) => n + 1)}
          >
            상태 다시 확인
          </button>
          <Link href="/support">도움말</Link>
        </div>
      </div>
    </main>
  );
}
