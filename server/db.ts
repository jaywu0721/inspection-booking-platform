import { and, asc, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  adminCredentials,
  bookingLinks,
  bookingReschedules,
  bookings,
  bookingSlots,
  companies,
  InsertAdminCredential,
  InsertBookingLink,
  InsertBookingSlot,
  InsertCompany,
  InsertProject,
  InsertResident,
  InsertUser,
  projects,
  residents,
  users,
} from "../drizzle/schema";
import { hashPassword, verifyPassword } from "./adminAuth";
import { ENV } from "./_core/env";

const YISIN_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663069716470/chxAqQnkGciqMxHWV2cbkf/yisin-construction_6763f45f.png";
const YIQI_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663069716470/chxAqQnkGciqMxHWV2cbkf/yiqi-construction_5bdeb887.png";

let _db: ReturnType<typeof drizzle> | null = null;
let seedPromise: Promise<void> | null = null;

function nowMs() {
  return Date.now();
}

function toKebabSlug(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `project-${nowMs()}`;
}

function getDefaultAdminUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function getDefaultAdminPassword() {
  return process.env.ADMIN_PASSWORD || "ChangeMe123!";
}

function seedFaq(companyName: string) {
  return [
    {
      question: `如何進行 ${companyName} 驗屋預約？`,
      answer: "請先依戶號格式輸入標準戶號與完整手機號碼，驗證成功後即可查看既有預約與可用時段。",
    },
    {
      question: "如果要改期怎麼處理？",
      answer: "前台不提供自行改期，請直接聯繫頁面上的聯絡窗口，由管理員協助調整。",
    },
    {
      question: "一定要填 Gmail 嗎？",
      answer: "目前系統會保留 Gmail 作為預約紀錄欄位之一，請填寫可正常收信的 Gmail。",
    },
  ];
}

async function seedDefaults() {
  const db = _db;
  if (!db) return;

  const [adminRow] = await db.select().from(adminCredentials).limit(1);
  const passwordHash = await hashPassword(getDefaultAdminPassword());
  if (!adminRow) {
    await db.insert(adminCredentials).values({
      username: getDefaultAdminUsername(),
      passwordHash,
      isActive: true,
    });
  } else {
    await db
      .update(adminCredentials)
      .set({
        username: getDefaultAdminUsername(),
        passwordHash,
        isActive: true,
      })
      .where(eq(adminCredentials.id, adminRow.id));
  }

  const defaultCompanies: Array<InsertCompany> = [
    {
      slug: "yisin",
      name: "鷁欣建設",
      logoUrl: YISIN_LOGO,
      contactPhone: "04-0000-0001",
      contactEmail: "service@yisin-demo.tw",
      heroTitle: "鷁欣建設驗屋預約系統",
      heroDescription: "提供住戶初驗與複驗的品牌化預約入口，統一查詢時段、流程說明與窗口資訊。",
      inspectionFlow: "1. 線上驗證身分\n2. 選擇驗屋時段\n3. 到場進行初驗\n4. 修繕完成後安排複驗",
      handoverFlow: "複驗完成並確認缺失處理後，由公司安排正式交屋時程與文件確認。",
      precautions: "請依約定時間到場，並預留足夠時間完成驗屋；若需改期，請先聯繫窗口。",
      faqItems: seedFaq("鷁欣建設"),
      contactWindow: "客服窗口：鷁欣建設客服中心\n服務時間：週一至週五 09:00-18:00",
    },
    {
      slug: "yiqi",
      name: "鷁崎建設",
      logoUrl: YIQI_LOGO,
      contactPhone: "04-0000-0002",
      contactEmail: "service@yiqi-demo.tw",
      heroTitle: "鷁崎建設驗屋預約系統",
      heroDescription: "整合建案流程說明、驗屋注意事項與預約管理，讓住戶透過單一入口完成作業。",
      inspectionFlow: "1. 開啟專屬連結\n2. 驗證戶號與手機\n3. 查詢既有預約\n4. 視需要新增預約或等待複驗安排",
      handoverFlow: "複驗完成後，將由專員通知交屋作業與相關文件準備內容。",
      precautions: "請確認戶號格式與手機號碼正確；若連結已截止，請聯繫建案窗口協助。",
      faqItems: seedFaq("鷁崎建設"),
      contactWindow: "客服窗口：鷁崎建設客戶服務部\n服務時間：週一至週五 09:00-18:00",
    },
  ];

  for (const company of defaultCompanies) {
    await db.insert(companies).values(company).onDuplicateKeyUpdate({
      set: {
        name: company.name,
        logoUrl: company.logoUrl,
        contactPhone: company.contactPhone,
        contactEmail: company.contactEmail,
        heroTitle: company.heroTitle,
        heroDescription: company.heroDescription,
        inspectionFlow: company.inspectionFlow,
        handoverFlow: company.handoverFlow,
        precautions: company.precautions,
        faqItems: company.faqItems,
        contactWindow: company.contactWindow,
      },
    });
  }

  const companyRows = await db.select().from(companies);
  for (const company of companyRows) {
    const demoProjectSlug = `${company.slug}-demo`;
    const [existingProject] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.companyId, company.id), eq(projects.slug, demoProjectSlug)))
      .limit(1);

    if (!existingProject) {
      const inserted = await db.insert(projects).values({
        companyId: company.id,
        slug: demoProjectSlug,
        name: `${company.name}示範建案`,
        unitFormatHint: "棟別-樓層-戶別，若無棟別則為 樓層-戶別",
        houseNumberExample: "A-4-A 或 4-A",
        address: null,
      });
      const projectId = Number(inserted[0].insertId);
      const startsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      await db.insert(bookingLinks).values([
        { companyId: company.id, projectId, type: "initial", isEnabled: true, startsAt, endsAt, disabledReason: null },
        { companyId: company.id, projectId, type: "reinspect", isEnabled: true, startsAt, endsAt, disabledReason: null },
      ]);
    }
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }

  if (_db && !seedPromise) {
    seedPromise = seedDefaults().catch(error => {
      console.error("[Database] Seed failed:", error);
    });
  }

  if (seedPromise) {
    await seedPromise;
  }

  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
  };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  if (Object.keys(updateSet).length === 0) {
    updateSet.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function validateAdminLogin(username: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [credential] = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.username, username))
    .limit(1);

  if (!credential || !credential.isActive) {
    return false;
  }

  return verifyPassword(password, credential.passwordHash);
}

