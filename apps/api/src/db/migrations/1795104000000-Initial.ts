import type { MigrationInterface, QueryRunner } from "typeorm";
export class Initial1795104000000 implements MigrationInterface {
  name = "Initial1795104000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE couple_sessions (
        id uuid PRIMARY KEY, status text NOT NULL DEFAULT 'WAITING_FOR_FIRST' CHECK(status IN ('WAITING_FOR_FIRST','WAITING_FOR_PARTNER','PAIR_COMPLETED','EXPIRED','DELETED')),
        survey_version text NOT NULL, algorithm_version text NOT NULL, content_version text NOT NULL,
        invite_token_hash text UNIQUE, invite_expires_at timestamptz,
        expires_at timestamptz NOT NULL DEFAULT now()+interval '14 days', completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
      );
      CREATE TABLE participants (
        id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES couple_sessions(id), slot text NOT NULL CHECK(slot IN ('A','B')),
        nickname varchar(30) NOT NULL, access_token_hash text NOT NULL UNIQUE,
        joined_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
        free_result_viewed_at timestamptz, premium_report_viewed_at timestamptz,
        UNIQUE(session_id,slot)
      );
      CREATE TABLE survey_questions (
        id text NOT NULL, survey_version text NOT NULL, dimension text NOT NULL, display_order int NOT NULL,
        text_ko text NOT NULL, left_label text NOT NULL, right_label text NOT NULL,
        is_active boolean NOT NULL DEFAULT true, PRIMARY KEY(survey_version,id)
      );
      CREATE TABLE survey_answers (
        participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        survey_version text NOT NULL, question_id text NOT NULL, value smallint NOT NULL CHECK(value BETWEEN 1 AND 5),
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(participant_id,survey_version,question_id),
        FOREIGN KEY(survey_version,question_id) REFERENCES survey_questions(survey_version,id)
      );
      CREATE TABLE result_snapshots (
        id uuid PRIMARY KEY, session_id uuid NOT NULL UNIQUE REFERENCES couple_sessions(id),
        survey_version text NOT NULL, algorithm_version text NOT NULL, content_version text NOT NULL,
        answer_snapshot_json jsonb NOT NULL, item_comparisons_json jsonb NOT NULL,
        selected_topic_ids_json jsonb NOT NULL, guide_composition text NOT NULL,
        free_report_json jsonb NOT NULL, premium_report_json jsonb NOT NULL,
        generated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE orders (
        id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES couple_sessions(id), buyer_participant_id uuid REFERENCES participants(id) ON DELETE SET NULL,
        product_code text NOT NULL, amount_krw int NOT NULL CHECK(amount_krw=3900), currency text NOT NULL DEFAULT 'KRW' CHECK(currency='KRW'),
        status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PAID','FAILED','CANCELED','REFUNDED')),
        provider text NOT NULL, provider_payment_id text, idempotency_key uuid NOT NULL UNIQUE,
        paid_at timestamptz, refunded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(provider,provider_payment_id)
      );
      CREATE UNIQUE INDEX one_pending_order ON orders(session_id,product_code) WHERE status='PENDING';
      CREATE TABLE entitlements (
        id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES couple_sessions(id), product_code text NOT NULL,
        source_order_id uuid NOT NULL UNIQUE REFERENCES orders(id), status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
        granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
      );
      CREATE UNIQUE INDEX one_active_entitlement ON entitlements(session_id,product_code) WHERE status='ACTIVE';
      CREATE TABLE payment_events (
        id uuid PRIMARY KEY, provider text NOT NULL, provider_event_id text NOT NULL,
        order_id uuid NOT NULL REFERENCES orders(id), event_type text NOT NULL, processed_at timestamptz NOT NULL DEFAULT now(),
        payload_redacted_json jsonb NOT NULL DEFAULT '{}', UNIQUE(provider,provider_event_id)
      );
      CREATE TABLE mock_gateway_transactions (
        order_id uuid PRIMARY KEY REFERENCES orders(id), provider_payment_id text NOT NULL UNIQUE,
        amount_krw int NOT NULL, currency text NOT NULL, status text NOT NULL CHECK(status IN ('PENDING','PAID','FAILED','CANCELED','REFUNDED'))
      );
      CREATE TABLE session_feedback (
        id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES couple_sessions(id), participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        result_snapshot_id uuid NOT NULL REFERENCES result_snapshots(id) ON DELETE CASCADE,
        scope text NOT NULL CHECK(scope IN ('FREE','PREMIUM')), used_for_conversation text NOT NULL CHECK(used_for_conversation IN ('YES','NOT_YET','NO')),
        helpful text CHECK(helpful IN ('YES','NO')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK((used_for_conversation='YES' AND helpful IS NOT NULL) OR (used_for_conversation<>'YES' AND helpful IS NULL)),
        UNIQUE(participant_id,result_snapshot_id,scope)
      );
      CREATE TABLE analytics_events (
        id uuid PRIMARY KEY, event_name text NOT NULL, anonymous_visitor_id text, session_id uuid REFERENCES couple_sessions(id),
        occurred_at timestamptz NOT NULL DEFAULT now(), properties_json jsonb NOT NULL DEFAULT '{}'
      );
      CREATE INDEX events_by_session ON analytics_events(session_id,event_name);
      CREATE INDEX sessions_expiry ON couple_sessions(expires_at) WHERE deleted_at IS NULL;
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      "DROP TABLE analytics_events,session_feedback,mock_gateway_transactions,payment_events,entitlements,orders,result_snapshots,survey_answers,survey_questions,participants,couple_sessions CASCADE",
    );
  }
}
