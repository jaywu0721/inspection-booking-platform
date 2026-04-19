import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = "/home/ubuntu/inspection-booking-platform";
const tempTestPath = path.join(projectRoot, "server", "isolation-proof.test.ts");
const logPath = path.join(projectRoot, "isolated-vitest-proof.log");
const isolatedDatabaseName = "inspection_vitest_isolated";
const isolatedDatabaseUser = "vitest_runner";
const isolatedDatabasePassword = "vitest_runner_pw";
const isolatedDatabaseUrl = `mysql://${isolatedDatabaseUser}:${isolatedDatabasePassword}@127.0.0.1:3306/${isolatedDatabaseName}`;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} 執行失敗`);
  }

  return result;
}

async function main() {
  const createSql = `CREATE DATABASE IF NOT EXISTS \`${isolatedDatabaseName}\`; CREATE USER IF NOT EXISTS '${isolatedDatabaseUser}'@'127.0.0.1' IDENTIFIED BY '${isolatedDatabasePassword}'; GRANT ALL PRIVILEGES ON \`${isolatedDatabaseName}\`.* TO '${isolatedDatabaseUser}'@'127.0.0.1'; FLUSH PRIVILEGES;`;
  const dropSql = `DROP DATABASE IF EXISTS \`${isolatedDatabaseName}\`; DROP USER IF EXISTS '${isolatedDatabaseUser}'@'127.0.0.1'; FLUSH PRIVILEGES;`;

  await fs.writeFile(
    tempTestPath,
    `import { describe, expect, it } from "vitest";\nimport { getDb } from "./db";\n\ndescribe("isolated database guard", () => {\n  it("forces Vitest to use VITEST_DATABASE_URL instead of the formal database", async () => {\n    expect(process.env.VITEST_ISOLATED).toBe("1");\n    expect(process.env.DATABASE_URL).toBe(process.env.VITEST_DATABASE_URL);\n    expect(process.env.DATABASE_URL?.includes("inspection_vitest_isolated")).toBe(true);\n    const db = await getDb();\n    expect(db).toBeTruthy();\n  });\n});\n`
  );

  try {
    run("sudo", ["mysql", "-e", createSql]);

    const result = spawnSync(
      "pnpm",
      ["exec", "vitest", "run", "server/isolation-proof.test.ts"],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          VITEST_DATABASE_URL: isolatedDatabaseUrl,
        },
        encoding: "utf8",
      }
    );

    await fs.writeFile(logPath, `${result.stdout}\n${result.stderr}`);

    if (result.status !== 0) {
      throw new Error(`隔離 Vitest 驗證失敗，請查看 ${logPath}`);
    }

    console.log(
      JSON.stringify(
        {
          isolatedDatabaseUrl,
          logPath,
          success: true,
        },
        null,
        2
      )
    );
  } finally {
    await fs.rm(tempTestPath, { force: true });
    run("sudo", ["mysql", "-e", dropSql]);
  }
}

main().catch(async error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
