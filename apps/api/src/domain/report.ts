import {
  QUESTIONS,
  TOPICS,
  VERSION,
  answerLabel,
  type Answers,
  type Comparison,
  type ComparisonKind,
  type GuideCard,
} from "@woorisai/shared";

const content: Record<
  string,
  { prompts: [string, string]; agreement: string }
> = {
  Q01: {
    prompts: [
      "속상할 때 대화를 시작하기 전에 무엇이 필요한가요?",
      "상대가 먼저 말하거나 잠시 기다려달라고 하면 어떤 안내를 받고 싶나요?",
    ],
    agreement:
      "정리가 필요하면 ____라고 알리고, 다시 확인할 시점 ____를 제안해보기.",
  },
  Q02: {
    prompts: [
      "힘든 이야기를 했을 때 도움이 됐던 첫 반응은 무엇인가요?",
      "공감과 아이디어 중 지금 필요한 것을 어떻게 알려주면 편할까요?",
    ],
    agreement:
      "힘든 이야기를 시작할 때 “지금은 ____가 필요해”라고 말하고, 아이디어는 ____라고 물은 뒤 나누기.",
  },
  Q03: {
    prompts: [
      "고마움이나 미안함을 전할 때 말과 글이 각각 편했던 때는 언제인가요?",
      "이번에는 어떤 방식으로 마음을 전하고 받아보고 싶나요?",
    ],
    agreement:
      "전하고 싶은 마음 ____를 각자 편한 방식 ____ / ____로 전하고 느낌을 물어보기.",
  },
  Q04: {
    prompts: [
      "대화를 쉬고 싶을 때 어느 정도 정리되면 다시 이야기할 수 있나요?",
      "그날 대화를 끝내지 못할 때 무엇을 확인하면 덜 막막할까요?",
    ],
    agreement:
      "대화를 쉬기로 하면 다음 확인 시점 ____를 함께 정하고, 어려워지면 ____로 알려주기.",
  },
  Q05: {
    prompts: [
      "의견이 달랐을 때 감정과 해결안 중 먼저 이야기하고 싶었던 것은 무엇인가요?",
      "다음 대화에서 각자 필요한 순서를 어떻게 확인해볼까요?",
    ],
    agreement:
      "대화 전에 ____부터 다루고 싶은지 서로 묻고, 나머지는 ____에 이야기해보기.",
  },
  Q06: {
    prompts: [
      "서운한 점을 들을 때 이해하기 편했던 설명의 순서는 무엇인가요?",
      "핵심과 맥락 중 더 듣고 싶은 것을 어떻게 요청하면 편할까요?",
    ],
    agreement:
      "서운함을 전하기 전에 ____부터 들어도 괜찮은지 묻고, 더 필요한 설명 ____를 확인하기.",
  },
  Q07: {
    prompts: [
      "최근 받고 싶었던 구체적인 행동이나 말은 무엇인가요?",
      "서로 부담 없이 시도할 수 있는 애정 표현을 하나씩 고르면 무엇인가요?",
    ],
    agreement:
      "A가 받고 싶은 표현 ____, B가 받고 싶은 표현 ____. 각자 가능한 때 시도하고 ____에 느낌 나누기.",
  },
  Q08: {
    prompts: [
      "최근 함께한 시간 중 좋았던 순간은 어떤 모습이었나요?",
      "다음에 보낼 시간에는 편안함과 특별함을 어떻게 담아보고 싶나요?",
    ],
    agreement:
      "다음 함께할 시간에 ____를 해보고, 준비에 필요한 부담 ____를 함께 확인하기.",
  },
  Q09: {
    prompts: [
      "원하는 배려를 상대에게 알려주기 편했던 상황은 언제였나요?",
      "먼저 물어보기와 직접 말하기를 어떤 말로 시작하면 좋을까요?",
    ],
    agreement:
      "원하는 배려가 있을 때 ____라고 시작하고, 상대는 가능한지 ____로 답해보기.",
  },
  Q10: {
    prompts: [
      "쉬는 날 나에게 필요한 함께하는 시간과 혼자 쉬는 시간은 어떤 모습인가요?",
      "다음 쉬는 날 두 가지 시간을 어떤 순서로 정해보면 좋을까요?",
    ],
    agreement:
      "다음 쉬는 날 각자 시간 ____와 함께할 시간 ____를 가능 범위에서 정해보기.",
  },
  Q11: {
    prompts: [
      "개인적인 소식을 나누고 싶어지는 때는 언제인가요?",
      "질문받고 싶거나 아직 이야기하고 싶지 않을 때 어떻게 알려주면 좋을까요?",
    ],
    agreement:
      "소식을 나눌 때 ____라고 시작하고, 지금 답하기 어려우면 ____라고 알리기. 공유하지 않을 선택도 존중하기.",
  },
  Q12: {
    prompts: [
      "개인 약속이 있는 날 안부 연락이 편했던 상황은 언제인가요?",
      "답장이 늦을 수 있는 날 어떤 안내가 있으면 편할까요?",
    ],
    agreement:
      "약속이 있는 날 연락은 ____ 정도가 편한지 확인하기. 즉시 답장이나 위치 공유를 요구하지 않기.",
  },
};

