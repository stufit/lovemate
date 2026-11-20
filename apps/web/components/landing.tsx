"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Sparkles,
  Leaf,
  Check,
  Quote,
  Plus,
} from "lucide-react";
import { track } from "@/lib/api";
export function Landing() {
  const [topic, setTopic] = useState(0);
  useEffect(() => track("landing_viewed"), []);
  const previews = [
    {
      title: "속상한 일이 생겼을 때, 나는",
      a: "조금 정리한 뒤에\n이야기하고 싶어.",
      b: "지금 내 마음을\n바로 나누고 싶어.",
      prompt: "대화를 시작하기 전에,\n각자에게 필요한 건 무엇일까요?",
    },
    {
      title: "쉬는 날을 보낼 때, 나는",
      a: "함께할 시간을\n먼저 정하고 싶어.",
      b: "혼자 쉴 시간을\n먼저 정하고 싶어.",
      prompt: "둘만의 시간과 각자의 시간,\n어떻게 함께 정해볼까요?",
    },
  ];
  const p = previews[topic];
  return (
    <main id="main">
      <section className="hero container">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="kicker-line" />
            우리 마음 사이, 작은 발견
          </div>
          <h1>
            사랑하는 사이에도
            <br />
            처음 듣는 마음이
            <br />
            <span>있으니까.</span>
            <svg
              className="hero-spark"
              width="45"
              height="56"
              viewBox="0 0 45 56"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m4 24 13-5M22 3l-1 13m19-5-11 13M33 36l10 5"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p className="hero-desc">
            같은 질문에 각자의 답을 담아보세요.
            <br />
            서로 편한 방식을 발견하는 12개의 질문,
            <br />
            우리다운 대화가 여기서 시작돼요.
          </p>
          <div className="hero-actions">
            <Link href="/start" className="button primary large">
              우리의 답 알아보기
            </Link>
            <Link href="/sample" className="text-link">
              결과 먼저 둘러보기
            </Link>
          </div>
          <div className="hero-assurances">
            <span>
              <Check size={15} /> 회원가입 없이
            </span>
            <span>
              <Check size={15} /> 기본 비교 무료
            </span>
            <span>
              <Check size={15} /> 둘이 함께
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <span className="art-flower" aria-hidden="true">
            ✳
          </span>
          <div className="art-caption">우리가 서로를 알아가는 방법</div>
          <div className="preview-question">
            <span className="tiny-label">가상의 두 사람 · 답변 예시</span>
            <h2>{p.title}</h2>
            <div className="preview-tabs">
              <button onClick={() => setTopic(0)} aria-pressed={topic === 0}>
                감정 표현
              </button>
              <button onClick={() => setTopic(1)} aria-pressed={topic === 1}>
                개인 시간
              </button>
            </div>
          </div>
          <div className="answer-note note-a">
            <div className="note-heading">
              <span className="avatar avatar-coral">A</span>
              <span>나의 답변</span>
              <Heart size={16} />
            </div>
            <p>{p.a}</p>
            <span className="note-stroke" />
          </div>
          <div className="answer-note note-b">
            <div className="note-heading">
              <span className="avatar avatar-green">B</span>
              <span>너의 답변</span>
              <Leaf size={16} />
            </div>
            <p>{p.b}</p>
            <span className="note-stroke" />
          </div>
          <div className="conversation-note">
            <span className="mini-flower">✳</span>
            <div>
              <strong>다름을 발견했다면, 이렇게 물어봐요</strong>
              <p>{p.prompt}</p>
            </div>
          </div>
          <span className="art-footnote">
            맞고 틀림 대신, 서로를 이해하는 질문.
          </span>
        </div>
      </section>
      <div className="belief-strip">
        <div className="container">
          <Quote size={24} strokeWidth={1.4} />
          <p>
            “왜 나랑 다를까?”에서 <strong>“너는 이게 편하구나.”</strong>로
          </p>
          <span>우리사이가 만들고 싶은 대화</span>
        </div>
      </div>
      <section className="container themes-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">작은 질문, 새로운 발견</span>
            <h2>
              익숙한 우리에게
              <br className="mobile-only" /> 물어보고 싶은 것들.
            </h2>
          </div>
          <p>
            감정을 나누는 순간부터 혼자 쉬는 시간까지.
            <br />네 가지 주제 속에서 우리를 만나보세요.
          </p>
        </div>
        <div className="theme-grid">
          {[
            {
              icon: MessageCircle,
              title: "감정 표현",
              text: "힘든 이야기를 꺼냈을 때,\n너에게 필요한 첫마디는?",
              style: "peach",
            },
            {
              icon: Sparkles,
              title: "의견 조율",
              text: "다르게 생각하는 순간,\n어디서부터 이야기할까?",
              style: "yellow",
            },
            {
              icon: Heart,
              title: "애정 표현",
              text: "사랑받는다고 느끼는 건,\n어떤 말과 행동일까?",
              style: "pink",
            },
            {
              icon: Leaf,
              title: "개인 시간",
              text: "함께하는 우리 사이에,\n각자의 시간은 어떤 모습일까?",
              style: "green",
            },
          ].map((t) => (
            <article className={`theme-card ${t.style}`} key={t.title}>
              <t.icon size={30} strokeWidth={1.5} />
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="how" className="how-section">
        <div className="container how-layout">
          <div>
            <span className="eyebrow">둘이서, 각자의 속도로</span>
            <h2>
              함께 알아가는 건<br />
              어렵지 않아요.
            </h2>
            <p className="muted">
              답을 맞출 필요도, 잘 보일 필요도 없어요.
              <br />
              평소 나에게 편한 쪽을 골라주세요.
            </p>
            <Link href="/start" className="text-link">
              무료로 시작하기
            </Link>
          </div>
          <ol className="steps-list">
            <li>
              <span>01</span>
              <div>
                <h3>먼저, 나의 마음을 담아요</h3>
                <p>12개 질문에 답하고 내 선택을 살펴보세요.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>함께하고 싶은 사람을 초대해요</h3>
                <p>링크를 보내면 상대도 자신의 답을 담을 수 있어요.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>두 사람의 답에서 대화를 시작해요</h3>
                <p>모든 답변을 무료로 비교하고 서로의 이야기를 들어보세요.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
      <section className="container guide-promo">
        <div className="guide-art" aria-hidden="true">
          <div className="paper-sheet">
            <span>우리 둘의 대화 가이드</span>
            <Heart size={32} strokeWidth={1.4} />
            <strong>
              너의 이야기를
              <br />더 듣고 싶어.
            </strong>
            <div className="paper-lines" />
            <span>WOORISAI LAB</span>
          </div>
          <span className="guide-seal">
            함께
            <br />한 걸음
          </span>
        </div>
        <div className="guide-copy">
          <span className="eyebrow">대화를 조금 더 이어가고 싶다면</span>
          <h2>
            알아보는 데서 한 걸음,
            <br />
            함께 해보는 대화로.
          </h2>
          <p>
            우리 답변에 맞춘 다섯 가지 대화 주제.
            <br />
            질문과 예시, 함께 정해볼 작은 약속까지 담았어요.
          </p>
          <div className="guide-price">
            <strong>
              3,900<span>원</span>
            </strong>
            <span>커플당 한 번 · 두 사람 함께 열람</span>
          </div>
          <Link href="/sample" className="button outline">
            대화 가이드 미리보기
          </Link>
          <p className="fine-print">
            기본 비교는 무료예요. 대화 가이드는 원할 때 선택하세요.
          </p>
        </div>
      </section>
      <section className="container faq-section">
        <div>
          <span className="eyebrow">궁금한 이야기</span>
          <h2>시작하기 전에.</h2>
        </div>
        <div className="faq-list">
          {[
            [
              "궁합이나 심리검사인가요?",
              "두 사람의 실제 선택을 보여주는 대화 참고 콘텐츠예요. 관계 점수나 성격 유형을 매기지 않고, 상대의 마음이나 미래를 예측하지 않아요.",
            ],
            [
              "상대도 회원가입을 해야 하나요?",
              "두 사람 모두 회원가입 없이 참여해요. 내 답변을 제출하고 초대 링크를 보내면 상대도 각자 응답할 수 있어요.",
            ],
            [
              "어디까지 무료인가요?",
              "개인 결과, 두 사람의 전체 12문항 비교, 대화 시작 질문 2개가 무료예요. 추가 질문과 대화 예시·합의 양식은 3,900원 대화 가이드에 포함돼요.",
            ],
            [
              "내 답변은 언제 상대에게 보이나요?",
              "두 사람 모두 제출한 뒤 서로의 전체 답변을 볼 수 있어요. 응답 중인 답변은 공개되지 않고, 제3자가 결과를 볼 수 없어요.",
            ],
            [
              "답변이 비슷해도 도움이 되나요?",
              "같은 선택 안에서도 구체적으로 원하는 모습은 다를 수 있어요. 공통 선호를 생활 속에서 실천하는 질문도 함께 준비했어요.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Plus size={19} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="closing-section">
        <span className="eyebrow">오늘, 서로에게 한 걸음</span>
        <h2>
          우리 사이에 아직 모르는
          <br />
          이야기를 만나보세요.
        </h2>
        <Link href="/start" className="button primary large">
          12개의 질문 시작하기
        </Link>
      </section>
    </main>
  );
}
