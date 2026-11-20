import { z } from "zod";

export const VERSION = "1.1.0";
export const PRICE_KRW = 3900;
export const TOPICS = {
  EMOTION: "감정 표현",
  RESOLUTION: "의견 조율",
  AFFECTION: "애정 표현",
  SPACE: "개인 시간",
} as const;
export type Topic = keyof typeof TOPICS;
export type Answer = 1 | 2 | 3 | 4 | 5;
export type Answers = Record<string, Answer>;
export type ComparisonKind = "DIFFERENT" | "EXPLORE" | "NEARBY";
export type Question = {
  id: string;
  topic: Topic;
  title: string;
  text: string;
  left: string;
  right: string;
};
export const QUESTIONS: Question[] = [
  {
    id: "Q01",
    topic: "EMOTION",
    title: "감정을 말하는 시점",
    text: "속상한 일을 상대에게 이야기할 때 더 편한 방식은?",
    left: "혼자 정리한 뒤 말하기",
    right: "느낀 감정을 바로 말하기",
  },
  {
    id: "Q02",
    topic: "EMOTION",
    title: "내가 듣고 싶은 첫마디",
    text: "내가 힘든 이야기를 꺼냈을 때 먼저 받고 싶은 반응은?",
    left: "구체적인 해결 아이디어",
    right: "내 감정을 들어주고 공감하기",
  },
  {
    id: "Q03",
    topic: "EMOTION",
    title: "마음을 전하는 방식",
    text: "고마움이나 미안함을 전할 때 더 편한 방식은?",
    left: "글이나 메시지로 전하기",
    right: "얼굴을 보며 말로 전하기",
  },
  {
    id: "Q04",
    topic: "RESOLUTION",
    title: "다시 이야기할 시간",
    text: "다툼 뒤 대화를 이어갈 때 더 편한 시점은?",
    left: "시간을 가진 뒤 약속한 때",
    right: "가능한 한 그날 안에",
  },
  {
    id: "Q05",
    topic: "RESOLUTION",
    title: "대화의 첫 번째 순서",
    text: "의견 차이를 이야기할 때 먼저 다루고 싶은 것은?",
    left: "각자 느낀 점을 충분히 듣기",
    right: "다음에 어떻게 할지 정하기",
  },
  {
    id: "Q06",
    topic: "RESOLUTION",
    title: "서운함을 듣는 방식",
    text: "서운한 점을 전달받을 때 더 편한 방식은?",
    left: "맥락을 충분히 듣고 핵심 듣기",
    right: "핵심부터 분명하게 듣기",
  },
  {
    id: "Q07",
    topic: "AFFECTION",
    title: "내가 느끼는 애정",
    text: "평소 더 받고 싶은 애정 표현은?",
    left: "일상에서 챙겨주는 행동",
    right: "직접 들려주는 애정의 말",
  },
  {
    id: "Q08",
    topic: "AFFECTION",
    title: "함께하는 시간의 모습",
    text: "둘만의 시간을 보낼 때 더 끌리는 쪽은?",
    left: "편안한 일상을 함께하기",
    right: "미리 준비한 특별한 시간",
  },
  {
    id: "Q09",
    topic: "AFFECTION",
    title: "바라는 것을 전할 때",
    text: "받고 싶은 선물이나 배려를 알릴 때 더 편한 방식은?",
    left: "상대가 먼저 물어봐 주기",
    right: "내가 원하는 것을 직접 말하기",
  },
  {
    id: "Q10",
    topic: "SPACE",
    title: "쉬는 날의 우리",
    text: "쉬는 날 에너지를 회복할 때 더 편한 방식은?",
    left: "함께 보내는 시간을 먼저 정하기",
    right: "각자 쉴 시간을 먼저 정하기",
  },
  {
    id: "Q11",
    topic: "SPACE",
    title: "소식을 나누는 시작",
    text: "개인적인 소식을 연인에게 나눌 때 더 편한 방식은?",
    left: "내가 이야기할 때 들어주기",
    right: "상대가 먼저 물어봐 주기",
  },
  {
    id: "Q12",
    topic: "SPACE",
    title: "각자의 약속이 있는 날",
    text: "개인 약속이 있는 날 연락은 어느 쪽이 더 편한가요?",
    left: "약속이 끝난 뒤 이야기 나누기",
    right: "중간에 짧게 안부 나누기",
  },
];
export function answerLabel(q: Question, value: Answer): string {
  if (value === 3) return "상황에 따라 달라요";
  return `${value < 3 ? q.left : q.right} · ${value === 1 || value === 5 ? "훨씬 편해요" : "조금 더 편해요"}`;
}
export const answerSchema = z.number().int().min(1).max(5);
export const questionIdSchema = z.enum(
  QUESTIONS.map((q) => q.id) as [string, ...string[]],
);
export const answerPayloadSchema = z
  .object({
    surveyVersion: z.literal(VERSION),
    answers: z
      .array(
        z
          .object({ questionId: questionIdSchema, value: answerSchema })
          .strict(),
      )
      .max(12),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.answers.map((a) => a.questionId)).size === v.answers.length,
    "중복 문항은 저장할 수 없어요.",
  );
export const participantSchema = z
  .object({
    nickname: z.string().trim().min(1).max(30),
    consent: z.literal(true),
    adult: z.literal(true),
  })
  .strict();
export const feedbackSchema = z
  .object({
    scope: z.enum(["FREE", "PREMIUM"]),
    usedForConversation: z.enum(["YES", "NOT_YET", "NO"]),
    helpful: z.enum(["YES", "NO"]).nullable(),
  })
  .strict()
  .refine((v) =>
    v.usedForConversation === "YES" ? v.helpful !== null : v.helpful === null,
  );
export interface Comparison {
  questionId: string;
  topic: Topic;
  title: string;
  text: string;
  aValue: Answer;
  bValue: Answer;
  aLabel: string;
  bLabel: string;
  kind: ComparisonKind;
  observation: string;
}
export interface GuideCard {
  questionId: string;
  topic: Topic;
  title: string;
  observation: string;
  prompts: [string, string];
  steps: string[];
  example: string;
  agreement: string;
}
export interface FreeResult {
  sessionId: string;
  surveyVersion: string;
  algorithmVersion: string;
  contentVersion: string;
  aName: string;
  bName: string;
  items: Comparison[];
  freePrompts: { questionId: string; text: string }[];
  hasPremiumAccess: boolean;
}
export interface PremiumReport {
  sessionId: string;
  contentVersion: string;
  cards: GuideCard[];
  generatedAt: string;
}
export interface SessionView {
  sessionId: string;
  status: string;
  mySlot: "A" | "B";
  nickname: string;
  submitted: boolean;
  partnerJoined: boolean;
  pairCompleted: boolean;
  surveyVersion: string;
  answers: Answers;
  hasPremiumAccess: boolean;
}
export interface OrderView {
  orderId: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
  amount: number;
  provider: "mock";
  paidAt: string | null;
}
export const KIND_LABELS: Record<ComparisonKind, string> = {
  DIFFERENT: "다르게 고른 부분",
  EXPLORE: "상황을 더 물어볼 부분",
  NEARBY: "가깝게 고른 부분",
};