const suggestions: Record<string, string> = {
  Q01: "말할 준비가 됐는지 먼저 묻고, 어렵다면 다시 이야기할 때를 정해볼까?",
  Q02: "지금은 이야기를 들어주면 좋을지, 아이디어가 필요할지 먼저 물어볼까?",
  Q03: "고마웠던 일 하나를 각자 편한 말이나 글로 전해볼까?",
  Q04: "쉬었다가 대화하고 싶은 날에는 다음 확인 시점부터 같이 정해볼까?",
  Q05: "오늘은 느낌을 먼저 나눌지, 다음 방법부터 정할지 서로 골라볼까?",
  Q06: "핵심부터 듣고 싶은지, 맥락부터 듣고 싶은지 먼저 물어봐도 될까?",
  Q07: "나는 듣고 싶은 말 하나, 받고 싶은 행동 하나를 구체적으로 알려줄게. 너는 어떤 표현이 좋아?",
  Q08: "다음에는 집에서 편히 쉴지, 준비한 데이트를 할지 각자 바람을 말해볼까?",
  Q09: "요즘 원하는 배려가 있는지 먼저 물어볼게. 나도 바라는 걸 직접 말해봐도 될까?",
  Q10: "다음 쉬는 날 각자 쉴 시간과 함께할 시간을 나눠서 정해볼까?",
  Q11: "내가 질문해도 편한지 먼저 물어볼게. 아직 나누고 싶지 않은 이야기는 하지 않아도 괜찮아.",
  Q12: "약속이 있는 날에는 서로 편한 안부 시점을 미리 확인해볼까? 바로 답할 필요는 없도록 하자.",
};

