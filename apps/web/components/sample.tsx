"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { FreeResult, GuideCard } from "@woorisai/shared";
import { api, errorText, track } from "@/lib/api";
import { PageIntro } from "./brand";
import { ComparisonList, GuideCards } from "./results";
type SampleData = FreeResult & { cards: GuideCard[] };
export function Sample() {
  const [selected, setSelected] = useState(0);
  const [data, setData] = useState<SampleData | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api<SampleData>(`/samples/${selected}`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    track("sample_viewed");
    return () => {
      active = false;
    };
  }, [selected, retry]);
  return (
    <main id="main" className="flow-main">
      <div className="wide-flow">
        <PageIntro
          eyebrow="미리 만나는 우리사이"
          title="두 사람의 답은, 이렇게 만나요."
        >
          가상의 응답으로 만든 결과예요.
          <br />
          선택이 비슷할 때도, 다를 때도 대화할 거리는 있어요.
        </PageIntro>
        <div className="sample-tabs" aria-label="샘플 종류">
          {[
            "차이가 많은 두 사람",
            "같은 방향을 고른 두 사람",
            "일부가 다른 두 사람",
          ].map((label, i) => (
            <button
              key={i}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="sample-note">
          실제 이용자의 답변이나 후기와 무관한 가상 예시입니다. 관계를
          평가하거나 효과를 보장하지 않습니다.
        </p>
        {error ? (
          <div className="error-box" role="alert">
            {error}
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              다시 불러오기
            </button>
          </div>
        ) : !data ? (
          <div className="loading" role="status">
            <span className="spinner" />
            예시를 불러오고 있어요.
          </div>
        ) : (
          <>
            <div className="result-banner">
              <h2>여기까지 모두 무료예요</h2>
              <p>전체 12문항 비교와 두 개의 시작 질문을 제공해요.</p>
            </div>
            <ComparisonList
              items={data.items}
              aName={data.aName}
              bName={data.bName}
            />
            <h2>이 질문으로 시작해보세요</h2>
            {data.freePrompts.map((p) => (
              <div key={p.questionId} className="prompt-card">
                <span>무료 시작 질문</span>
                <p>{p.text}</p>
              </div>
            ))}
            <div className="result-banner" style={{ marginTop: 45 }}>
              <h2>선택 상품 · 우리 둘의 대화 가이드</h2>
              <p>
                커플당 3,900원, 두 사람 함께 열람.
                <br />
                무료 질문 2개를 포함한 총 10개 질문, 예시 5개와 합의 양식 5개를
                제공해요.
              </p>
            </div>
            <p className="sample-note">
              한 카드씩 각자 경험을 말하고, 상대의 말을 확인한 뒤 원하는 약속만
              정해보세요. 아래는 가상의 완성 가이드예요.
            </p>
            <GuideCards cards={data.cards} />
            <div className="center">
              <Link href="/start" className="button primary large">
                우리의 답 알아보기
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
