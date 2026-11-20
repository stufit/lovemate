import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const fields = [
  "pairId",
  "status",
  "understoodWithoutHelp",
  "startedConversation",
  "describedSpecificValue",
  "similarAnswerCase",
  "premiumIntention",
  "accessMethod",
  "issues",
];
const booleans = [
  "understoodWithoutHelp",
  "startedConversation",
  "describedSpecificValue",
  "similarAnswerCase",
];
const issueCodes = [
  "LANDING",
  "QUESTION_WORDING",
  "SAVE_RESTORE",
  "INVITE",
  "RESULT",
  "GUIDE",
  "DELETE",
  "ANSWER_EXPOSURE",
  "WRONG_EXPLANATION",
  "OTHER",
];
export function summarize(input) {
  const fail = () => {
    throw new Error(
      "기록 양식을 확인해주세요. 허용된 코드와 관찰 값만 입력할 수 있습니다.",
    );
  };
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).sort().join() !== "records,version" ||
    input.version !== 1 ||
    !Array.isArray(input.records) ||
    input.records.length < 5 ||
    input.records.length > 10
  )
    fail();
  const ids = new Set();
  for (const r of input.records) {
    if (
      !r ||
      typeof r !== "object" ||
      Object.keys(r).sort().join() !== [...fields].sort().join() ||
      !/^P(0[1-9]|10)$/.test(r.pairId) ||
      ids.has(r.pairId)
    )
      fail();
    ids.add(r.pairId);
    if (
      !["NOT_STARTED", "STARTED", "COMPLETED", "STOPPED"].includes(r.status) ||
      !["NOT_ASKED", "YES", "NO", "UNSURE"].includes(r.premiumIntention) ||
      !["NONE", "SAMPLE", "MOCK"].includes(r.accessMethod)
    )
      fail();
    if (
      booleans.some((k) => r[k] !== null && typeof r[k] !== "boolean") ||
      !Array.isArray(r.issues) ||
      r.issues.some((k) => !issueCodes.includes(k)) ||
      new Set(r.issues).size !== r.issues.length
    )
      fail();
    if (r.describedSpecificValue === true && r.startedConversation !== true)
      fail();
    if (
      r.status === "NOT_STARTED" &&
      (booleans.some((k) => r[k] !== null) ||
        r.premiumIntention !== "NOT_ASKED" ||
        r.accessMethod !== "NONE" ||
        r.issues.length)
    )
      fail();
  }
  const cohort = Array.from({ length: 5 }, (_, i) =>
    input.records.find((r) => r.pairId === `P0${i + 1}`),
  );
  if (cohort.some((r) => !r)) fail();
  const observed = cohort.filter((r) =>
    ["COMPLETED", "STOPPED"].includes(r.status),
  );
  const missing = cohort.filter(
    (r) => r.status === "COMPLETED" && booleans.some((k) => r[k] === null),
  ).length;
  const understood = cohort.filter(
    (r) => r.understoodWithoutHelp === true,
  ).length;
  const value = cohort.filter(
    (r) => r.startedConversation === true && r.describedSpecificValue === true,
  ).length;
  const similar = cohort.filter((r) => r.similarAnswerCase === true).length;
  const issues = Object.fromEntries(
    issueCodes
      .map((k) => [k, cohort.filter((r) => r.issues.includes(k)).length])
      .filter(([, n]) => n),
  );
  let decision = "관찰 진행 중";
  if (issues.ANSWER_EXPOSURE || issues.WRONG_EXPLANATION)
    decision = "제품 문제 수정 후 재검증";
  else if (observed.length === 5)
    decision = missing
      ? "판단 유보: 완료 기록의 관찰 값이 누락됨"
      : understood >= 4 && value >= 3 && similar >= 1
        ? "소규모 콘텐츠 실험 기준 충족"
        : "기준 미달: 개선 후 재검증";
  return {
    planned: 5,
    observed: observed.length,
    completed: cohort.filter((r) => r.status === "COMPLETED").length,
    stopped: cohort.filter((r) => r.status === "STOPPED").length,
    notStarted: cohort.filter((r) => r.status === "NOT_STARTED").length,
    inProgress: cohort.filter((r) => r.status === "STARTED").length,
    missingCompletedRecords: missing,
    understood,
    conversationAndSpecificValue: value,
    similarCases: similar,
    priceIntention: Object.fromEntries(
      ["YES", "NO", "UNSURE", "NOT_ASKED"].map((k) => [
        k,
        cohort.filter((r) => r.premiumIntention === k).length,
      ]),
    ),
    mockAccess: cohort.filter((r) => r.accessMethod === "MOCK").length,
    actualPurchases: "집계하지 않음: 현재 실제 결제 미지원",
    issues,
    decision,
  };
}
async function main() {
  const directory = resolve(".local-validation");
  const path = resolve(directory, "records.json");
  if (process.argv[2] === "init") {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const example = await readFile(
      new URL("../docs/validation/records.example.json", import.meta.url),
      "utf8",
    );
    await writeFile(path, example, { flag: "wx", mode: 0o600 });
    console.log(
      "관찰 기록을 초기화했습니다: .local-validation/records.json (실제 관찰 0쌍)",
    );
  } else if (process.argv[2] === "report") {
    const summary = summarize(JSON.parse(await readFile(path, "utf8")));
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      "자기보고·소표본 관찰용 집계입니다. 실제 고객 검증이나 구매를 자동으로 만들어내지 않습니다.",
    );
  } else
    throw new Error(
      "pnpm validation:init 또는 pnpm validation:report를 사용해주세요.",
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      error.code === "EEXIST"
        ? "기존 관찰 기록이 있어 초기화하지 않았습니다."
        : error.code === "ENOENT"
          ? "기록 파일이 없습니다. pnpm validation:init부터 실행해주세요."
          : error instanceof SyntaxError
            ? "JSON 형식을 확인해주세요."
            : error.message,
    );
    process.exitCode = 1;
  });
}
