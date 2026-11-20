"use client";
import { useState } from "react";
import {
  TOPICS,
  KIND_LABELS,
  type Comparison,
  type GuideCard,
} from "@woorisai/shared";
import { errorText, put } from "@/lib/api";
export function ComparisonList({
  items,
  aName = "A",
  bName = "B",
}: {
  items: Comparison[];
  aName?: string;
  bName?: string;
}) {
  return (
    <>
      {Object.entries(TOPICS).map(([key, name]) => (
        <section className="comparison-section" key={key}>
          <h2>
            {name}
            <span>서로 편한 방식을 알아봐요</span>
          </h2>
          {items
            .filter((i) => i.topic === key)
            .map((i) => (
              <article className="comparison-card" key={i.questionId}>
                <header>
                  <h3>{i.title}</h3>
                  <span className={`badge ${i.kind.toLowerCase()}`}>
                    {KIND_LABELS[i.kind]}
                  </span>
                </header>
                <div className="comparison-pair">
                  <div className="person-answer">
                    <small>{aName}</small>
                    <p>{i.aLabel}</p>
                  </div>
                  <div className="person-answer b">
                    <small>{bName}</small>
                    <p>{i.bLabel}</p>
                  </div>
                </div>
                <p className="comparison-observation">{i.observation}</p>
              </article>
            ))}
        </section>
      ))}
    </>
  );
}
export function GuideCards({ cards }: { cards: GuideCard[] }) {
  return (
    <>
      {cards.map((c) => (
        <article className="guide-card" key={c.questionId}>
          <span className="eyebrow">{TOPICS[c.topic]}</span>
          <h2>{c.title}</h2>
          <div className="observation">{c.observation}</div>
          <h3>이 순서로 이야기해보세요</h3>
          <ol>
            {c.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <h3>각자에게 물어볼 질문</h3>
          <div className="guide-questions">
            {c.prompts.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <h3>이렇게 시작해볼 수도 있어요 · 가상 예시</h3>
          <p className="guide-example">{c.example}</p>
          <h3>둘 다 원하면, 함께 정해볼 약속</h3>
          <div className="agreement-box">{c.agreement}</div>
        </article>
      ))}
    </>
  );
}
export function Feedback({
  sessionId,
  scope,
}: {
  sessionId: string;
  scope: "FREE" | "PREMIUM";
}) {
  const [used, setUsed] = useState<"YES" | "NOT_YET" | "NO" | null>(null);
  const [helpful, setHelpful] = useState<"YES" | "NO" | null>(null);
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setState("");
    try {
      await put(`/sessions/${sessionId}/feedback`, {
        scope,
        usedForConversation: used,
        helpful: used === "YES" ? helpful : null,
      });
      setState("고마워요. 남겨주신 답은 더 나은 질문을 만드는 데 참고할게요.");
    } catch (e) {
      setState(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feedback-card no-print">
      <h2>
        이 {scope === "FREE" ? "무료 결과" : "대화 가이드"}로 실제 대화를
        해보셨나요?
      </h2>
      <p>선택해서 남겨주세요. 상대에게는 공개되지 않아요.</p>
      <div className="feedback-options">
        {(
          [
            ["YES", "해봤어요"],
            ["NOT_YET", "아직이에요"],
            ["NO", "하지 않았어요"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={used === value}
            onClick={() => {
              setUsed(value);
              setHelpful(null);
              setState("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {used === "YES" && (
        <>
          <p>대화에 도움이 되었나요?</p>
          <div className="feedback-options">
            {(
              [
                ["YES", "도움이 됐어요"],
                ["NO", "아쉬웠어요"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={helpful === value}
                onClick={() => setHelpful(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        className="button secondary"
        disabled={busy || !used || (used === "YES" && !helpful)}
        onClick={save}
      >
        {busy ? "저장 중…" : "의견 남기기"}
      </button>
      {state && (
        <p role="status" className="small" style={{ marginTop: 12 }}>
          {state}
        </p>
      )}
    </section>
  );
}
