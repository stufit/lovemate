import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import expressLibrary, {
  type Request,
  type Response,
  type NextFunction,
  type Express,
} from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { DataSource } from "typeorm";
import { QUESTIONS, VERSION } from "@woorisai/shared";
import { settings } from "./config";
import { createDataSource } from "./db/data-source";
import { LabService } from "./service";
import { AppError, ensure } from "./domain/errors";
import { sampleReport } from "./domain/report";

class ApplicationModule {}
Module({})(ApplicationModule);
export const cookieName = (sessionId: string) => `woorisai_${sessionId}`;
export async function createApplication(provided?: DataSource) {
  const config = settings();
  const db = provided ?? createDataSource();
  if (!db.isInitialized) await db.initialize();
  const app = await NestFactory.create<NestExpressApplication>(
    ApplicationModule,
    { bodyParser: false, logger: false },
  );
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use(
    expressLibrary.json({
      limit: "24kb",
      verify: (req, _res, buffer) => {
        (req as Request & { rawBody: Buffer }).rawBody = buffer;
      },
    }),
  );
  const express = app.getHttpAdapter().getInstance() as Express;
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Request-Id", randomUUID());
    if (
      ["POST", "PUT", "DELETE", "PATCH"].includes(req.method) &&
      !req.path.startsWith("/api/v1/payments/webhook/")
    ) {
      const allowed = new Set([
        config.webUrl,
        new URL(config.webUrl).origin.replace("localhost", "127.0.0.1"),
      ]);
      if (
        !req.headers.origin ||
        !allowed.has(req.headers.origin) ||
        req.headers["x-woorisai-request"] !== "1"
      )
        return res.status(403).json({
          code: "CSRF_REJECTED",
          message: "페이지를 새로고침하고 다시 시도해주세요.",
          requestId: res.getHeader("X-Request-Id"),
        });
    }
    next();
  });
  const service = new LabService(db);
  const limits = new Map<string, { count: number; until: number }>();
  const handler =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        if (req.method !== "GET") {
          const now = Date.now();
          if (limits.size > 5000)
            for (const [key, value] of limits)
              if (value.until < now) limits.delete(key);
          const key = `${req.ip}:${req.path.includes("/payments/") ? "payment" : "write"}`;
          const bucket = limits.get(key);
          const current =
            !bucket || bucket.until < now
              ? { count: 0, until: now + 60000 }
              : bucket;
          current.count++;
          limits.set(key, current);
          ensure(
            current.count <= 300,
            "RATE_LIMITED",
            429,
            "잠시 후 다시 시도해주세요.",
          );
        }
        const result = await fn(req, res);
        if (!res.headersSent) res.json(result);
      } catch (error) {
        const known = error instanceof AppError;
        const validation = error instanceof ZodError;
        const code = known
          ? error.code
          : validation
            ? "INVALID_INPUT"
            : "INTERNAL_ERROR";
        res.status(known ? error.status : validation ? 400 : 500).json({
          code,
          message: known
            ? error.message
            : validation
              ? "입력한 내용과 동의를 다시 확인해주세요."
              : "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
          requestId: res.getHeader("X-Request-Id"),
        });
        // Deliberately exclude raw request/body/tokens/query/error details from logs.
        if (!known && !validation)
          console.error(
            JSON.stringify({ code, requestId: res.getHeader("X-Request-Id") }),
          );
      }
    };
  const id = (req: Request) => z.uuid().parse(req.params.id);
  const token = (req: Request, sid: string) =>
    req.cookies?.[cookieName(sid)] as string | undefined;
  const issue = (res: Response, sid: string, value: string) =>
    res.cookie(cookieName(sid), value, {
      httpOnly: true,
      secure: config.secure,
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });
  const base = "/api/v1";
  express.get(
    `${base}/health`,
    handler(async () => {
      await db.query("SELECT 1");
      return {
        ok: true,
        payments: "mock",
        customerValidation: "not_performed",
      };
    }),
  );
  express.get(
    `${base}/surveys/current`,
    handler(async () => ({ version: VERSION, questions: QUESTIONS })),
  );
  express.get(
    `${base}/samples/:index`,
    handler(async (req) =>
      sampleReport(
        z.coerce.number().int().min(0).max(2).parse(req.params.index),
      ),
    ),
  );
  express.get(
    `${base}/invites/:invite/preview`,
    handler(async (req) =>
      service.preview(z.string().min(40).max(100).parse(req.params.invite)),
    ),
  );
  express.post(
    `${base}/sessions`,
    handler(async (req, res) => {
      const r = await service.create(req.body);
      issue(res, r.sessionId, r.token);
      res.status(201);
      return { sessionId: r.sessionId };
    }),
  );
  express.get(
    `${base}/sessions/:id`,
    handler(async (req, res) => {
      const sid = id(req);
      const access = token(req, sid);
      const result = await service.getSession(sid, access);
      issue(res, sid, access!);
      return result;
    }),
  );
  express.post(
    `${base}/sessions/:id/join`,
    handler(async (req, res) => {
      const { invite, ...body } = z
        .object({
          invite: z.string().min(40).max(100),
          nickname: z.string(),
          consent: z.boolean(),
          adult: z.boolean(),
        })
        .strict()
        .parse(req.body);
      const r = await service.join(id(req), invite, body);
      issue(res, r.sessionId, r.token);
      res.status(201);
      return { sessionId: r.sessionId };
    }),
  );
  express.post(
    `${base}/sessions/:id/invite/rotate`,
    handler(async (req) => service.rotateInvite(id(req), token(req, id(req)))),
  );
  express.put(
    `${base}/sessions/:id/answers`,
    handler(async (req) =>
      service.saveAnswers(id(req), token(req, id(req)), req.body),
    ),
  );
  express.post(
    `${base}/sessions/:id/submit`,
    handler(async (req) => service.submit(id(req), token(req, id(req)))),
  );
  express.get(
    `${base}/sessions/:id/my-result`,
    handler(async (req) => service.personal(id(req), token(req, id(req)))),
  );
  express.get(
    `${base}/sessions/:id/pair-result`,
    handler(async (req) => service.result(id(req), token(req, id(req)))),
  );
  express.get(
    `${base}/sessions/:id/premium-report`,
    handler(async (req) => service.result(id(req), token(req, id(req)), true)),
  );
  express.post(
    `${base}/sessions/:id/orders`,
    handler(async (req) => service.createOrder(id(req), token(req, id(req)))),
  );
  express.get(
    `${base}/orders/:id`,
    handler(async (req) => {
      const oid = id(req);
      const sid = await service.orderSession(oid);
      return service.getOrder(oid, token(req, sid));
    }),
  );
  express.post(
    `${base}/payments/confirm`,
    handler(async (req) => {
      const { orderId } = z
        .object({ orderId: z.uuid() })
        .strict()
        .parse(req.body);
      const sid = await service.orderSession(orderId);
      return service.confirm(orderId, token(req, sid));
    }),
  );
  express.post(
    `${base}/payments/mock/:id`,
    handler(async (req) => {
      const { outcome } = z
        .object({
          outcome: z.enum([
            "PENDING",
            "PAID",
            "FAILED",
            "CANCELED",
            "REFUNDED",
          ]),
        })
        .strict()
        .parse(req.body);
      const oid = id(req);
      return service.simulate(
        oid,
        token(req, await service.orderSession(oid)),
        outcome,
      );
    }),
  );
  express.post(
    `${base}/payments/webhook/mock`,
    handler(async (req) =>
      service.webhook(
        (req as Request & { rawBody: Buffer }).rawBody,
        req.headers["x-mock-signature"] as string | undefined,
        req.headers["x-mock-timestamp"] as string | undefined,
      ),
    ),
  );
  express.put(
    `${base}/sessions/:id/feedback`,
    handler(async (req) =>
      service.feedback(id(req), token(req, id(req)), req.body),
    ),
  );
  express.post(
    `${base}/sessions/:id/delete`,
    handler(async (req, res) => {
      const sid = id(req);
      const input = z
        .object({ confirm: z.literal("DELETE_PAIR") })
        .strict()
        .parse(req.body);
      void input;
      const r = await service.deleteSession(sid, token(req, sid));
      res.clearCookie(cookieName(sid), { path: "/" });
      return r;
    }),
  );
  const publicEvents = new Set([
    "landing_viewed",
    "sample_viewed",
    "invite_copy_succeeded",
    "invite_share_requested",
    "invite_preview_viewed",
    "premium_cta_clicked",
  ]);
  express.post(
    `${base}/analytics/events`,
    handler(async (req) => {
      const input = z
        .object({
          eventName: z.string(),
          sessionId: z.uuid().optional(),
          visitorId: z.uuid().optional(),
          scope: z.enum(["FREE", "PREMIUM"]).optional(),
        })
        .strict()
        .parse(req.body);
      ensure(publicEvents.has(input.eventName), "EVENT_NOT_ALLOWED");
      if (input.sessionId)
        await service.authorized(
          db.manager,
          input.sessionId,
          token(req, input.sessionId),
        );
      await db.query(
        "INSERT INTO analytics_events(id,event_name,anonymous_visitor_id,session_id,properties_json) VALUES($1,$2,$3,$4,$5)",
        [
          randomUUID(),
          input.eventName,
          input.visitorId ?? null,
          input.sessionId ?? null,
          {
            environment: "local",
            ...(input.scope ? { scope: input.scope } : {}),
          },
        ],
      );
      return { accepted: true };
    }),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      void error;
      res.status(400).json({
        code: "INVALID_BODY",
        message: "요청 형식을 확인해주세요.",
        requestId: randomUUID(),
      });
    },
  );
  await app.init();
  return { app, db, service };
}
