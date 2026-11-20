import { createApplication } from "./app";
import { settings } from "./config";
async function main() {
  const config = settings();
  const { app, db } = await createApplication();
  await app.listen(config.port, "127.0.0.1");
  console.log(
    `Woorisai API listening at http://127.0.0.1:${config.port} (mock payments only)`,
  );
  const shutdown = async () => {
    await app.close();
    await db.destroy();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
main().catch(() => {
  console.error(
    "API startup failed. Check database migrations, environment and payment mode.",
  );
  process.exitCode = 1;
});
