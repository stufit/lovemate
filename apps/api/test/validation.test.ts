import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { summarize } from "../../../scripts/validation.mjs";
function example() {
  return JSON.parse(
    readFileSync("docs/validation/records.example.json", "utf8"),
  );
}
function observed() {
  const input = example();
  for (const r of input.records)
    Object.assign(r, {
      status: "COMPLETED",
      understoodWithoutHelp: true,
      startedConversation: true,
      describedSpecificValue: true,
      similarAnswerCase: false,
      premiumIntention: "YES",
      accessMethod: "MOCK",
    });
  input.records[0].similarAnswerCase = true;
  return input;
}
describe("human validation observations — synthetic test data only", () => {
  it("keeps untouched records at zero and never treats missing observations as success", () => {
    const report = summarize(example());
    expect(report.observed).toBe(0);
    expect(report.understood).toBe(0);
    expect(report.notStarted).toBe(5);
    expect(report.decision).toBe("관찰 진행 중");
  });
  it("requires both conversation and specific value, with the original first five as denominator", () => {
    const input = observed();
    input.records[3].describedSpecificValue = false;
    input.records[4].startedConversation = false;
    input.records[4].describedSpecificValue = false;
    const report = summarize(input);
    expect(report.conversationAndSpecificValue).toBe(3);
    expect(report.decision).toBe("소규모 콘텐츠 실험 기준 충족");
    input.records[2].describedSpecificValue = false;
    expect(summarize(input).decision).toContain("기준 미달");
  });
  it("distinguishes mock use and price intention from actual purchases", () => {
    const report = summarize(observed());
    expect(report.mockAccess).toBe(5);
    expect(report.priceIntention.YES).toBe(5);
    expect(report.actualPurchases).toContain("실제 결제 미지원");
  });
  it("defers missing completed records and stops progression for product errors", () => {
    const input = observed();
    input.records[0].understoodWithoutHelp = null;
    expect(summarize(input).decision).toContain("판단 유보");
    input.records[0].issues = ["WRONG_EXPLANATION"];
    expect(summarize(input).decision).toBe("제품 문제 수정 후 재검증");
  });
  it("rejects unsupported personal fields, duplicates and inconsistent use evidence", () => {
    const input = example();
    input.records[0].email = "synthetic@example.invalid";
    expect(() => summarize(input)).toThrow();
    const duplicate = example();
    duplicate.records[1].pairId = "P01";
    expect(() => summarize(duplicate)).toThrow();
    const inconsistent = observed();
    inconsistent.records[0].startedConversation = false;
    expect(() => summarize(inconsistent)).toThrow();
  });
});
