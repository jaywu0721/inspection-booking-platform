import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL 未設定");
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const [columnRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bookingLinks'
         AND COLUMN_NAME = 'shareToken'`
    );

    if (Number(columnRows[0]?.count ?? 0) === 0) {
      await connection.query("ALTER TABLE bookingLinks ADD COLUMN shareToken VARCHAR(64) NULL AFTER type");
    }

    const [legacyIndexRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bookingLinks'
         AND INDEX_NAME = 'booking_links_project_type_unique'`
    );

    if (Number(legacyIndexRows[0]?.count ?? 0) > 0) {
      await connection.query("ALTER TABLE bookingLinks DROP INDEX booking_links_project_type_unique");
    }

    const [missingTokenRows] = await connection.query(
      "SELECT id FROM bookingLinks WHERE shareToken IS NULL OR shareToken = ''"
    );

    for (const row of missingTokenRows) {
      await connection.query("UPDATE bookingLinks SET shareToken = ? WHERE id = ?", [
        randomUUID().replace(/-/g, ""),
        row.id,
      ]);
    }

    const [newIndexRows] = await connection.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bookingLinks'
         AND INDEX_NAME = 'booking_links_share_token_unique'`
    );

    if (Number(newIndexRows[0]?.count ?? 0) === 0) {
      await connection.query("ALTER TABLE bookingLinks ADD UNIQUE INDEX booking_links_share_token_unique (shareToken)");
    }

    await connection.query("ALTER TABLE bookingLinks MODIFY shareToken VARCHAR(64) NOT NULL");
    console.log("bookingLinks shareToken migration completed");
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