export async function getAdminProfile(username: string) {
  const db = await getDb();
  if (!db) return null;

  const [credential] = await db
    .select({ username: adminCredentials.username, updatedAt: adminCredentials.updatedAt })
    .from(adminCredentials)
    .where(eq(adminCredentials.username, username))
    .limit(1);

  return credential ?? null;
}

async function getActiveLink(companySlug: string, projectSlug: string, type: "initial" | "reinspect") {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [row] = await db
    .select({
      company: companies,
      project: projects,
      link: bookingLinks,
    })
    .from(companies)
    .innerJoin(projects, eq(projects.companyId, companies.id))
    .innerJoin(
      bookingLinks,
      and(eq(bookingLinks.companyId, companies.id), eq(bookingLinks.projectId, projects.id), eq(bookingLinks.type, type))
    )
    .where(and(eq(companies.slug, companySlug), eq(projects.slug, projectSlug)))
    .limit(1);

  if (!row) {
    throw new Error("找不到對應的公司或建案設定");
  }

  return row;
}

async function getSlotUsage(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const usage = await db
    .select({ slotId: bookings.slotId, used: count(bookings.id) })
    .from(bookings)
    .where(and(eq(bookings.projectId, projectId), sql`${bookings.status} <> 'cancelled'`))
    .groupBy(bookings.slotId);

  return new Map(usage.map(item => [item.slotId, Number(item.used)]));
}

export async function getPublicSiteContext(input: {
  companySlug: string;
  projectSlug: string;
  type: "initial" | "reinspect";
}) {
  const row = await getActiveLink(input.companySlug, input.projectSlug, input.type);
  const now = new Date();
  const isExpired = !row.link.isEnabled || row.link.startsAt > now || row.link.endsAt < now;
  const slotUsage = await getSlotUsage(row.project.id);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const slotRows = await db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.projectId, row.project.id), eq(bookingSlots.isActive, true)))
    .orderBy(asc(bookingSlots.slotDate), asc(bookingSlots.startLabel));

  const availableSlots = slotRows.map(slot => {
    const used = slotUsage.get(slot.id) ?? 0;
    return {
      ...slot,
      remaining: Math.max(slot.capacity - used, 0),
    };
  });

  return {
    company: row.company,
    project: row.project,
    link: row.link,
    isExpired,
    availableSlots,
  };
}

