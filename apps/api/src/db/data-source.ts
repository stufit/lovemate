import "reflect-metadata";
import { DataSource, type EntityManager } from "typeorm";
import { QUESTIONS, VERSION } from "@woorisai/shared";
import { settings } from "../config";
import { Initial1795104000000 } from "./migrations/1795104000000-Initial";
export function createDataSource(url?: string) {
  return new DataSource({
    type: "postgres",
    url: url ?? settings().databaseUrl,
    synchronize: false,
    logging: false,
    migrations: [Initial1795104000000],
    migrationsRun: false,
  });
}
export async function seed(db: DataSource) {
  await db.transaction(async (m) => {
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      await m.query(
        "INSERT INTO survey_questions(id,survey_version,dimension,display_order,text_ko,left_label,right_label) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(survey_version,id) DO NOTHING",
        [q.id, VERSION, q.topic, i, q.text, q.left, q.right],
      );
    }
  });
}
export async function rows<T>(
  manager: EntityManager,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return manager.query(sql, params);
}
