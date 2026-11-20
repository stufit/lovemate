import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { DataSource, type EntityManager } from "typeorm";
import {
  QUESTIONS,
  VERSION,
  PRICE_KRW,
  answerLabel,
  answerPayloadSchema,
  participantSchema,
  feedbackSchema,
  type Answers,
} from "@woorisai/shared";
import { settings } from "./config";
import { rows } from "./db/data-source";
import { AppError, ensure } from "./domain/errors";
import { createReport } from "./domain/report";
import { MockGateway, type PaymentStatus } from "./domain/payment";

export interface Session {
  id: string;
  status: string;
  survey_version: string;
  algorithm_version: string;
  content_version: string;
  invite_token_hash: string | null;
  invite_expires_at: Date | null;
  expires_at: Date;
  deleted_at: Date | null;
}
interface Participant {
  id: string;
  session_id: string;
  slot: "A" | "B";
  nickname: string;
  submitted_at: Date | null;
  free_result_viewed_at: Date | null;
  premium_report_viewed_at: Date | null;
}
interface Order {
  id: string;
  session_id: string;
  status: PaymentStatus;
  amount_krw: number;
  provider: string;
  provider_payment_id: string | null;
  paid_at: Date | null;
}
interface Snapshot {
  id: string;
  free_report_json: ReturnType<typeof freePayload>;
  premium_report_json: {
    cards: ReturnType<typeof createReport>["cards"];
    contentVersion: string;
  };
  generated_at: Date;
}
const PRODUCT = "PAIR_DEEP_REPORT_V1";
function freePayload(
  report: ReturnType<typeof createReport>,
  aName: string,
  bName: string,
) {
  return {
    surveyVersion: report.surveyVersion,
    algorithmVersion: report.algorithmVersion,
    contentVersion: report.contentVersion,
    items: report.items,
    freePrompts: report.freePrompts,
    topicGroups: report.topicGroups,
    aName,
    bName,
  };
}
export class LabService {
  readonly config = settings();
  readonly gateway = new MockGateway();
  constructor(readonly db: DataSource) {}
  hash(value: string) {
    return createHmac("sha256", this.config.pepper).update(value).digest("hex");
  }
  token() {
    return randomBytes(32).toString("base64url");
  }
  async event(
    m: EntityManager,
    name: string,
    sessionId: string | null,
    props: Record<string, string> = {},
  ) {
    await m.query(
      "INSERT INTO analytics_events(id,event_name,session_id,properties_json) VALUES($1,$2,$3,$4)",
      [randomUUID(), name, sessionId, { environment: "local", ...props }],
    );
  }
  private assertSession(s: Session | undefined): asserts s is Session {
    ensure(
      s && !s.deleted_at && s.status !== "DELETED",
      "SESSION_NOT_FOUND",
      404,
      "이 결과를 찾을 수 없어요.",
    );
    ensure(
      new Date(s.expires_at).getTime() > Date.now(),
      "SESSION_EXPIRED",
      410,
      "이 링크의 보관 기간이 지났어요. 새로 시작해주세요.",
    );
    ensure(
      s.survey_version === VERSION &&
        s.algorithm_version === VERSION &&
        s.content_version === VERSION,
      "SURVEY_VERSION_MISMATCH",
      409,
      "이 버전의 결과는 현재 열 수 없어요.",
    );
  }
  async authorized(
    m: EntityManager,
    id: string,
    token: string | undefined,
    lock = false,
  ) {
    ensure(
      token,
      "UNAUTHORIZED_PARTICIPANT",
      401,
      "이 브라우저에서 참여한 기록이 없어요. 참여했던 브라우저로 다시 열어주세요.",
    );
    const [s] = await rows<Session>(
      m,
      `SELECT * FROM couple_sessions WHERE id=$1 ${lock ? "FOR UPDATE" : ""}`,
      [id],
    );
    this.assertSession(s);
    const [p] = await rows<Participant>(
      m,
      "SELECT * FROM participants WHERE session_id=$1 AND access_token_hash=$2",
      [id, this.hash(token)],
    );
    ensure(
      p,
      "UNAUTHORIZED_PARTICIPANT",
      401,
      "이 브라우저에서 참여한 기록이 없어요.",
    );
    return { s, p };
  }
  async active(m: EntityManager, id: string) {
    const r = await m.query(
      "SELECT 1 FROM entitlements WHERE session_id=$1 AND status='ACTIVE'",
      [id],
    );
    return r.length > 0;
  }
  private async myAnswers(m: EntityManager, pid: string): Promise<Answers> {
    const a = await rows<{ question_id: string; value: number }>(
      m,
      "SELECT question_id,value FROM survey_answers WHERE participant_id=$1",
      [pid],
    );
    return Object.fromEntries(
      a.map((x) => [x.question_id, x.value]),
    ) as Answers;
  }
  async create(body: unknown) {
    const input = participantSchema.parse(body);
    const token = this.token();
    const id = randomUUID();
    await this.db.transaction(async (m) => {
      await m.query(
        "INSERT INTO couple_sessions(id,survey_version,algorithm_version,content_version) VALUES($1,$2,$2,$2)",
        [id, VERSION],
      );
      await m.query(
        "INSERT INTO participants(id,session_id,slot,nickname,access_token_hash) VALUES($1,$2,'A',$3,$4)",
        [randomUUID(), id, input.nickname, this.hash(token)],
      );
      await this.event(m, "test_started", id);
    });
    return { sessionId: id, token };
  }
  async getSession(id: string, token: string | undefined) {
    return this.db.transaction(async (m) => {
      const { s, p } = await this.authorized(m, id, token);
      const partners = await rows<Participant>(
        m,
        "SELECT id,slot,submitted_at FROM participants WHERE session_id=$1 AND id<>$2",
        [id, p.id],
      );
      return {
        sessionId: id,
        status: s.status,
        mySlot: p.slot,
        nickname: p.nickname,
        submitted: !!p.submitted_at,
        partnerJoined: partners.length > 0,
        pairCompleted: s.status === "PAIR_COMPLETED",
        surveyVersion: s.survey_version,
        answers: await this.myAnswers(m, p.id),
        hasPremiumAccess: await this.active(m, id),
      };
    });
  }
  async rotateInvite(id: string, token: string | undefined) {
    return this.db.transaction(async (m) => {
      const { s, p } = await this.authorized(m, id, token, true);
      ensure(
        p.slot === "A" && p.submitted_at,
        "INVITE_NOT_READY",
        409,
        "먼저 내 질문을 완료해주세요.",
      );
      const b = await m.query(
        "SELECT 1 FROM participants WHERE session_id=$1 AND slot='B'",
        [id],
      );
      ensure(!b.length, "PARTNER_SLOT_TAKEN", 409, "상대가 이미 참여했어요.");
      const invite = this.token();
      await m.query(
        "UPDATE couple_sessions SET invite_token_hash=$2,invite_expires_at=expires_at,updated_at=now() WHERE id=$1",
        [id, this.hash(invite)],
      );
      return {
        inviteUrl: `${this.config.webUrl}/s/${id}/join?invite=${invite}`,
        expiresAt: s.expires_at,
      };
    });
  }
  async preview(invite: string) {
    ensure(
      invite.length >= 40 && invite.length <= 100,
      "INVITE_INVALID",
      404,
      "올바르지 않은 초대 링크예요.",
    );
    const [s] = await rows<Session>(
      this.db.manager,
      "SELECT * FROM couple_sessions WHERE invite_token_hash=$1",
      [this.hash(invite)],
    );
    this.assertSession(s);
    ensure(
      s.invite_expires_at &&
        new Date(s.invite_expires_at).getTime() > Date.now(),
      "INVITE_EXPIRED",
      410,
      "초대 링크가 만료되었어요.",
    );
    const b = await this.db.query(
      "SELECT 1 FROM participants WHERE session_id=$1 AND slot='B'",
      [s.id],
    );
    return { canJoin: !b.length && s.status === "WAITING_FOR_PARTNER" };
  }
  async join(id: string, invite: string, body: unknown) {
    const input = participantSchema.parse(body);
    const token = this.token();
    await this.db.transaction(async (m) => {
      const [s] = await rows<Session>(
        m,
        "SELECT * FROM couple_sessions WHERE id=$1 FOR UPDATE",
        [id],
      );
      this.assertSession(s);
      ensure(
        s.invite_token_hash === this.hash(invite),
        "INVITE_INVALID",
        404,
        "초대 링크를 다시 확인해주세요.",
      );
      ensure(
        s.invite_expires_at &&
          new Date(s.invite_expires_at).getTime() > Date.now(),
        "INVITE_EXPIRED",
        410,
      );
      const b = await m.query(
        "SELECT 1 FROM participants WHERE session_id=$1 AND slot='B'",
        [id],
      );
      ensure(
        !b.length,
        "PARTNER_SLOT_TAKEN",
        409,
        "상대 참여가 이미 시작되었어요. 참여한 브라우저에서 계속해주세요.",
      );
      ensure(s.status === "WAITING_FOR_PARTNER", "INVITE_NOT_READY", 409);
      await m.query(
        "INSERT INTO participants(id,session_id,slot,nickname,access_token_hash) VALUES($1,$2,'B',$3,$4)",
        [randomUUID(), id, input.nickname, this.hash(token)],
      );
      await this.event(m, "partner_joined", id);
    });
    return { sessionId: id, token };
  }
  async saveAnswers(id: string, token: string | undefined, body: unknown) {
    const input = answerPayloadSchema.parse(body);
    return this.db.transaction(async (m) => {
      const { p } = await this.authorized(m, id, token, true);
      ensure(
        !p.submitted_at,
        "ANSWERS_LOCKED",
        409,
        "제출한 답변은 수정할 수 없어요.",
      );
      for (const a of input.answers)
        await m.query(
          "INSERT INTO survey_answers(participant_id,survey_version,question_id,value) VALUES($1,$2,$3,$4) ON CONFLICT(participant_id,survey_version,question_id) DO UPDATE SET value=EXCLUDED.value,updated_at=now()",
          [p.id, input.surveyVersion, a.questionId, a.value],
        );
      const saved = await this.myAnswers(m, p.id);
      return { savedCount: Object.keys(saved).length };
    });
  }
  async submit(id: string, token: string | undefined) {
    return this.db.transaction(async (m) => {
      const { s, p } = await this.authorized(m, id, token, true);
      if (p.submitted_at)
        return {
          status: s.status,
          pairCompleted: s.status === "PAIR_COMPLETED",
        };
      const answers = await this.myAnswers(m, p.id);
      ensure(
        Object.keys(answers).length === 12,
        "ANSWERS_INCOMPLETE",
        400,
        "12개 질문에 모두 답해주세요.",
      );
      await m.query("UPDATE participants SET submitted_at=now() WHERE id=$1", [
        p.id,
      ]);
      await this.event(m, `survey_submitted_${p.slot.toLowerCase()}`, id);
      const participants = await rows<Participant>(
        m,
        "SELECT * FROM participants WHERE session_id=$1 ORDER BY slot",
        [id],
      );
      const complete =
        participants.length === 2 && participants.every((x) => x.submitted_at);
      if (complete) {
        const [a, b] = participants;
        const aa = await this.myAnswers(m, a.id),
          bb = await this.myAnswers(m, b.id);
        const report = createReport(aa, bb);
        await m.query(
          "INSERT INTO result_snapshots(id,session_id,survey_version,algorithm_version,content_version,answer_snapshot_json,item_comparisons_json,selected_topic_ids_json,guide_composition,free_report_json,premium_report_json) VALUES($1,$2,$3,$3,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(session_id) DO NOTHING",
          [
            randomUUID(),
            id,
            VERSION,
            { a: aa, b: bb },
            JSON.stringify(report.items),
            JSON.stringify(report.selectedQuestionIds),
            report.composition,
            freePayload(report, a.nickname, b.nickname),
            { contentVersion: VERSION, cards: report.cards },
          ],
        );
        await m.query(
          "UPDATE couple_sessions SET status='PAIR_COMPLETED',completed_at=now(),expires_at=now()+interval '90 days',updated_at=now() WHERE id=$1",
          [id],
        );
        await this.event(m, "pair_completed", id);
      } else
        await m.query(
          "UPDATE couple_sessions SET status='WAITING_FOR_PARTNER',updated_at=now() WHERE id=$1",
          [id],
        );
      return {
        status: complete ? "PAIR_COMPLETED" : "WAITING_FOR_PARTNER",
        pairCompleted: complete,
      };
    });
  }
  async personal(id: string, token: string | undefined) {
    return this.db.transaction(async (m) => {
      const { p } = await this.authorized(m, id, token);
      ensure(p.submitted_at, "ANSWERS_INCOMPLETE", 409);
      const a = await this.myAnswers(m, p.id);
      return {
        nickname: p.nickname,
        items: QUESTIONS.map((q) => ({
          questionId: q.id,
          topic: q.topic,
          title: q.title,
          text: q.text,
          label: answerLabel(q, a[q.id]),
        })),
        reflectionPrompt:
          "어떤 상황에서 이 방식이 편했는지, 최근의 경험 하나를 떠올려보세요.",
      };
    });
  }
  async result(id: string, token: string | undefined, premium = false) {
    return this.db.transaction(async (m) => {
      const { s, p } = await this.authorized(m, id, token, true);
      ensure(
        s.status === "PAIR_COMPLETED",
        "PAIR_NOT_COMPLETED",
        409,
        "두 사람이 모두 완료하면 비교 결과를 볼 수 있어요.",
      );
      const active = await this.active(m, id);
      if (premium)
        ensure(
          active,
          "PREMIUM_REQUIRED",
          403,
          "대화 가이드 구매 후 열 수 있어요.",
        );
      const [snapshot] = await rows<Snapshot>(
        m,
        "SELECT * FROM result_snapshots WHERE session_id=$1",
        [id],
      );
      ensure(snapshot, "RESULT_NOT_READY", 409);
      const field = premium
        ? "premium_report_viewed_at"
        : "free_result_viewed_at";
      if (!p[field]) {
        await m.query(`UPDATE participants SET ${field}=now() WHERE id=$1`, [
          p.id,
        ]);
        await this.event(
          m,
          premium ? "premium_report_viewed" : "free_result_viewed",
          id,
        );
      }
      if (premium)
        return {
          sessionId: id,
          ...snapshot.premium_report_json,
          generatedAt: snapshot.generated_at,
        };
      return {
        sessionId: id,
        ...snapshot.free_report_json,
        hasPremiumAccess: active,
      };
    });
  }
  private orderView(o: Order) {
    return {
      orderId: o.id,
      sessionId: o.session_id,
      status: o.status,
      amount: o.amount_krw,
      provider: o.provider,
      paidAt: o.paid_at,
    };
  }
  async createOrder(id: string, token: string | undefined) {
    return this.db.transaction(async (m) => {
      const { s, p } = await this.authorized(m, id, token, true);
      ensure(s.status === "PAIR_COMPLETED", "PAIR_NOT_COMPLETED", 409);
      const paid = await m.query(
        "SELECT 1 FROM orders WHERE session_id=$1 AND status IN ('PAID','REFUNDED')",
        [id],
      );
      ensure(
        !paid.length,
        "ORDER_ALREADY_PAID",
        409,
        "이미 구매한 가이드예요. 환불 후 재구매는 지원하지 않아요.",
      );
      const [pending] = await rows<Order>(
        m,
        "SELECT * FROM orders WHERE session_id=$1 AND status='PENDING'",
        [id],
      );
      if (pending) return this.orderView(pending);
      const orderId = randomUUID();
      await m.query(
        "INSERT INTO orders(id,session_id,buyer_participant_id,product_code,amount_krw,provider,idempotency_key) VALUES($1,$2,$3,$4,$5,'mock',$6)",
        [orderId, id, p.id, PRODUCT, PRICE_KRW, randomUUID()],
      );
      const gateway = await this.gateway.createCheckout(m, orderId);
      await m.query("UPDATE orders SET provider_payment_id=$2 WHERE id=$1", [
        orderId,
        gateway.providerPaymentId,
      ]);
      await this.event(m, "checkout_started", id);
      const [order] = await rows<Order>(m, "SELECT * FROM orders WHERE id=$1", [
        orderId,
      ]);
      return this.orderView(order);
    });
  }
  async getOrder(orderId: string, token: string | undefined) {
    const [o] = await rows<Order>(
      this.db.manager,
      "SELECT * FROM orders WHERE id=$1",
      [orderId],
    );
    ensure(o, "ORDER_NOT_FOUND", 404);
    await this.authorized(this.db.manager, o.session_id, token);
    return this.orderView(o);
  }
  async orderSession(orderId: string) {
    const [o] = await rows<Order>(
      this.db.manager,
      "SELECT * FROM orders WHERE id=$1",
      [orderId],
    );
    ensure(o, "ORDER_NOT_FOUND", 404);
    return o.session_id;
  }
  private async settle(m: EntityManager, orderId: string) {
    const [o] = await rows<Order>(
      m,
      "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
      [orderId],
    );
    ensure(o, "ORDER_NOT_FOUND", 404);
    const tx = await this.gateway.verifyOrConfirm(m, orderId);
    ensure(
      tx.order_id === o.id &&
        tx.amount_krw === PRICE_KRW &&
        tx.currency === "KRW" &&
        tx.provider_payment_id === o.provider_payment_id,
      "PAYMENT_VERIFICATION_FAILED",
      400,
      "결제 검증에 실패했어요.",
    );
    if (tx.status === "PENDING") return this.orderView(o);
    if (o.status === "REFUNDED" || o.status === tx.status)
      return this.orderView(o);
    ensure(
      o.status === "PENDING" ||
        (o.status === "PAID" && tx.status === "REFUNDED"),
      "PAYMENT_STATE_CONFLICT",
      409,
    );
    const eventId = `${tx.provider_payment_id}:${tx.status}`;
    await m.query(
      "INSERT INTO payment_events(id,provider,provider_event_id,order_id,event_type) VALUES($1,'mock',$2,$3,$4) ON CONFLICT(provider,provider_event_id) DO NOTHING",
      [randomUUID(), eventId, o.id, tx.status],
    );
    await m.query(
      "UPDATE orders SET status=$2,paid_at=CASE WHEN $2='PAID' THEN now() ELSE paid_at END,refunded_at=CASE WHEN $2='REFUNDED' THEN now() ELSE refunded_at END WHERE id=$1",
      [o.id, tx.status],
    );
    if (tx.status === "PAID")
      await m.query(
        "INSERT INTO entitlements(id,session_id,product_code,source_order_id,status) VALUES($1,$2,$3,$4,'ACTIVE') ON CONFLICT(source_order_id) DO NOTHING",
        [randomUUID(), o.session_id, PRODUCT, o.id],
      );
    if (tx.status === "REFUNDED")
      await m.query(
        "UPDATE entitlements SET status='REVOKED',revoked_at=now() WHERE source_order_id=$1",
        [o.id],
      );
    await this.event(
      m,
      tx.status === "PAID"
        ? "payment_succeeded"
        : tx.status === "REFUNDED"
          ? "payment_refunded"
          : "payment_failed",
      o.session_id,
    );
    const [updated] = await rows<Order>(m, "SELECT * FROM orders WHERE id=$1", [
      o.id,
    ]);
    return this.orderView(updated);
  }
  async confirm(orderId: string, token: string | undefined) {
    const id = await this.orderSession(orderId);
    return this.db.transaction(async (m) => {
      await this.authorized(m, id, token, true);
      return this.settle(m, orderId);
    });
  }
  async simulate(
    orderId: string,
    token: string | undefined,
    outcome: PaymentStatus,
  ) {
    ensure(!this.config.production, "MOCK_DISABLED", 404);
    const id = await this.orderSession(orderId);
    return this.db.transaction(async (m) => {
      await this.authorized(m, id, token, true);
      const [o] = await rows<Order>(
        m,
        "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
        [orderId],
      );
      ensure(
        o.status === "PENDING" ||
          o.status === outcome ||
          (o.status === "PAID" && outcome === "REFUNDED"),
        "PAYMENT_STATE_CONFLICT",
        409,
      );
      await m.query(
        "UPDATE mock_gateway_transactions SET status=$2 WHERE order_id=$1",
        [orderId, outcome],
      );
      return this.settle(m, orderId);
    });
  }
  async webhook(
    body: Buffer,
    signature: string | undefined,
    timestamp: string | undefined,
  ) {
    ensure(
      timestamp &&
        /^\d{13}$/.test(timestamp) &&
        Math.abs(Date.now() - Number(timestamp)) < 300000,
      "WEBHOOK_EXPIRED",
      401,
    );
    const expected = createHmac("sha256", this.config.pepper)
      .update(`${timestamp}.`)
      .update(body)
      .digest("hex");
    ensure(
      signature &&
        /^[a-f0-9]{64}$/.test(signature) &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected)),
      "WEBHOOK_INVALID",
      401,
    );
    let payload: unknown;
    try {
      payload = JSON.parse(body.toString());
    } catch {
      throw new AppError("INVALID_JSON");
    }
    const { z } = await import("zod");
    const { orderId } = z.object({ orderId: z.uuid() }).strict().parse(payload);
    const id = await this.orderSession(orderId);
    await this.db.transaction(async (m) => {
      const [s] = await rows<Session>(
        m,
        "SELECT * FROM couple_sessions WHERE id=$1 FOR UPDATE",
        [id],
      );
      this.assertSession(s);
      await this.settle(m, orderId);
    });
    return { received: true };
  }
  async feedback(id: string, token: string | undefined, body: unknown) {
    const input = feedbackSchema.parse(body);
    return this.db.transaction(async (m) => {
      const { p } = await this.authorized(m, id, token, true);
      ensure(
        input.scope === "FREE"
          ? p.free_result_viewed_at
          : p.premium_report_viewed_at,
        "RESULT_NOT_VIEWED",
        409,
      );
      if (input.scope === "PREMIUM")
        ensure(await this.active(m, id), "PREMIUM_REQUIRED", 403);
      const [snapshot] = await rows<{ id: string }>(
        m,
        "SELECT id FROM result_snapshots WHERE session_id=$1",
        [id],
      );
      ensure(snapshot, "PAIR_NOT_COMPLETED", 409);
      await m.query(
        "INSERT INTO session_feedback(id,session_id,participant_id,result_snapshot_id,scope,used_for_conversation,helpful) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(participant_id,result_snapshot_id,scope) DO UPDATE SET used_for_conversation=EXCLUDED.used_for_conversation,helpful=EXCLUDED.helpful,updated_at=now()",
        [
          randomUUID(),
          id,
          p.id,
          snapshot.id,
          input.scope,
          input.usedForConversation,
          input.helpful,
        ],
      );
      await this.event(m, "feedback_saved", id, { scope: input.scope });
      return { saved: true, scope: input.scope };
    });
  }
  async deleteSession(id: string, token: string | undefined) {
    return this.db.transaction(async (m) => {
      await this.authorized(m, id, token, true);
      await m.query("DELETE FROM result_snapshots WHERE session_id=$1", [id]);
      await m.query(
        "UPDATE orders SET buyer_participant_id=NULL WHERE session_id=$1",
        [id],
      );
      await m.query("DELETE FROM participants WHERE session_id=$1", [id]);
      await m.query("DELETE FROM analytics_events WHERE session_id=$1", [id]);
      await m.query(
        "UPDATE couple_sessions SET status='DELETED',deleted_at=now(),invite_token_hash=NULL,invite_expires_at=NULL WHERE id=$1",
        [id],
      );
      await m.query(
        "UPDATE entitlements SET status='REVOKED',revoked_at=now() WHERE session_id=$1",
        [id],
      );
      return {
        deleted: true,
        scope: "PAIR",
        message:
          "두 사람의 답변과 결과가 삭제되었어요. 모의 거래 내역은 별도로 남아요.",
      };
    });
  }
}
