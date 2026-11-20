"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2, Printer, Heart } from "lucide-react";
import {
  QUESTIONS,
  TOPICS,
  VERSION,
  answerLabel,
  type Answer,
  type Answers,
  type SessionView,
  type FreeResult,
  type PremiumReport,
  type OrderView,
  type GuideCard,
} from "@woorisai/shared";
import { api, post, put, errorText, track } from "@/lib/api";
import { PageIntro } from "./brand";
import { ParticipationFields } from "./start-form";
import { ComparisonList, GuideCards, Feedback } from "./results";

export function SessionFlow({
  sessionId: id,
  screen,
  invite,
}: {
  sessionId: string;
  screen: string;
  invite?: string;
}) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (screen === "join") return;
    let alive = true;
    setError("");
    setSession(null);
    api<SessionView>(`/sessions/${id}`)
      .then((d) => {
        if (alive) setSession(d);
      })
      .catch((e) => {
        if (alive) setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [id, screen, retry]);
  if (screen === "join") return <Join id={id} invite={invite ?? ""} />;
  return (
    <main id="main" className="flow-main">
      <div
        className={
          screen === "result" || screen === "report" ? "wide-flow" : "narrow"
        }
      >
        {error ? (
          <>
            <PageIntro eyebrow="참여 기록 확인" title="잠시 확인이 필요해요." />
            <div className="error-box" role="alert">
              {error}
            </div>
            <div className="inline-links">
              <button
                className="button secondary"
                onClick={() => setRetry((n) => n + 1)}
              >
                다시 확인하기
              </button>
              <Link href="/start">새로 시작하기</Link>
            </div>
          </>
        ) : !session ? (
          <Loading />
        ) : screen === "survey" ? (
          <Survey session={session} />
        ) : screen === "my-result" ? (
          <Personal session={session} />
        ) : screen === "waiting" ? (
          <Waiting session={session} />
        ) : screen === "result" ? (
          <PairResult session={session} />
        ) : screen === "report" ? (
          <Report session={session} />
        ) : screen === "checkout" ? (
          <Checkout session={session} />
        ) : null}
      </div>
    </main>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      우리의 이야기를 불러오고 있어요.
    </div>
  );
}
function Join({ id, invite }: { id: string; invite: string }) {
  const router = useRouter();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState("");
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api<{ canJoin: boolean }>(`/invites/${encodeURIComponent(invite)}/preview`)
      .then((d) => {
        if (active) setAvailable(d.canJoin);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [invite, retry]);
  return (
    <main id="main" className="flow-main">
      <div className="narrow">
        <PageIntro
          eyebrow="함께하고 싶은 사람의 초대"
          title="너의 이야기도 듣고 싶어."
        >
          12개 질문에 각자의 답을 담아보세요.
          <br />
          회원가입 없이, 두 사람의 전체 비교는 무료예요.
        </PageIntro>
        <div className="inline-links" style={{ marginBottom: 25 }}>
          <Link href="/sample" target="_blank">
            어떤 결과인지 먼저 보기
          </Link>
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              다시 확인
            </button>
          </div>
        )}
        {available === null && !error ? (
          <Loading />
        ) : available === false ? (
          <div className="panel center">
            <h2>이미 참여가 시작된 초대예요.</h2>
            <p className="muted" style={{ marginTop: 15 }}>
              이전에 참여했다면 같은 브라우저로 다시 열어주세요.
            </p>
            <Link
              href={`/s/${id}/survey`}
              className="button secondary"
              style={{ marginTop: 20 }}
            >
              내 참여 이어가기
            </Link>
          </div>
        ) : (
          available && (
            <form
              className="panel"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await post(`/sessions/${id}/join`, {
                    nickname,
                    adult,
                    consent,
                    invite,
                  });
                  router.replace(`/s/${id}/survey`);
                } catch (err) {
                  setError(errorText(err));
                  setBusy(false);
                }
              }}
            >
              <ParticipationFields
                nickname={nickname}
                onNickname={setNickname}
                adult={adult}
                onAdult={setAdult}
                consent={consent}
                onConsent={setConsent}
              />
              <button
                className="button primary full"
                style={{ marginTop: 20 }}
                disabled={busy || !nickname.trim() || !adult || !consent}
              >
                {busy ? "참여 중…" : "동의하고 참여하기"}
              </button>
              <p className="small muted center" style={{ marginTop: 15 }}>
                이 버튼을 누르기 전에는 참여가 시작되지 않아요.
                <br />
                기본 결과는 무료, 대화 가이드는 선택 상품이에요.
              </p>
            </form>
          )
        )}
      </div>
    </main>
  );
}
function Survey({ session: s }: { session: SessionView }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(s.answers);
  const [index, setIndex] = useState(() => {
    const missing = QUESTIONS.findIndex((q) => !s.answers[q.id]);
    return missing === -1 ? 12 : missing;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState(false);
  const q = QUESTIONS[index];
  useEffect(() => {
    if (s.submitted)
      router.replace(
        `/s/${s.sessionId}/${s.pairCompleted ? "result" : "my-result"}`,
      );
  }, [s, router]);
  if (s.submitted) return <Loading />;
  async function choose(value: Answer) {
    setBusy(true);
    setError("");
    try {
      await put(`/sessions/${s.sessionId}/answers`, {
        surveyVersion: VERSION,
        answers: [{ questionId: q.id, value }],
      });
      setAnswers((a) => ({ ...a, [q.id]: value }));
      setSaved("이 브라우저의 참여 기록에 저장했어요.");
    } catch (e) {
      setError(errorText(e));
      setSaved("저장되지 않았어요. 다시 선택해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="survey-progress-top">
        <span>
          {index === 12 ? "답변 돌아보기" : `${TOPICS[q.topic]}에 관한 질문`}
        </span>
        <span>{Math.min(index + 1, 12)} / 12</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={Object.keys(answers).length}
        aria-valuemin={0}
        aria-valuemax={12}
        aria-label="저장한 답변 수"
      >
        <div
          className="progress-bar"
          style={{ width: `${(Object.keys(answers).length / 12) * 100}%` }}
        />
      </div>
      {index < 12 ? (
        <>
          <div className="question-topic">{s.nickname}님의 평소 마음은</div>
          <h1 className="question-title" key={q.id}>
            {q.text}
          </h1>
          <p className="question-caption">
            나에게 더 편한 쪽을 골라주세요. 정답은 없어요.
          </p>
          <div
            className="answer-options"
            role="radiogroup"
            aria-label={q.text}
            onKeyDown={(e) => {
              if (
                !["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(
                  e.key,
                )
              )
                return;
              e.preventDefault();
              const current = answers[q.id] ?? 3;
              const next = Math.max(
                1,
                Math.min(
                  5,
                  current +
                    (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : -1),
                ),
              ) as Answer;
              if (!busy) void choose(next);
            }}
          >
            {([1, 2, 3, 4, 5] as Answer[]).map((value) => (
              <button
                type="button"
                role="radio"
                aria-checked={answers[q.id] === value}
                className="answer-option"
                disabled={busy}
                key={value}
                onClick={() => choose(value)}
              >
                <span className="radio" aria-hidden="true" />
                <span>
                  {value === 3
                    ? "상황에 따라 달라요"
                    : value < 3
                      ? q.left
                      : q.right}
                  {value !== 3 && (
                    <span className="answer-strength">
                      {value === 1 || value === 5
                        ? "훨씬 편해요"
                        : "조금 더 편해요"}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <p className="survey-status" aria-live="polite">
            {busy
              ? "저장하고 있어요…"
              : saved || "선택한 답변은 자동으로 저장돼요."}
          </p>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="flow-nav">
            <button
              className="button outline"
              disabled={index === 0 || busy}
              onClick={() => {
                setIndex((i) => i - 1);
                setSaved("");
              }}
            >
              이전 질문
            </button>
            <button
              className="button primary"
              disabled={!answers[q.id] || busy}
              onClick={() => {
                setIndex((i) => i + 1);
                setSaved("");
              }}
            >
              {index === 11 ? "답변 확인하기" : "다음 질문"}
            </button>
          </div>
        </>
      ) : (
        <>
          <PageIntro eyebrow="제출 전, 한 번 더" title="이렇게 답하셨네요.">
            수정하고 싶은 답이 있으면 바꿔도 좋아요.
            <br />
            제출 뒤에는 답변이 확정돼요.
          </PageIntro>
          <div className="panel">
            <ul className="review-list">
              {QUESTIONS.map((q, i) => (
                <li key={q.id}>
                  <div>
                    <strong>{q.title}</strong>
                    <p>
                      {answers[q.id]
                        ? answerLabel(q, answers[q.id])
                        : "아직 답하지 않았어요."}
                    </p>
                  </div>
                  <button
                    onClick={() => setIndex(i)}
                    aria-label={`${q.title} 답변 수정`}
                  >
                    수정
                  </button>
                </li>
              ))}
            </ul>
            <label className="checkbox-label" style={{ marginTop: 25 }}>
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              <span>
                둘 다 제출하면 서로의 12개 답변 전체를 볼 수 있다는 것을
                확인했어요.
              </span>
            </label>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button
              className="button primary full"
              disabled={busy || !confirm || Object.keys(answers).length !== 12}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const r = await post<{ pairCompleted: boolean }>(
                    `/sessions/${s.sessionId}/submit`,
                  );
                  router.replace(
                    `/s/${s.sessionId}/${r.pairCompleted ? "result" : "my-result"}`,
                  );
                } catch (e) {
                  setError(errorText(e));
                  setBusy(false);
                }
              }}
            >
              {busy ? "답변을 담고 있어요…" : "이 답변으로 제출하기"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
function Personal({ session: s }: { session: SessionView }) {
  const [data, setData] = useState<{
    nickname: string;
    items: { questionId: string; title: string; label: string }[];
    reflectionPrompt: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<typeof data>(`/sessions/${s.sessionId}/my-result`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [s.sessionId]);
  return (
    <>
      <PageIntro
        eyebrow="먼저 알아보는 나의 선택"
        title={`${s.nickname}님의 마음을 담았어요.`}
      >
        이 선택이 나의 모든 모습을 정하지는 않아요.
        <br />
        어떤 상황에서 편했는지 떠올려보세요.
      </PageIntro>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="panel">
              <ul className="review-list">
                {data.items.map((i) => (
                  <li key={i.questionId}>
                    <div>
                      <strong>{i.title}</strong>
                      <p>{i.label}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="result-banner">
              <h2>나에게 먼저 물어볼 질문</h2>
              <p>{data.reflectionPrompt}</p>
            </div>
            <Link
              className="button primary full"
              href={`/s/${s.sessionId}/${s.pairCompleted ? "result" : "waiting"}`}
            >
              {s.pairCompleted
                ? "두 사람의 답 비교하기"
                : "상대에게 초대 보내기"}
            </Link>
          </>
        )
      )}
    </>
  );
}
function Waiting({ session: s }: { session: SessionView }) {
  const router = useRouter();
  const [status, setStatus] = useState(s);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setUrl(sessionStorage.getItem(`invite_${s.sessionId}`) ?? "");
  }, [s.sessionId]);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const next = await api<SessionView>(`/sessions/${s.sessionId}`);
        if (!active) return;
        setStatus(next);
        setError("");
        if (next.pairCompleted) router.replace(`/s/${s.sessionId}/result`);
      } catch (e) {
        if (active) setError(errorText(e));
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [s.sessionId, router]);
  async function createLink() {
    setBusy(true);
    setError("");
    try {
      const data = await post<{ inviteUrl: string }>(
        `/sessions/${s.sessionId}/invite/rotate`,
      );
      setUrl(data.inviteUrl);
      sessionStorage.setItem(`invite_${s.sessionId}`, data.inviteUrl);
      setMessage("초대 링크를 만들었어요. 복사하거나 공유해주세요.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageIntro
        eyebrow="둘이서 완성하는 이야기"
        title={
          status.partnerJoined
            ? "상대도 답을 담고 있어요."
            : "이제, 너의 마음을 기다려요."
        }
      >
        상대가 12개 질문을 마치면
        <br />두 사람의 비교 결과를 함께 볼 수 있어요.
      </PageIntro>
      <div className="waiting-art" aria-hidden="true">
        <span className="avatar avatar-coral">나</span>
        <Heart size={24} />
        <span className="avatar avatar-green">너</span>
      </div>
      <div className="panel center">
        <h2 style={{ fontSize: 21 }}>
          {status.partnerJoined ? "참여 중이에요" : "초대 링크를 보내주세요"}
        </h2>
        <p className="small muted" style={{ marginTop: 12 }}>
          상대의 응답은 두 사람 모두 완료한 후에만 보여요.
        </p>
        {!status.partnerJoined && (
          <>
            {!url ? (
              <button
                onClick={createLink}
                disabled={busy || !s.submitted}
                className="button primary full"
                style={{ marginTop: 23 }}
              >
                {busy ? "준비 중…" : "초대 링크 만들기"}
              </button>
            ) : (
              <>
                <div className="invite-url">{url}</div>
                <div className="inline-links">
                  <button
                    className="button primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        setMessage("초대 링크를 복사했어요.");
                        track("invite_copy_succeeded", s.sessionId);
                      } catch {
                        setError("위의 링크를 직접 선택해 복사해주세요.");
                      }
                    }}
                  >
                    <Copy size={16} />
                    링크 복사
                  </button>
                  <button
                    className="button outline"
                    onClick={async () => {
                      if (!navigator.share) {
                        setMessage(
                          "이 브라우저에서는 링크 복사로 공유해주세요.",
                        );
                        return;
                      }
                      try {
                        track("invite_share_requested", s.sessionId);
                        await navigator.share({
                          title: "우리사이 연구소",
                          text: "우리 평소에 어떤 방식이 편한지 같이 알아볼래? 각자 12문항, 기본 비교는 무료야.",
                          url,
                        });
                      } catch {
                        setMessage(
                          "공유를 취소했어요. 링크는 계속 사용할 수 있어요.",
                        );
                      }
                    }}
                  >
                    <Share2 size={16} />
                    초대 공유
                  </button>
                </div>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={createLink}
                >
                  기존 링크 폐기하고 새로 만들기
                </button>
              </>
            )}
          </>
        )}
        {message && (
          <p className="small" role="status" style={{ marginTop: 15 }}>
            {message}
          </p>
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="inline-links">
        <Link href={`/s/${s.sessionId}/my-result`}>내 결과 다시 보기</Link>
        <Link href="/sample" target="_blank">
          완성 결과 미리보기
        </Link>
      </div>
      <p className="small muted center" style={{ marginTop: 23 }}>
        이 페이지에서 상대의 완료 상태를 자동으로 확인해요.
        <br />
        같은 브라우저에서 이 주소로 다시 들어올 수 있어요.
      </p>
    </>
  );
}
function PairResult({ session: s }: { session: SessionView }) {
  const [data, setData] = useState<FreeResult | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  useEffect(() => {
    let active = true;
    setError("");
    api<FreeResult>(`/sessions/${s.sessionId}/pair-result`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [s.sessionId, retry]);
  if (deleted)
    return (
      <>
        <PageIntro eyebrow="삭제 완료" title="두 사람의 결과를 삭제했어요.">
          답변과 결과, 참여 권한이 모두 삭제되었어요.
          <br />
          모의 거래 기록은 별도 보관돼요.
        </PageIntro>
        <div className="center">
          <Link href="/" className="button primary">
            홈으로
          </Link>
        </div>
      </>
    );
  if (error)
    return (
      <>
        <div className="error-box" role="alert">
          {error}
        </div>
        <div className="inline-links">
          <button
            className="button secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            다시 확인
          </button>
          <Link href={`/s/${s.sessionId}/waiting`}>상대 기다리기</Link>
        </div>
      </>
    );
  if (!data) return <Loading />;
  return (
    <>
      <PageIntro
        eyebrow="우리의 답이 만난 순간"
        title={`${data.aName}님과 ${data.bName}님 사이,`}
      >
        맞고 틀림 대신, 서로 편한 방식을 살펴보세요.
        <br />
        같은 선택 안에도 더 물어볼 이야기가 있어요.
      </PageIntro>
      <div className="result-banner">
        <h2>이 결과는 관계를 평가하지 않아요.</h2>
        <p>
          현재 두 사람의 자기보고 응답만 비교해요. 다르게 골랐다는 이유만으로
          문제가 있다는 뜻은 아니에요.
        </p>
      </div>
      <ComparisonList
        items={data.items}
        aName={data.aName}
        bName={data.bName}
      />
      <h2 style={{ fontSize: 24 }}>이 질문으로 대화를 시작해보세요.</h2>
      {data.freePrompts.map((p) => (
        <div className="prompt-card" key={p.questionId}>
          <span>무료 시작 질문</span>
          <p>{p.text}</p>
        </div>
      ))}
      <div className="upgrade-card">
        <h2>
          {data.hasPremiumAccess
            ? "우리의 대화를 이어가볼까요?"
            : "대화를 조금 더 이어가고 싶다면."}
        </h2>
        <p>
          다섯 가지 대화 주제와 총 10개의 질문,
          <br />
          대화 예시·함께 정해볼 약속 양식까지.
        </p>
        <Link
          className="button primary"
          href={`/s/${s.sessionId}/${data.hasPremiumAccess ? "report" : "checkout"}`}
          onClick={() => {
            if (!data.hasPremiumAccess)
              track("premium_cta_clicked", s.sessionId);
          }}
        >
          {data.hasPremiumAccess
            ? "우리 둘의 대화 가이드 열기"
            : "대화 가이드 보기 · 3,900원"}
        </Link>
        <p className="fine-print">
          한 명이 구매하면 두 사람 모두 열람해요. 기본 비교는 계속 무료예요.
        </p>
      </div>
      <Feedback sessionId={s.sessionId} scope="FREE" />
      <div className="inline-links">
        <Link href={`/s/${s.sessionId}/my-result`}>내 선택 다시 보기</Link>
        <Link href="/support">이용 도움말</Link>
      </div>
      <div className="delete-panel no-print">
        <button
          className="danger-button"
          onClick={() => setDeleteOpen(!deleteOpen)}
        >
          답변과 결과 삭제
        </button>
        {deleteOpen && (
          <div className="error-box">
            <p>
              삭제하면 상대의 답변과 결과도 함께 삭제되고, 구매한 가이드도 다시
              볼 수 없어요. 상대와 확인한 뒤 진행해주세요.
            </p>
            <button
              className="button outline"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await post(`/sessions/${s.sessionId}/delete`, {
                    confirm: "DELETE_PAIR",
                  });
                  sessionStorage.removeItem(`invite_${s.sessionId}`);
                  setDeleted(true);
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "삭제 중…" : "두 사람의 답변과 결과 삭제하기"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
function Report({ session: s }: { session: SessionView }) {
  const [data, setData] = useState<PremiumReport | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    api<PremiumReport>(`/sessions/${s.sessionId}/premium-report`)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [s.sessionId, retry]);
  return (
    <>
      <PageIntro
        eyebrow="우리 둘의 대화 가이드"
        title="너의 이야기를 더 듣고 싶어."
      >
        지금 편한 주제 하나만 골라 이야기해보세요.
        <br />
        대답도, 약속도 강요하지 않아도 괜찮아요.
      </PageIntro>
      <div className="print-toolbar">
        <Link href={`/s/${s.sessionId}/result`} className="button outline">
          무료 결과로
        </Link>
        {data && (
          <button className="button secondary" onClick={() => window.print()}>
            <Printer size={17} />
            인쇄·PDF 저장
          </button>
        )}
      </div>
      {error ? (
        <div className="error-box" role="alert">
          {error}
          <div className="inline-links">
            <button
              className="button secondary"
              onClick={() => setRetry((n) => n + 1)}
            >
              다시 확인
            </button>
            <Link href={`/s/${s.sessionId}/checkout`}>구매 상태 확인</Link>
          </div>
        </div>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <p className="sample-note">
            총 5개 주제 · 질문 10개(무료 2개 포함) · 예시 5개 · 합의 양식 5개
            <br />
            A는 먼저 시작한 사람, B는 초대받은 사람이에요. 약속은 기기 메모나
            종이에 남겨주세요.
          </p>
          <GuideCards cards={data.cards} />
          <Feedback sessionId={s.sessionId} scope="PREMIUM" />
        </>
      )}
    </>
  );
}
function Checkout({ session: s }: { session: SessionView }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [sample, setSample] = useState<GuideCard | null>(null);
  useEffect(() => {
    api<{ cards: GuideCard[] }>("/samples/0")
      .then((d) => setSample(d.cards[0]))
      .catch(() => {});
  }, []);
  async function purchase() {
    setBusy(true);
    setError("");
    try {
      setOrder(await post<OrderView>(`/sessions/${s.sessionId}/orders`));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function simulate(outcome: OrderView["status"]) {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      setOrder(
        await post<OrderView>(`/payments/mock/${order.orderId}`, { outcome }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageIntro eyebrow="서로에게 한 걸음 더" title="우리 둘의 대화 가이드">
        비교 결과에서 발견한 이야기를
        <br />
        둘이 함께 해볼 작은 약속으로 이어가보세요.
      </PageIntro>
      <div className="panel">
        <h2 style={{ fontSize: 22 }}>한 번 구매로, 두 사람 함께.</h2>
        <div className="checkout-amount">
          3,900<span>원</span>
        </div>
        <ul className="feature-list">
          {[
            "응답에 맞춰 고른 대화 주제 5개",
            "질문 총 10개 · 무료 2개 포함, 추가 8개",
            "주제별 대화 예시와 합의 양식",
            "두 사람 모두 열람 · 인쇄형 PDF",
          ].map((t) => (
            <li key={t}>
              <Check size={17} />
              {t}
            </li>
          ))}
        </ul>
        <div className="mock-notice">
          현재는 개발용 모의 결제만 제공해요. 실제 돈이 청구되지 않으며, 구매
          수요 검증으로 집계하지 않아요.
        </div>
        <p className="small muted">
          결과는 완료 후 90일 동안 보관하는 개발 기준을 적용해요. 브라우저
          데이터 삭제·기기 변경 시 복구가 보장되지 않아요. 실제 출시 전
          보관·환불 정책을 확정할 예정이에요.
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        {s.hasPremiumAccess && !order ? (
          <Link
            className="button primary full"
            style={{ marginTop: 23 }}
            href={`/s/${s.sessionId}/report`}
          >
            이미 구매한 가이드 열기
          </Link>
        ) : !order ||
          order.status === "FAILED" ||
          order.status === "CANCELED" ? (
          <>
            <label className="checkbox-label" style={{ marginTop: 23 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>
                가이드 제공 내용,{" "}
                <Link href="/refund" target="_blank">
                  취소·환불 안내
                </Link>
                , 보관·복구 제한을 확인했어요.
              </span>
            </label>
            <button
              className="button primary full"
              disabled={!s.pairCompleted || !agreed || busy}
              onClick={purchase}
            >
              {busy
                ? "주문 확인 중…"
                : order
                  ? "새 모의 주문 만들기"
                  : "모의 결제 시작하기"}
            </button>
            {order && (
              <p
                role="status"
                className="small muted"
                style={{ marginTop: 12 }}
              >
                결제가 {order.status === "FAILED" ? "실패" : "취소"}되었어요.
                무료 결과는 그대로 남아 있어요.
              </p>
            )}
          </>
        ) : order.status === "PAID" ? (
          <div className="success-box">
            <h3>모의 결제가 완료되었어요.</h3>
            <p>상대도 자신의 브라우저에서 바로 열 수 있어요.</p>
            <Link
              className="button primary full"
              style={{ marginTop: 15 }}
              href={`/s/${s.sessionId}/report`}
            >
              우리의 대화 가이드 열기
            </Link>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => simulate("REFUNDED")}
            >
              모의 환불 테스트
            </button>
          </div>
        ) : order.status === "REFUNDED" ? (
          <div className="success-box" role="status">
            모의 환불을 완료했어요. 유료 접근 권한이 해제되었고, 무료 비교
            결과는 유지돼요.
          </div>
        ) : (
          <div className="mock-notice">
            <h3>모의 결제 결과 선택</h3>
            <p className="small">
              주문 {order.orderId.slice(0, 8)} · {order.amount.toLocaleString()}
              원<br />
              보류 중에는 새 주문을 만들지 않아요.
            </p>
            <div className="feedback-options">
              <button disabled={busy} onClick={() => simulate("PAID")}>
                성공 테스트
              </button>
              <button disabled={busy} onClick={() => simulate("FAILED")}>
                실패 테스트
              </button>
              <button disabled={busy} onClick={() => simulate("CANCELED")}>
                취소 테스트
              </button>
              <button disabled={busy} onClick={() => simulate("PENDING")}>
                보류 테스트
              </button>
            </div>
            <button
              className="button outline full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setOrder(
                    await post<OrderView>("/payments/confirm", {
                      orderId: order.orderId,
                    }),
                  );
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              서버에서 결제 상태 다시 확인
            </button>
          </div>
        )}
      </div>
      <div className="inline-links">
        <Link href={`/s/${s.sessionId}/result`}>무료 결과로 돌아가기</Link>
        <Link href="/support">주문·환불 도움말</Link>
      </div>
      {sample && (
        <>
          <div className="page-intro" style={{ marginTop: 45 }}>
            <span className="eyebrow">구매 전 가상 완성 카드</span>
            <h2 style={{ fontSize: 23 }}>이런 모습으로 대화를 도와드려요.</h2>
            <p>아래는 실제 두 사람과 무관한 가상 응답 예시예요.</p>
          </div>
          <GuideCards cards={[sample]} />
        </>
      )}
    </>
  );
}
