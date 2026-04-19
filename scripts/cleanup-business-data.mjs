import mysql from "mysql2/promise";

const KEEP_COMPANY_NAMES = ["鷁欣建設", "鷁崎建設"];
const SYSTEM_TEST_PROJECT_NAME_PATTERN = "%示範建案%";

function assertDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL 未設定，無法執行資料清理");
  }
  return value;
}

function toIdList(rows, key = "id") {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => Number(row?.[key]))
    .filter(value => Number.isInteger(value) && value > 0);
}

async function deleteByProjectIds(connection, projectIds) {
  if (projectIds.length === 0) {
    return {
      deletedProjectIds: [],
      residentsDeleted: 0,
      bookingLinksDeleted: 0,
      bookingSlotsDeleted: 0,
      bookingsDeleted: 0,
      bookingReschedulesDeleted: 0,
      projectsDeleted: 0,
    };
  }

  const [bookingRescheduleDelete] = await connection.query(
    `DELETE FROM bookingReschedules
     WHERE bookingId IN (
       SELECT id FROM (
         SELECT id FROM bookings WHERE projectId IN (?)
       ) AS projectBookings
     )`,
    [projectIds]
  );
  const [bookingDelete] = await connection.query("DELETE FROM bookings WHERE projectId IN (?)", [projectIds]);
  const [bookingSlotDelete] = await connection.query("DELETE FROM bookingSlots WHERE projectId IN (?)", [projectIds]);
  const [bookingLinkDelete] = await connection.query("DELETE FROM bookingLinks WHERE projectId IN (?)", [projectIds]);
  const [residentDelete] = await connection.query("DELETE FROM residents WHERE projectId IN (?)", [projectIds]);
  const [projectDelete] = await connection.query("DELETE FROM projects WHERE id IN (?)", [projectIds]);

  return {
    deletedProjectIds: projectIds,
    residentsDeleted: residentDelete.affectedRows ?? 0,
    bookingLinksDeleted: bookingLinkDelete.affectedRows ?? 0,
    bookingSlotsDeleted: bookingSlotDelete.affectedRows ?? 0,
    bookingsDeleted: bookingDelete.affectedRows ?? 0,
    bookingReschedulesDeleted: bookingRescheduleDelete.affectedRows ?? 0,
    projectsDeleted: projectDelete.affectedRows ?? 0,
  };
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

    const keepCompanySlugs = keepCompanies.map(company => company.slug);
    const legacyDemoSlugs = keepCompanySlugs.map(slug => `${slug}-demo`);

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

    const [systemTestProjects] = await connection.query(
      `SELECT id, companyId, slug, name
       FROM projects
       WHERE slug IN (?) OR name LIKE ?`,
      [legacyDemoSlugs, SYSTEM_TEST_PROJECT_NAME_PATTERN]
    );

    const projectIdsToDelete = toIdList(systemTestProjects);
    const deletionSummary = await deleteByProjectIds(connection, projectIdsToDelete);

    const [systemTestCompanies] = await connection.query(
      `SELECT id, name, slug
       FROM companies
       WHERE name NOT IN (?, ?)
         AND (
           slug REGEXP '(^|[-_])(demo|test|sandbox|sample|slot|duplicate|integration|qa)([-_]|$)'
           OR name REGEXP '(示範|測試|demo|test|sample|slot|duplicate|integration|qa)'
         )`,
      KEEP_COMPANY_NAMES
    );

    const companyIdsToDelete = toIdList(systemTestCompanies);
    let companyDeletionSummary = {
      deletedCompanyIds: [],
      companiesDeleted: 0,
      nestedProjectCleanup: {
        deletedProjectIds: [],
        residentsDeleted: 0,
        bookingLinksDeleted: 0,
        bookingSlotsDeleted: 0,
        bookingsDeleted: 0,
        bookingReschedulesDeleted: 0,
        projectsDeleted: 0,
      },
    };

    if (companyIdsToDelete.length > 0) {
      const [companyProjects] = await connection.query(
        "SELECT id FROM projects WHERE companyId IN (?)",
        [companyIdsToDelete]
      );
      const nestedProjectIds = toIdList(companyProjects);
      const nestedProjectCleanup = await deleteByProjectIds(connection, nestedProjectIds);
      const [companyDelete] = await connection.query("DELETE FROM companies WHERE id IN (?)", [companyIdsToDelete]);

      companyDeletionSummary = {
        deletedCompanyIds: companyIdsToDelete,
        companiesDeleted: companyDelete.affectedRows ?? 0,
        nestedProjectCleanup,
      };
    }

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
      protectedCompanies: keepCompanies,
      deletedSystemTestProjects: Array.isArray(systemTestProjects) ? systemTestProjects : [],
      deletedSystemTestCompanies: Array.isArray(systemTestCompanies) ? systemTestCompanies : [],
      deletionSummary,
      companyDeletionSummary,
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
