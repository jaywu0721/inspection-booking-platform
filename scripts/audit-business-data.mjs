import mysql from "mysql2/promise";

function assertDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL 未設定，無法盤點資料");
  }
  return value;
}

async function main() {
  const connection = await mysql.createConnection(assertDatabaseUrl());

  try {
    const [adminSettings] = await connection.query(
      `SELECT id, username, isActive, updatedAt
       FROM adminCredentials
       ORDER BY id ASC`
    );

    const [companies] = await connection.query(
      `SELECT c.id, c.name, c.slug, c.contactPhone, c.contactEmail, c.heroTitle, c.heroDescription,
              c.inspectionFlow, c.handoverFlow, c.precautions, c.faqItems, c.contactWindow,
              COUNT(DISTINCT p.id) AS projectCount,
              COUNT(DISTINCT r.id) AS residentCount,
              COUNT(DISTINCT l.id) AS bookingLinkCount,
              COUNT(DISTINCT s.id) AS slotCount,
              COUNT(DISTINCT b.id) AS bookingCount
       FROM companies c
       LEFT JOIN projects p ON p.companyId = c.id
       LEFT JOIN residents r ON r.companyId = c.id
       LEFT JOIN bookingLinks l ON l.companyId = c.id
       LEFT JOIN bookingSlots s ON s.companyId = c.id
       LEFT JOIN bookings b ON b.companyId = c.id
       GROUP BY c.id, c.name, c.slug, c.contactPhone, c.contactEmail, c.heroTitle, c.heroDescription,
                c.inspectionFlow, c.handoverFlow, c.precautions, c.faqItems, c.contactWindow
       ORDER BY c.id ASC`
    );

    const [projects] = await connection.query(
      `SELECT p.id, p.companyId, c.name AS companyName, p.slug, p.name, p.unitFormatHint, p.houseNumberExample,
              COUNT(DISTINCT r.id) AS residentCount,
              COUNT(DISTINCT l.id) AS bookingLinkCount,
              COUNT(DISTINCT s.id) AS slotCount,
              COUNT(DISTINCT b.id) AS bookingCount
       FROM projects p
       INNER JOIN companies c ON c.id = p.companyId
       LEFT JOIN residents r ON r.projectId = p.id
       LEFT JOIN bookingLinks l ON l.projectId = p.id
       LEFT JOIN bookingSlots s ON s.projectId = p.id
       LEFT JOIN bookings b ON b.projectId = p.id
       GROUP BY p.id, p.companyId, c.name, p.slug, p.name, p.unitFormatHint, p.houseNumberExample
       ORDER BY p.companyId ASC, p.id ASC`
    );

    const [bookingLinks] = await connection.query(
      `SELECT l.id, c.name AS companyName, p.name AS projectName, l.type, l.isEnabled,
              DATE_FORMAT(l.startsAt, '%Y-%m-%d %H:%i:%s') AS startsAt,
              DATE_FORMAT(l.endsAt, '%Y-%m-%d %H:%i:%s') AS endsAt
       FROM bookingLinks l
       INNER JOIN companies c ON c.id = l.companyId
       INNER JOIN projects p ON p.id = l.projectId
       ORDER BY l.id ASC`
    );

    const [slots] = await connection.query(
      `SELECT s.id, c.name AS companyName, p.name AS projectName, s.linkId,
              DATE_FORMAT(s.slotDate, '%Y-%m-%d') AS slotDate, s.startLabel, s.endLabel, s.capacity, s.isActive
       FROM bookingSlots s
       INNER JOIN companies c ON c.id = s.companyId
       INNER JOIN projects p ON p.id = s.projectId
       ORDER BY s.projectId ASC, s.slotDate ASC, s.startLabel ASC, s.id ASC`
    );

    const [residents] = await connection.query(
      `SELECT r.id, c.name AS companyName, p.name AS projectName, r.unitNumber, r.phoneNumber
       FROM residents r
       INNER JOIN companies c ON c.id = r.companyId
       INNER JOIN projects p ON p.id = r.projectId
       ORDER BY r.projectId ASC, r.id ASC`
    );

    const [bookings] = await connection.query(
      `SELECT b.id, c.name AS companyName, p.name AS projectName, b.unitNumberSnapshot, b.bookingType, b.status
       FROM bookings b
       INNER JOIN companies c ON c.id = b.companyId
       INNER JOIN projects p ON p.id = b.projectId
       ORDER BY b.id ASC`
    );

    console.log(JSON.stringify({ adminSettings, companies, projects, bookingLinks, slots, residents, bookings }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
