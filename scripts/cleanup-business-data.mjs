import mysql from "mysql2/promise";

const KEEP_COMPANY_NAMES = ["鷁欣建設", "鷁崎建設"];

function assertDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL 未設定，無法執行資料清理");
  }
  return value;
}

async function main() {
  const connection = await mysql.createConnection(assertDatabaseUrl());

  try {
    await connection.beginTransaction();

    const [keepCompanies] = await connection.query(
      "SELECT id, name, slug FROM companies WHERE name IN (?, ?) ORDER BY id ASC",
      KEEP_COMPANY_NAMES
    );

    if (!Array.isArray(keepCompanies) || keepCompanies.length !== KEEP_COMPANY_NAMES.length) {
      throw new Error(`保留公司主檔不足，預期 ${KEEP_COMPANY_NAMES.length} 筆，實際 ${Array.isArray(keepCompanies) ? keepCompanies.length : 0} 筆`);
    }

    const [beforeCounts] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM companies) AS companiesCount,
        (SELECT COUNT(*) FROM projects) AS projectsCount,
        (SELECT COUNT(*) FROM residents) AS residentsCount,
        (SELECT COUNT(*) FROM bookingLinks) AS bookingLinksCount,
        (SELECT COUNT(*) FROM bookingSlots) AS bookingSlotsCount,
        (SELECT COUNT(*) FROM bookings) AS bookingsCount,
        (SELECT COUNT(*) FROM bookingReschedules) AS bookingReschedulesCount`
    );

    await connection.query("DELETE FROM bookingReschedules");
    await connection.query("DELETE FROM bookings");
    await connection.query("DELETE FROM bookingSlots");
    await connection.query("DELETE FROM bookingLinks");
    await connection.query("DELETE FROM residents");
    await connection.query("DELETE FROM projects");
    await connection.query(
      "DELETE FROM companies WHERE name NOT IN (?, ?)",
      KEEP_COMPANY_NAMES
    );

    const [afterCounts] = await connection.query(
      `SELECT
        (SELECT COUNT(*) FROM companies) AS companiesCount,
        (SELECT COUNT(*) FROM projects) AS projectsCount,
        (SELECT COUNT(*) FROM residents) AS residentsCount,
        (SELECT COUNT(*) FROM bookingLinks) AS bookingLinksCount,
        (SELECT COUNT(*) FROM bookingSlots) AS bookingSlotsCount,
        (SELECT COUNT(*) FROM bookings) AS bookingsCount,
        (SELECT COUNT(*) FROM bookingReschedules) AS bookingReschedulesCount`
    );

    await connection.commit();

    const summary = {
      keptCompanies: keepCompanies,
      before: Array.isArray(beforeCounts) ? beforeCounts[0] : beforeCounts,
      after: Array.isArray(afterCounts) ? afterCounts[0] : afterCounts,
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
