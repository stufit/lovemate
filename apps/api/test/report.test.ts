import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  QUESTIONS,
  answerPayloadSchema,
  participantSchema,
  feedbackSchema,
  type Answers,
} from "@woorisai/shared";
import { createReport, compareKind } from "../src/domain/report";
import { settings } from "../src/config";
const uniform = (n: number) =>
  Object.fromEntries(QUESTIONS.map((q) => [q.id, n])) as Answers;
describe("deterministic item comparisons and conversational guides", () => {
  it("matches all three specification fixtures", () => {
    const text = readFileSync(
      resolve("docs/woorisai_lab_report_samples.md"),
      "utf8",
    );
    const fixtures = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) =>
      JSON.parse(m[1]),
    );
    expect(fixtures).toHaveLength(3);
    for (const f of fixtures) {
      const report = createReport(f.aAnswers, f.bAnswers);
      expect(report.selectedQuestionIds).toEqual(f.expectedSelectedQuestionIds);
      expect(report.composition).toBe(f.expectedComposition);
    }
  });
  it("does not hide opposite answers behind the same average", () => {
    const a = uniform(4),
      b = uniform(4);
    Object.assign(a, { Q01: 1, Q02: 3, Q03: 5 });
    Object.assign(b, { Q01: 5, Q02: 3, Q03: 1 });
    expect(
      createReport(a, b)
        .items.slice(0, 3)
        .map((i) => i.kind),
    ).toEqual(["DIFFERENT", "EXPLORE", "DIFFERENT"]);
  });
  it("never invents differences for identical or neutral responses", () => {
    const same = createReport(uniform(4), uniform(4));
    expect(same.items.every((i) => i.kind === "NEARBY")).toBe(true);
    const neutral = createReport(uniform(3), uniform(3));
    expect(neutral.items.every((i) => i.kind === "EXPLORE")).toBe(true);
    expect(new Set(neutral.cards.flatMap((c) => c.prompts)).size).toBe(10);
    for (const card of neutral.cards) {
      expect(card.observation).toContain("상황");
      expect(card.prompts[0]).toContain("상황");
      expect(card.example).toContain("상황에 따라");
    }
  });
  it("covers 25 response combinations per question with symmetric selection, 4 themes and 10 unique prompts", () => {
    for (const q of QUESTIONS)
      for (let a = 1; a <= 5; a++)
        for (let b = 1; b <= 5; b++) {
          const aa = uniform(4),
            bb = uniform(4);
          aa[q.id] = a as 1;
          bb[q.id] = b as 1;
          const report = createReport(aa, bb),
            reverse = createReport(bb, aa);
          expect(report.cards).toHaveLength(5);
          expect(new Set(report.cards.map((c) => c.topic)).size).toBe(4);
          expect(new Set(report.cards.flatMap((c) => c.prompts)).size).toBe(10);
          expect(report.selectedQuestionIds).toEqual(
            reverse.selectedQuestionIds,
          );
          expect(report.items.find((i) => i.questionId === q.id)?.kind).toBe(
            compareKind(a, b),
          );
          for (const c of report.cards) {
            expect(c.example.length).toBeGreaterThan(50);
            expect(c.agreement).toContain("____");
          }
        }
  });
  it("rejects missing/unknown/fractional/extra and duplicate answers", () => {
    expect(() => createReport({ Q01: 1 }, uniform(4))).toThrow(
      "ANSWERS_INCOMPLETE",
    );
    expect(
      answerPayloadSchema.safeParse({
        surveyVersion: "1.1.0",
        answers: [{ questionId: "Q99", value: 4 }],
      }).success,
    ).toBe(false);
    expect(
      answerPayloadSchema.safeParse({
        surveyVersion: "1.1.0",
        answers: [{ questionId: "Q01", value: 1.5 }],
      }).success,
    ).toBe(false);
    expect(
      answerPayloadSchema.safeParse({
        surveyVersion: "1.1.0",
        answers: [
          { questionId: "Q01", value: 1 },
          { questionId: "Q01", value: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      answerPayloadSchema.safeParse({ surveyVersion: "1.0.0", answers: [] })
        .success,
    ).toBe(false);
    expect(
      participantSchema.safeParse({ nickname: "", adult: true, consent: true })
        .success,
    ).toBe(false);
    expect(
      participantSchema.safeParse({
        nickname: "test",
        adult: false,
        consent: true,
      }).success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({
        scope: "FREE",
        usedForConversation: "NOT_YET",
        helpful: "YES",
      }).success,
    ).toBe(false);
  });
  it("returns exactly the same content for the same version and input", () => {
    expect(createReport(uniform(1), uniform(5))).toEqual(
      createReport(uniform(1), uniform(5)),
    );
  });
  it("blocks mock payments in production", () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      expect(() => settings()).toThrow("mock payments");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
