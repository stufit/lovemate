import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { QUESTIONS } from "../../packages/shared/src";
const headers = { Origin: "http://127.0.0.1:3100", "X-Woorisai-Request": "1" };
async function participate(page: Page, name: string) {
  await page.getByLabel("어떤 이름으로 불러드릴까요?").fill(name);
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
}
async function completeSurvey(page: Page, choice: number) {
  for (let i = 0; i < 12; i++) {
    await expect(page.getByRole("radiogroup")).toBeVisible();
    await page.getByRole("radio").nth(choice).click();
    await expect(page.getByRole("radio").nth(choice)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page
      .getByRole("button", { name: i === 11 ? "답변 확인하기" : "다음 질문" })
      .click();
  }
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "이 답변으로 제출하기" }).click();
}
test("mobile: two private browsers complete surveys, compare, purchase, share access and print", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "처음 듣는 마음",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "우리의 답 알아보기" }).click();
  await participate(page, "민지");
  await page.getByRole("button", { name: "12개의 질문 시작하기" }).click();
  await expect(page).toHaveURL(/\/survey$/);
  const sessionId = page.url().split("/s/")[1].split("/")[0];
  // First answer survives a reload, while no personal token is placed in browser storage.
  await page.getByRole("radio").first().click();
  await expect(page.getByRole("radio").first()).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.reload();
  const initial = await page.request.get(`/api/v1/sessions/${sessionId}`);
  expect((await initial.json()).answers.Q01).toBe(1);
  // Reload resumes at the first unanswered item; revisit first item once for a complete visible run.
  await page.getByRole("button", { name: "이전 질문" }).click();
  await completeSurvey(page, 0);
  await expect(page).toHaveURL(/my-result$/);
  await page.getByRole("link", { name: "상대에게 초대 보내기" }).click();
  await page.getByRole("button", { name: "초대 링크 만들기" }).click();
  const inviteUrl = await page.locator(".invite-url").innerText();
  const ctxB = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 390, height: 844 },
  });
  const b = await ctxB.newPage();
  await b.goto(inviteUrl);
  // Preview does not occupy slot; A still sees not joined.
  expect(
    (await (await page.request.get(`/api/v1/sessions/${sessionId}`)).json())
      .partnerJoined,
  ).toBe(false);
  await participate(b, "준호");
  await b.getByRole("button", { name: "동의하고 참여하기" }).click();
  await completeSurvey(b, 4);
  await expect(b).toHaveURL(/result$/);
  await expect(b.locator(".comparison-card")).toHaveCount(12);
  await expect(page).toHaveURL(/result$/, { timeout: 12000 });
  await expect(page.locator(".comparison-card")).toHaveCount(12);
  const before = await b.request.get(
    `/api/v1/sessions/${sessionId}/premium-report`,
  );
  expect(before.status()).toBe(403);
  await page.getByRole("link", { name: "대화 가이드 보기 · 3,900원" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "모의 결제 시작하기" }).click();
  await page.getByRole("button", { name: "보류 테스트" }).click();
  await expect(
    page.getByRole("button", { name: "서버에서 결제 상태 다시 확인" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "성공 테스트" }).click();
  await page.getByRole("link", { name: "우리의 대화 가이드 열기" }).click();
  await expect(page.locator(".guide-card")).toHaveCount(5);
  await b.reload();
  await b.getByRole("link", { name: "우리 둘의 대화 가이드 열기" }).click();
  await expect(b.locator(".guide-card")).toHaveCount(5);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".site-header")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "해봤어요", exact: true }).click();
  await page
    .getByRole("button", { name: "도움이 됐어요", exact: true })
    .click();
  await page.getByRole("button", { name: "의견 남기기" }).click();
  await expect(page.getByRole("status")).toContainText("고마워요");
  await page.screenshot({
    path: "test-results/mobile-guide.png",
    fullPage: true,
  });
  const cookies = await page.context().cookies();
  expect(
    cookies.find((c) => c.name === `woorisai_${sessionId}`)?.httpOnly,
  ).toBe(true);
  await ctxB.close();
});
async function fastPair(context: BrowserContext) {
  const a = await context.request.post("/api/v1/sessions", {
    headers,
    data: { nickname: "테스트 A", consent: true, adult: true },
  });
  const id = (await a.json()).sessionId;
  await context.request.put(`/api/v1/sessions/${id}/answers`, {
    headers,
    data: {
      surveyVersion: "1.1.0",
      answers: QUESTIONS.map((q) => ({ questionId: q.id, value: 3 })),
    },
  });
  await context.request.post(`/api/v1/sessions/${id}/submit`, { headers });
  const invite = await context.request.post(
    `/api/v1/sessions/${id}/invite/rotate`,
    { headers },
  );
  return { id, url: (await invite.json()).inviteUrl };
}
test("sample tabs, failed/canceled purchase, refund and empty result access", async ({
  browser,
  page,
  context,
}) => {
  await page.goto("/sample");
  await expect(page.locator(".guide-card")).toHaveCount(5);
  await page.getByRole("button", { name: "같은 방향을 고른 두 사람" }).click();
  await expect(page.locator(".badge.different")).toHaveCount(0);
  await expect(page.locator(".comparison-card")).toHaveCount(12);
  const { id, url } = await fastPair(context);
  const ctx = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const b = await ctx.newPage();
  await b.goto(url);
  await participate(b, "테스트 B");
  await b.getByRole("button", { name: "동의하고 참여하기" }).click();
  await completeSurvey(b, 2);
  await page.goto(`/s/${id}/checkout`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "모의 결제 시작하기" }).click();
  await page.getByRole("button", { name: "실패 테스트" }).click();
  await expect(
    page.getByRole("button", { name: "새 모의 주문 만들기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "새 모의 주문 만들기" }).click();
  await page.getByRole("button", { name: "취소 테스트" }).click();
  await expect(
    page.getByRole("button", { name: "새 모의 주문 만들기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "새 모의 주문 만들기" }).click();
  await page.getByRole("button", { name: "성공 테스트" }).click();
  await page.getByRole("button", { name: "모의 환불 테스트" }).click();
  await expect(page.getByRole("status")).toContainText("환불을 완료");
  const revoked = await ctx.request.get(
    `/api/v1/sessions/${id}/premium-report`,
  );
  expect(revoked.status()).toBe(403);
  await b.goto(`/s/${id}/result`);
  await expect(b.locator(".comparison-card")).toHaveCount(12);
  await expect(b.locator(".badge.different")).toHaveCount(0);
  await ctx.close();
});
test("desktop and mobile landing have no overflow or browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/desktop-landing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "개인 시간", exact: true }).click();
  await expect(page.locator(".preview-question h2")).toContainText("쉬는 날");
  expect(errors).toEqual([]);
});
