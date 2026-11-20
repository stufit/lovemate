import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import { PRICE_KRW } from "@woorisai/shared";
import { rows } from "../db/data-source";
import { ensure } from "./errors";
export type PaymentStatus =
  "PENDING" | "PAID" | "FAILED" | "CANCELED" | "REFUNDED";
export interface GatewayTransaction {
  order_id: string;
  provider_payment_id: string;
  amount_krw: number;
  currency: string;
  status: PaymentStatus;
}
export interface PaymentGateway {
  createCheckout(
    m: EntityManager,
    orderId: string,
  ): Promise<{ providerPaymentId: string }>;
  verifyOrConfirm(
    m: EntityManager,
    orderId: string,
  ): Promise<GatewayTransaction>;
}
/** Local simulator only. Browser callbacks never supply verified payment status or amount. */
export class MockGateway implements PaymentGateway {
  async createCheckout(m: EntityManager, orderId: string) {
    const providerPaymentId = `mock_${randomUUID()}`;
    await m.query(
      "INSERT INTO mock_gateway_transactions(order_id,provider_payment_id,amount_krw,currency,status) VALUES($1,$2,$3,$4,$5)",
      [orderId, providerPaymentId, PRICE_KRW, "KRW", "PENDING"],
    );
    return { providerPaymentId };
  }
  async verifyOrConfirm(m: EntityManager, orderId: string) {
    const [tx] = await rows<GatewayTransaction>(
      m,
      "SELECT * FROM mock_gateway_transactions WHERE order_id=$1",
      [orderId],
    );
    ensure(tx, "PAYMENT_VERIFICATION_FAILED", 400);
    return tx;
  }
}
