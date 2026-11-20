import { createDataSource } from "./data-source";
/** Run on a schedule in deployment; retain non-personal mock transaction audit separately. */
async function purge() {
  const db = createDataSource();
  await db.initialize();
  try {
    const count = await db.transaction(async (m) => {
      const expired: { id: string }[] = await m.query(
        "SELECT id FROM couple_sessions WHERE expires_at<now() AND deleted_at IS NULL ORDER BY expires_at LIMIT 500 FOR UPDATE SKIP LOCKED",
      );
      for (const { id } of expired) {
        await m.query("DELETE FROM result_snapshots WHERE session_id=$1", [id]);
        await m.query(
          "UPDATE orders SET buyer_participant_id=NULL WHERE session_id=$1",
          [id],
        );
        await m.query("DELETE FROM participants WHERE session_id=$1", [id]);
        await m.query("DELETE FROM analytics_events WHERE session_id=$1", [id]);
        await m.query(
          "UPDATE entitlements SET status='REVOKED',revoked_at=now() WHERE session_id=$1 AND status='ACTIVE'",
          [id],
        );
        await m.query(
          "UPDATE couple_sessions SET status='DELETED',deleted_at=now(),invite_token_hash=NULL,invite_expires_at=NULL WHERE id=$1",
          [id],
        );
      }
      // Public anonymous telemetry has a short local development retention window.
      await m.query(
        "DELETE FROM analytics_events WHERE occurred_at<now()-interval '90 days'",
      );
      return expired.length;
    });
    console.log(`Removed personal content from ${count} expired sessions.`);
  } finally {
    await db.destroy();
  }
}
purge().catch(() => {
  console.error("Cleanup failed. Check database availability.");
  process.exitCode = 1;
});
