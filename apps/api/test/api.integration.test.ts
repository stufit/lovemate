import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createHmac } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { QUESTIONS } from "@woorisai/shared";
import { createApplication } from "../src/app";
import { createDataSource, seed } from "../src/db/data-source";
import { settings } from "../src/config";
let app: INestApplication, db: DataSource;
const headers = { Origin: settings().webUrl, "X-Woorisai-Request": "1" };
const body = { nickname: "민지", adult: true, consent: true };
const allAnswers = (value: number) => ({
  surveyVersion: "1.1.0",
  answers: QUESTIONS.map((q) => ({ questionId: q.id, value })),
});
function client() {
  return request(app.getHttpServer());
}
async function create() {
  const r = await client()
    .post("/api/v1/sessions")
    .set(headers)
    .send(body)
    .expect(201);
  return {
    id: r.body.sessionId as string,
    cookie: (r.headers["set-cookie"] as unknown as string[])[0].split(";")[0],
  };
}
async function save(id: string, cookie: string, value = 4) {
  await client()
    .put(`/api/v1/sessions/${id}/answers`)
    .set(headers)
    .set("Cookie", cookie)
    .send(allAnswers(value))
    .expect(200);
}
async function submit(id: string, cookie: string) {
  return client()
    .post(`/api/v1/sessions/${id}/submit`)
    .set(headers)
    .set("Cookie", cookie)
    .send({});
}
async function invite(id: string, cookie: string) {
  const r = await client()
    .post(`/api/v1/sessions/${id}/invite/rotate`)
    .set(headers)
    .set("Cookie", cookie)
    .send({})
    .expect(200);
  return new URL(r.body.inviteUrl).searchParams.get("invite")!;
}
async function join(id: string, token: string) {
  const r = await client()
    .post(`/api/v1/sessions/${id}/join`)
    .set(headers)
    .send({ ...body, nickname: "준호", invite: token })
    .expect(201);
  return (r.headers["set-cookie"] as unknown as string[])[0].split(";")[0];
}
async function pair() {
  const { id, cookie: a } = await create();
  await save(id, a, 1);
  await submit(id, a).then((r) => expect(r.status).toBe(200));
  const token = await invite(id, a);
  const b = await join(id, token);
  await save(id, b, 5);
  await submit(id, b).then((r) => expect(r.status).toBe(200));
  return { id, a, b };
}
async function order(id: string, cookie: string) {
  const r = await client()
    .post(`/api/v1/sessions/${id}/orders`)
    .set(headers)
    .set("Cookie", cookie)
    .send({})
    .expect(200);
  return r.body.orderId as string;
}
async function simulate(oid: string, cookie: string, outcome: string) {
  return client()
    .post(`/api/v1/payments/mock/${oid}`)
    .set(headers)
    .set("Cookie", cookie)
    .send({ outcome });
}
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test"))
    throw new Error(
      "Integration tests require a dedicated TEST_DATABASE_URL ending in _test.",
    );
  db = createDataSource(url);
  await db.initialize();
  await db.runMigrations();
  await seed(db);
  const built = await createApplication(db);
  app = built.app;
  await app.listen(0, "127.0.0.1");
});
afterAll(async () => {
  if (app) await app.close();
  if (db?.isInitialized) await db.destroy();
});
beforeEach(async () => {
  await db.query("TRUNCATE couple_sessions CASCADE");
});
describe("private two-person workflow", () => {
  it("requires consent and CSRF, sets private cookie, saves only the current participant answers", async () => {
    await client().post("/api/v1/sessions").send(body).expect(403);
    await client()
      .post("/api/v1/sessions")
      .set({ ...headers, Origin: "https://attacker.invalid" })
      .send(body)
      .expect(403);
    await client()
      .post("/api/v1/sessions")
      .set(headers)
      .send({ ...body, adult: false })
      .expect(400);
    const { id, cookie } = await create();
    expect(cookie).not.toContain("undefined");
    await save(id, cookie);
    const mine = await client()
      .get(`/api/v1/sessions/${id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(Object.keys(mine.body.answers)).toHaveLength(12);
    await client().get(`/api/v1/sessions/${id}`).expect(401);
    await client()
      .get(`/api/v1/sessions/${id}/pair-result`)
      .set("Cookie", cookie)
      .expect(409);
    await client()
      .get(`/api/v1/sessions/${id}/my-result`)
      .set("Cookie", cookie)
      .expect(409);
    await submit(id, cookie).then((r) => expect(r.status).toBe(200));
    await client()
      .get(`/api/v1/sessions/${id}/my-result`)
      .set("Cookie", cookie)
      .expect(200);
    await client()
      .put(`/api/v1/sessions/${id}/answers`)
      .set(headers)
      .set("Cookie", cookie)
      .send(allAnswers(2))
      .expect(409);
  });
  it("keeps preview read-only, rejects rotated invites and admits exactly one concurrent B", async () => {
    const { id, cookie: a } = await create();
    await save(id, a);
    await submit(id, a);
    const old = await invite(id, a);
    const token = await invite(id, a);
    await client().get(`/api/v1/invites/${old}/preview`).expect(404);
    for (let n = 0; n < 2; n++)
      await client()
        .get(`/api/v1/invites/${token}/preview`)
        .expect(200)
        .then((r) => expect(r.body).toEqual({ canJoin: true }));
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM participants WHERE session_id=$1 AND slot='B'",
            [id],
          )
        )[0].count,
      ),
    ).toBe(0);
    const outcomes = await Promise.all(
      [1, 2].map(() =>
        client()
          .post(`/api/v1/sessions/${id}/join`)
          .set(headers)
          .send({ ...body, invite: token }),
      ),
    );
    expect(outcomes.map((r) => r.status).sort()).toEqual([201, 409]);
    await client()
      .get(`/api/v1/sessions/${id}`)
      .set("Cookie", `woorisai_${id}=${token}`)
      .expect(401);
  });
  it("never leaks B drafts, creates one immutable snapshot, and returns all 12 free comparisons", async () => {
    const { id, cookie: a } = await create();
    await save(id, a, 1);
    await submit(id, a);
    const b = await join(id, await invite(id, a));
    await save(id, b, 5);
    const mine = await client()
      .get(`/api/v1/sessions/${id}`)
      .set("Cookie", a)
      .expect(200);
    expect(Object.values(mine.body.answers)).toEqual(Array(12).fill(1));
    await client()
      .get(`/api/v1/sessions/${id}/pair-result`)
      .set("Cookie", a)
      .expect(409);
    await Promise.all([submit(id, b), submit(id, b)]).then((rs) =>
      rs.forEach((r) => expect(r.status).toBe(200)),
    );
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM result_snapshots WHERE session_id=$1",
            [id],
          )
        )[0].count,
      ),
    ).toBe(1);
    const r = await client()
      .get(`/api/v1/sessions/${id}/pair-result`)
      .set("Cookie", a)
      .expect(200);
    expect(r.body.items).toHaveLength(12);
    expect(r.body.freePrompts).toHaveLength(2);
    expect(JSON.stringify(r.body)).not.toContain("agreement");
    expect(r.body.cards).toBeUndefined();
    const rb = await client()
      .get(`/api/v1/sessions/${id}/pair-result`)
      .set("Cookie", b)
      .expect(200);
    expect(rb.body.items).toEqual(r.body.items);
    await client()
      .get(`/api/v1/sessions/${id}/premium-report`)
      .set("Cookie", a)
      .expect(403);
  });
  it("serializes A/B orders, verifies gateway data, grants both people once, and revokes on refund", async () => {
    const { id, a, b } = await pair();
    const ids = await Promise.all([order(id, a), order(id, b)]);
    expect(ids[0]).toBe(ids[1]);
    const oid = ids[0];
    await client()
      .post("/api/v1/payments/confirm")
      .set(headers)
      .set("Cookie", a)
      .send({ orderId: oid, status: "PAID", amount: 1 })
      .expect(400);
    const pending = await client()
      .post("/api/v1/payments/confirm")
      .set(headers)
      .set("Cookie", a)
      .send({ orderId: oid })
      .expect(200);
    expect(pending.body.status).toBe("PENDING");
    await client()
      .get(`/api/v1/sessions/${id}/premium-report`)
      .set("Cookie", b)
      .expect(403);
    const results = await Promise.all([
      simulate(oid, a, "PAID"),
      simulate(oid, b, "PAID"),
    ]);
    results.forEach((r) => expect(r.status).toBe(200));
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM entitlements WHERE session_id=$1 AND status='ACTIVE'",
            [id],
          )
        )[0].count,
      ),
    ).toBe(1);
    for (const c of [a, b]) {
      const r = await client()
        .get(`/api/v1/sessions/${id}/premium-report`)
        .set("Cookie", c)
        .expect(200);
      expect(r.body.cards).toHaveLength(5);
      expect(
        r.body.cards.flatMap((card: { prompts: string[] }) => card.prompts),
      ).toHaveLength(10);
    }
    await client()
      .post(`/api/v1/sessions/${id}/orders`)
      .set(headers)
      .set("Cookie", b)
      .send({})
      .expect(409);
    await simulate(oid, a, "REFUNDED").then((r) => expect(r.status).toBe(200));
    await client()
      .get(`/api/v1/sessions/${id}/premium-report`)
      .set("Cookie", b)
      .expect(403);
    await client()
      .get(`/api/v1/sessions/${id}/pair-result`)
      .set("Cookie", b)
      .expect(200);
  });
  it("rejects forged gateway amount, supports failure/retry and ignores unsigned or stale webhooks", async () => {
    const { id, a } = await pair();
    let oid = await order(id, a);
    await db.query(
      "UPDATE mock_gateway_transactions SET amount_krw=1 WHERE order_id=$1",
      [oid],
    );
    await client()
      .post("/api/v1/payments/confirm")
      .set(headers)
      .set("Cookie", a)
      .send({ orderId: oid })
      .expect(400);
    await db.query(
      "UPDATE mock_gateway_transactions SET amount_krw=3900 WHERE order_id=$1",
      [oid],
    );
    await simulate(oid, a, "FAILED").then((r) =>
      expect(r.body.status).toBe("FAILED"),
    );
    oid = await order(id, a);
    await client()
      .post("/api/v1/payments/webhook/mock")
      .send({ orderId: oid })
      .expect(401);
    const payload = JSON.stringify({ orderId: oid });
    const timestamp = String(Date.now());
    const signature = createHmac("sha256", settings().pepper)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    await db.query(
      "UPDATE mock_gateway_transactions SET status='PAID' WHERE order_id=$1",
      [oid],
    );
    for (let i = 0; i < 2; i++)
      await client()
        .post("/api/v1/payments/webhook/mock")
        .set("Content-Type", "application/json")
        .set("X-Mock-Timestamp", timestamp)
        .set("X-Mock-Signature", signature)
        .send(payload)
        .expect(200);
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM payment_events WHERE order_id=$1",
            [oid],
          )
        )[0].count,
      ),
    ).toBe(1);
    await client()
      .post("/api/v1/payments/webhook/mock")
      .set("X-Mock-Timestamp", String(Date.now() - 360000))
      .set("X-Mock-Signature", signature)
      .send({ orderId: oid })
      .expect(401);
  });
  it("requires result view for feedback, updates rather than duplicates, and deletes both participants data", async () => {
    const { id, a, b } = await pair();
    const path = `/api/v1/sessions/${id}/feedback`;
    await client()
      .put(path)
      .set(headers)
      .set("Cookie", a)
      .send({ scope: "FREE", usedForConversation: "YES", helpful: "YES" })
      .expect(409);
    await client()
      .get(`/api/v1/sessions/${id}/pair-result`)
      .set("Cookie", a)
      .expect(200);
    await client()
      .put(path)
      .set(headers)
      .set("Cookie", a)
      .send({ scope: "FREE", usedForConversation: "YES", helpful: "YES" })
      .expect(200);
    await client()
      .put(path)
      .set(headers)
      .set("Cookie", a)
      .send({ scope: "FREE", usedForConversation: "NOT_YET", helpful: null })
      .expect(200);
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM session_feedback WHERE session_id=$1",
            [id],
          )
        )[0].count,
      ),
    ).toBe(1);
    await client()
      .put(path)
      .set(headers)
      .set("Cookie", b)
      .send({ scope: "PREMIUM", usedForConversation: "YES", helpful: "YES" })
      .expect(409);
    await client()
      .post(`/api/v1/sessions/${id}/delete`)
      .set(headers)
      .set("Cookie", a)
      .send({ confirm: "DELETE_PAIR" })
      .expect(200);
    await client().get(`/api/v1/sessions/${id}`).set("Cookie", b).expect(404);
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM participants WHERE session_id=$1",
            [id],
          )
        )[0].count,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM result_snapshots WHERE session_id=$1",
            [id],
          )
        )[0].count,
      ),
    ).toBe(0);
    expect(
      Number(
        (
          await db.query(
            "SELECT count(*) FROM session_feedback WHERE session_id=$1",
            [id],
          )
        )[0].count,
      ),
    ).toBe(0);
  });
  it("rejects expired sessions and analytics payloads containing answers or tokens", async () => {
    const { id, cookie } = await create();
    await client()
      .post("/api/v1/analytics/events")
      .set(headers)
      .send({
        eventName: "landing_viewed",
        answers: { Q01: 1 },
        token: "secret",
      })
      .expect(400);
    await client()
      .post("/api/v1/analytics/events")
      .set(headers)
      .send({ eventName: "payment_succeeded" })
      .expect(400);
    await db.query(
      "UPDATE couple_sessions SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [id],
    );
    await client()
      .get(`/api/v1/sessions/${id}`)
      .set("Cookie", cookie)
      .expect(410);
  });
});
