"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageIntro } from "./brand";
import { errorText, post } from "@/lib/api";
export function ParticipationFields({
  nickname,
  onNickname,
  consent,
  onConsent,
  adult,
  onAdult,
}: {
  nickname: string;
  onNickname: (v: string) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
  adult: boolean;
  onAdult: (v: boolean) => void;
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="nickname" className="form-label">
          어떤 이름으로 불러드릴까요?
        </label>
        <input
          id="nickname"
          type="text"
          required
          value={nickname}
          onChange={(e) => onNickname(e.target.value)}
          maxLength={30}
          placeholder="실명 대신 별명을 써도 좋아요"
          autoComplete="off"
        />
        <p className="muted small" style={{ marginTop: 7 }}>
          결과에서 두 사람을 구분하는 이름이에요.
        </p>
      </div>
      <div className="form-note">
        두 사람 모두 답변을 제출하면 서로의 12개 답변 전체가 공개돼요. 제출
        전까지 내 답변은 나에게만 보여요.
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={adult}
          onChange={(e) => onAdult(e.target.checked)}
          required
        />
        <span>만 19세 이상 성인이에요.</span>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          required
        />
        <span>
          <Link href="/terms" target="_blank">
            이용약관
          </Link>
          ·
          <Link href="/privacy" target="_blank">
            개인정보 안내
          </Link>
          를 확인했고, 두 사람 완료 후 답변 비교에 동의해요.
        </span>
      </label>
    </>
  );
}
export function StartForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main id="main" className="flow-main">
      <div className="narrow">
        <PageIntro eyebrow="우리의 첫 번째 질문" title="먼저, 나의 마음부터.">
          정답은 없어요. 평소 나에게 더 편한 쪽을 골라주세요.
          <br />
          회원가입 없이 시작하고, 기본 비교는 무료로 볼 수 있어요.
        </PageIntro>
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const data = await post<{ sessionId: string }>("/sessions", {
                nickname,
                consent,
                adult,
              });
              router.push(`/s/${data.sessionId}/survey`);
            } catch (err) {
              setError(errorText(err));
              setBusy(false);
            }
          }}
        >
          <ParticipationFields
            nickname={nickname}
            onNickname={setNickname}
            consent={consent}
            onConsent={setConsent}
            adult={adult}
            onAdult={setAdult}
          />
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary full"
            style={{ marginTop: 17 }}
            disabled={busy || !nickname.trim() || !consent || !adult}
          >
            {busy ? "준비하고 있어요…" : "12개의 질문 시작하기"}
          </button>
          <p className="small muted center" style={{ marginTop: 17 }}>
            브라우저 데이터를 지우면 다시 접근하기 어려워요.
            <br />
            참여한 브라우저에서 이어서 이용해주세요.
          </p>
        </form>
      </div>
    </main>
  );
}