export async function verifyResidentForBooking(input: {
  companySlug: string;
  projectSlug: string;
  type: "initial" | "reinspect";
  unitNumber: string;
  phoneNumber: string;
}) {
  const site = await getPublicSiteContext(input);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (site.isExpired) {
    throw new Error("此預約連結已截止");
  }

  const [resident] = await db
    .select()
    .from(residents)
    .where(
      and(
        eq(residents.projectId, site.project.id),
        eq(residents.unitNumber, input.unitNumber.trim()),
        eq(residents.phoneNumber, input.phoneNumber.trim())
      )
    )
    .limit(1);

  if (!resident) {
    throw new Error("查無對應住戶資料，請確認戶號格式與手機號碼後再試，或直接聯絡窗口。 ");
  }

  const existingBookings = await db
    .select({
      id: bookings.id,
      bookingType: bookings.bookingType,
      status: bookings.status,
      gmail: bookings.gmail,
      hasInspectionCompany: bookings.hasInspectionCompany,
      createdAtMs: bookings.createdAtMs,
      updatedAtMs: bookings.updatedAtMs,
      slotDate: bookingSlots.slotDate,
      startLabel: bookingSlots.startLabel,
      endLabel: bookingSlots.endLabel,
      projectName: projects.name,
      companyName: companies.name,
    })
    .from(bookings)
    .innerJoin(bookingSlots, eq(bookingSlots.id, bookings.slotId))
    .innerJoin(projects, eq(projects.id, bookings.projectId))
    .innerJoin(companies, eq(companies.id, bookings.companyId))
    .where(eq(bookings.residentId, resident.id))
    .orderBy(desc(bookings.createdAtMs));

  return {
    resident,
    site,
    existingBookings,
  };
}

export async function createBookingRecord(input: {
  companySlug: string;
  projectSlug: string;
  type: "initial" | "reinspect";
  residentId: number;
  slotId: number;
  gmail: string;
  hasInspectionCompany: boolean;
}) {
  const site = await getPublicSiteContext(input);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (site.isExpired) {
    throw new Error("此預約連結已截止");
  }

  const [resident] = await db.select().from(residents).where(eq(residents.id, input.residentId)).limit(1);
  if (!resident) {
    throw new Error("住戶資料不存在");
  }

  const [slot] = await db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.id, input.slotId), eq(bookingSlots.projectId, site.project.id), eq(bookingSlots.isActive, true)))
    .limit(1);

  if (!slot) {
    throw new Error("選擇的時段不存在或已停用");
  }

  const result = await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.residentId, resident.id),
          eq(bookings.projectId, site.project.id),
          eq(bookings.bookingType, input.type),
          sql`${bookings.status} <> 'cancelled'`
        )
      )
      .limit(1);

    if (existing) {
      throw new Error("此戶號已存在同類型預約，請先於查詢區確認既有紀錄。 ");
    }

    const [slotUsage] = await tx
      .select({ used: count(bookings.id) })
      .from(bookings)
      .where(and(eq(bookings.slotId, slot.id), sql`${bookings.status} <> 'cancelled'`));

    const used = Number(slotUsage?.used ?? 0);
    if (used >= slot.capacity) {
      throw new Error("該時段已額滿，請改選其他時段");
    }

    const createdAt = nowMs();
    const inserted = await tx.insert(bookings).values({
      companyId: site.company.id,
      projectId: site.project.id,
      linkId: site.link.id,
      residentId: resident.id,
      slotId: slot.id,
      bookingType: input.type,
      unitNumberSnapshot: resident.unitNumber,
      phoneNumberSnapshot: resident.phoneNumber,
      gmail: input.gmail,
      hasInspectionCompany: input.hasInspectionCompany,
      status: "booked",
      internalNote: null,
      createdAtMs: createdAt,
      updatedAtMs: createdAt,
    });

    return Number(inserted[0].insertId);
  });

  return result;
}