export function compareKind(a: number, b: number): ComparisonKind {
  return Math.abs(a - b) >= 2
    ? "DIFFERENT"
    : a === 3 || b === 3
      ? "EXPLORE"
      : "NEARBY";
}
export function validateComplete(answers: Answers) {
  if (
    Object.keys(answers).length !== 12 ||
    QUESTIONS.some(
      (q) =>
        !Number.isInteger(answers[q.id]) ||
        answers[q.id] < 1 ||
        answers[q.id] > 5,
    )
  )
    throw new Error("ANSWERS_INCOMPLETE");
}
export function createReport(a: Answers, b: Answers) {
  validateComplete(a);
  validateComplete(b);
  const items: Comparison[] = QUESTIONS.map((q) => {
    const av = a[q.id],
      bv = b[q.id];
    const kind = compareKind(av, bv);
    const aLabel = answerLabel(q, av),
      bLabel = answerLabel(q, bv);
    let observation = `A의 선택은 ‘${aLabel}’, B의 선택은 ‘${bLabel}’예요.`;
    if (av === 3 && bv === 3)
      observation =
        "두 분 모두 상황에 따라 다르다고 골랐어요. 어떤 상황에서 달라지는지 물어보세요.";
    else if (av === 3 || bv === 3)
      observation += ` ${av === 3 ? "A" : "B"}에게는 어떤 상황에서 편한 방식이 달라지는지 물어보세요.`;
    else if (kind === "NEARBY")
      observation +=
        " 같은 방향을 골랐지만 구체적으로 원하는 모습은 다를 수 있어요.";
    else
      observation +=
        " 다른 선택의 이유를 짐작하기보다 서로 편한 상황을 물어보세요.";
    return {
      questionId: q.id,
      topic: q.topic,
      title: q.title,
      text: q.text,
      aValue: av,
      bValue: bv,
      aLabel,
      bLabel,
      kind,
      observation,
    };
  });
  const weight = { DIFFERENT: 0, EXPLORE: 1, NEARBY: 2 };
  const ranked = [...items].sort(
    (x, y) =>
      weight[x.kind] - weight[y.kind] ||
      (x.kind === "DIFFERENT"
        ? Math.abs(y.aValue - y.bValue) - Math.abs(x.aValue - x.bValue)
        : 0) ||
      x.questionId.localeCompare(y.questionId),
  );
  const selected = new Set<string>();
  const topics = new Set<string>();
  for (const item of ranked)
    if (!topics.has(item.topic)) {
      topics.add(item.topic);
      selected.add(item.questionId);
    }
  selected.add(ranked.find((i) => !selected.has(i.questionId))!.questionId);
  const cards: GuideCard[] = ranked
    .filter((i) => selected.has(i.questionId))
    .map((i) => {
      const template = content[i.questionId];
      const neutral = i.aValue === 3 || i.bValue === 3;
      const prompts: [string, string] = neutral
        ? [
            `${i.title}에서 편한 방식이 상황에 따라 달라지는 때는 언제인가요?`,
            `${i.title}에 관해, 그 상황에서 필요한 것을 어떤 말로 알려주면 좋을까요?`,
          ]
        : template.prompts;
      const describe = (v: number, label: string) =>
        v === 3
          ? "나는 상황에 따라 편한 방식이 달라져. 어떤 때 다른지 이야기해볼게."
          : `나는 ‘${label}’라고 골랐어. 어떤 상황에서 편한지 말해볼게.`;
      return {
        questionId: i.questionId,
        topic: i.topic,
        title: i.title,
        observation: i.observation,
        prompts,
        steps: [
          "질문마다 각자 경험을 하나씩 말해보세요.",
          "상대의 말을 “내가 이해한 건 ____인데 맞아?”로 확인해보세요.",
          "둘 다 원하면 해볼 약속 하나를 적어보세요. 지금 정하지 않아도 괜찮아요.",
        ],
        example: `A: “${describe(i.aValue, i.aLabel)}” B: “${describe(i.bValue, i.bLabel)}” A: “${suggestions[i.questionId]}” B: “좋아. 어렵다면 다시 이야기하자.”`,
        agreement: template.agreement,
      };
    });
  const n = items.filter((i) => i.kind === "DIFFERENT").length;
  return {
    surveyVersion: VERSION,
    algorithmVersion: VERSION,
    contentVersion: VERSION,
    items,
    cards,
    selectedQuestionIds: cards.map((c) => c.questionId),
    composition:
      n >= 4 ? "DIFFERENCE_FOCUS" : n <= 1 ? "COMMON_GROUND" : "MIXED",
    freePrompts: cards
      .slice(0, 2)
      .map((c) => ({ questionId: c.questionId, text: c.prompts[0] })),
    topicGroups: Object.entries(TOPICS).map(([key, label]) => ({
      key,
      label,
      questionIds: items
        .filter((i) => i.topic === key)
        .map((i) => i.questionId),
    })),
  };
}
export function sampleReport(index: number) {
  const a = Object.fromEntries(
    QUESTIONS.map((q) => [q.id, index === 0 ? 1 : 4]),
  ) as Answers;
  const b = Object.fromEntries(
    QUESTIONS.map((q) => [q.id, index === 0 ? 5 : 4]),
  ) as Answers;
  if (index === 2) {
    b.Q01 = 1;
    b.Q04 = 1;
    b.Q10 = 3;
  }
  const { composition, selectedQuestionIds, ...result } = createReport(a, b);
  return { ...result, aName: "가상의 A", bName: "가상의 B", isSample: true };
}
