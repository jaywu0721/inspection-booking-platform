const isolatedDatabaseUrl = process.env.VITEST_DATABASE_URL?.trim();

if (!isolatedDatabaseUrl) {
  throw new Error(
    "Vitest 已被鎖定為只能使用獨立測試資料庫。請先設定 VITEST_DATABASE_URL，再執行任何測試。"
  );
}

process.env.DATABASE_URL = isolatedDatabaseUrl;
process.env.NODE_ENV = "test";
process.env.SKIP_DB_SEED = "1";
process.env.VITEST_ISOLATED = "1";