export async function getAdminDashboardData() {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [companyRows, projectRows, residentRows, linkRows, slotRows, bookingRows, historyRows] = await Promise.all([
    db.select().from(companies).orderBy(asc(companies.name)),
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    db.select().from(residents).orderBy(desc(residents.createdAt)),
    db.select().from(bookingLinks).orderBy(desc(bookingLinks.createdAt)),
    db.select().from(bookingSlots).orderBy(desc(bookingSlots.slotDate)),
    db.select().from(bookings).orderBy(desc(bookings.createdAtMs)),
    db.select().from(bookingReschedules).orderBy(desc(bookingReschedules.changedAtMs)),
  ]);

  return {
    companies: companyRows,
    projects: projectRows,
    residents: residentRows,
    links: linkRows,
    slots: slotRows,
    bookings: bookingRows,
    reschedules: historyRows,
  };
}

export async function upsertCompanyRecord(input: Omit<InsertCompany, "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (input.id) {
    await db.update(companies).set({ ...input, contactEmail: input.contactEmail ?? null }).where(eq(companies.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(companies).values({ ...input, contactEmail: input.contactEmail ?? null });
  return Number(inserted[0].insertId);
}

export async function upsertProjectRecord(input: Omit<InsertProject, "createdAt" | "updatedAt" | "slug"> & { id?: number; slug?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  let resolvedSlug = input.slug?.trim();

  if (!resolvedSlug && input.id) {
    const [existingProject] = await db.select().from(projects).where(eq(projects.id, input.id)).limit(1);
    resolvedSlug = existingProject?.slug;
  }

  if (!resolvedSlug) {
    resolvedSlug = `${toKebabSlug(input.name)}-${input.companyId}`;
  }

  if (input.id) {
    await db
      .update(projects)
      .set({ ...input, slug: resolvedSlug, address: input.address ?? null })
      .where(eq(projects.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(projects).values({ ...input, slug: resolvedSlug, address: input.address ?? null });
  return Number(inserted[0].insertId);
}

export async function upsertResidentRecord(input: Omit<InsertResident, "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (input.id) {
    await db.update(residents).set({ ...input, note: input.note ?? null }).where(eq(residents.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(residents).values({ ...input, note: input.note ?? null });
  return Number(inserted[0].insertId);
}

async function deleteReschedulesByBookingIds(tx: { delete: (table: typeof bookingReschedules) => { where: (condition: ReturnType<typeof inArray>) => Promise<unknown> } }, bookingIds: number[]) {
  if (!bookingIds.length) return;
  await tx.delete(bookingReschedules).where(inArray(bookingReschedules.bookingId, bookingIds));
}

export async function deleteCompanyRecord(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  await db.transaction(async tx => {
    const companyBookingRows = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.companyId, companyId));
    const companyBookingIds = companyBookingRows.map(row => row.id);

    await deleteReschedulesByBookingIds(tx, companyBookingIds);
    await tx.delete(bookings).where(eq(bookings.companyId, companyId));
    await tx.delete(bookingSlots).where(eq(bookingSlots.companyId, companyId));
    await tx.delete(bookingLinks).where(eq(bookingLinks.companyId, companyId));
    await tx.delete(residents).where(eq(residents.companyId, companyId));
    await tx.delete(projects).where(eq(projects.companyId, companyId));
    await tx.delete(companies).where(eq(companies.id, companyId));
  });

  return companyId;
}

export async function deleteProjectRecord(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  await db.transaction(async tx => {
    const projectBookingRows = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.projectId, projectId));
    const projectBookingIds = projectBookingRows.map(row => row.id);

    await deleteReschedulesByBookingIds(tx, projectBookingIds);
    await tx.delete(bookings).where(eq(bookings.projectId, projectId));
    await tx.delete(bookingSlots).where(eq(bookingSlots.projectId, projectId));
    await tx.delete(bookingLinks).where(eq(bookingLinks.projectId, projectId));
    await tx.delete(residents).where(eq(residents.projectId, projectId));
    await tx.delete(projects).where(eq(projects.id, projectId));
  });

  return projectId;
}

export async function deleteResidentRecord(residentId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [bookingUsage] = await db.select({ used: count(bookings.id) }).from(bookings).where(eq(bookings.residentId, residentId));
  if ((bookingUsage?.used ?? 0) > 0) {
    throw new Error("此住戶已存在預約紀錄，為了保留歷程，不能直接刪除");
  }

  await db.delete(residents).where(eq(residents.id, residentId));
  return residentId;
}

export async function deleteBookingLinkRecord(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  await db.delete(bookingLinks).where(eq(bookingLinks.id, linkId));
  return linkId;
}

export async function setBookingLinkEnabledRecord(input: { id: number; isEnabled: boolean; disabledReason?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  await db
    .update(bookingLinks)
    .set({
      isEnabled: input.isEnabled,
      disabledReason: input.isEnabled ? null : input.disabledReason ?? "此連結已由後台停止",
    })
    .where(eq(bookingLinks.id, input.id));

  return input.id;
}

export async function upsertBookingLinkRecord(input: Omit<InsertBookingLink, "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (input.id) {
    await db.update(bookingLinks).set({ ...input, disabledReason: input.isEnabled ? null : input.disabledReason ?? null }).where(eq(bookingLinks.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(bookingLinks).values({ ...input, disabledReason: input.isEnabled ? null : input.disabledReason ?? null });
  return Number(inserted[0].insertId);
}

export async function upsertBookingSlotRecord(input: Omit<InsertBookingSlot, "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (input.id) {
    await db.update(bookingSlots).set(input).where(eq(bookingSlots.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(bookingSlots).values(input);
  return Number(inserted[0].insertId);
}

export async function searchBookings(filters: {
  projectId?: number;
  unitNumber?: string;
  bookingType?: "initial" | "reinspect";
  status?: "booked" | "rescheduled" | "cancelled";
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const conditions = [];
  if (filters.projectId) conditions.push(eq(bookings.projectId, filters.projectId));
  if (filters.unitNumber) conditions.push(like(bookings.unitNumberSnapshot, `%${filters.unitNumber}%`));
  if (filters.bookingType) conditions.push(eq(bookings.bookingType, filters.bookingType));
  if (filters.status) conditions.push(eq(bookings.status, filters.status));

  return db
    .select({
      id: bookings.id,
      companyName: companies.name,
      projectName: projects.name,
      bookingType: bookings.bookingType,
      unitNumberSnapshot: bookings.unitNumberSnapshot,
      phoneNumberSnapshot: bookings.phoneNumberSnapshot,
      gmail: bookings.gmail,
      hasInspectionCompany: bookings.hasInspectionCompany,
      status: bookings.status,
      internalNote: bookings.internalNote,
      createdAtMs: bookings.createdAtMs,
      updatedAtMs: bookings.updatedAtMs,
      slotDate: bookingSlots.slotDate,
      startLabel: bookingSlots.startLabel,
      endLabel: bookingSlots.endLabel,
    })
    .from(bookings)
    .innerJoin(companies, eq(companies.id, bookings.companyId))
    .innerJoin(projects, eq(projects.id, bookings.projectId))
    .innerJoin(bookingSlots, eq(bookingSlots.id, bookings.slotId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bookings.createdAtMs));
}

export async function rescheduleBookingRecord(input: {
  bookingId: number;
  newSlotId: number;
  note?: string;
  changedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  return db.transaction(async tx => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
    if (!booking) {
      throw new Error("找不到預約紀錄");
    }

    const [newSlot] = await tx.select().from(bookingSlots).where(eq(bookingSlots.id, input.newSlotId)).limit(1);
    if (!newSlot || !newSlot.isActive) {
      throw new Error("新時段不存在或已停用");
    }

    const [usage] = await tx
      .select({ used: count(bookings.id) })
      .from(bookings)
      .where(and(eq(bookings.slotId, newSlot.id), sql`${bookings.status} <> 'cancelled'`, sql`${bookings.id} <> ${booking.id}`));

    if (Number(usage?.used ?? 0) >= newSlot.capacity) {
      throw new Error("新時段已額滿");
    }

    await tx.insert(bookingReschedules).values({
      bookingId: booking.id,
      oldSlotId: booking.slotId,
      newSlotId: newSlot.id,
      note: input.note ?? null,
      changedAtMs: nowMs(),
      changedBy: input.changedBy,
    });

    await tx
      .update(bookings)
      .set({
        slotId: newSlot.id,
        status: "rescheduled",
        internalNote: input.note ?? null,
        updatedAtMs: nowMs(),
      })
      .where(eq(bookings.id, booking.id));

    return booking.id;
  });
}
