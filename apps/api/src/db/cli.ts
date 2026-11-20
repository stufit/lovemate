import { createDataSource, seed } from "./data-source";
async function run() {
  const db = createDataSource();
  await db.initialize();
  try {
    const action = process.argv[2];
    if (action === "migrate") {
      const migrations = await db.runMigrations();
      console.log(`Applied ${migrations.length} migrations.`);
    } else if (action === "revert") {
      await db.undoLastMigration();
      console.log("Reverted last migration.");
    } else if (action === "seed") {
      await seed(db);
      console.log("Survey 1.1.0 seeded (12 questions).");
    } else throw new Error("Use migrate, revert or seed.");
  } finally {
    await db.destroy();
  }
}
run().catch(() => {
  console.error(
    "Database operation failed. Check configuration and database availability.",
  );
  process.exitCode = 1;
});
