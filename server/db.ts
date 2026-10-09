import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { buildRescheduleAvailability, calculateRemainingCapacity, hasRescheduleCapacity } from "../shared/rescheduleAvailability";
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
  statisticOptions,
  statisticResponseHistory,
  statisticResponses,
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

function createShareToken() {
  return randomUUID().replace(/-/g, "");
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
      answer: "連結開放時間內均可自行改期；若該連結未開放改期或已截止，請自行聯絡公司窗口協助處理。",
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
  if (!adminRow) {
    const passwordHash = await hashPassword(getDefaultAdminPassword());
    await db.insert(adminCredentials).values({
      username: getDefaultAdminUsername(),
      passwordHash,
      isActive: true,
    });
  }

  if (process.env.VITEST || process.env.NODE_ENV === "test" || process.env.SKIP_DB_SEED === "1") {
    return;
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
      handoverFlow: "複驗完成並確認缺失處理後，將由專員另行通知交屋流程、所需文件與現場點交安排；實際時程依公司通知與雙方約定為準。",
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
      handoverFlow: "複驗完成後，將由專員另行通知交屋流程、所需文件與現場點交安排；實際時程依公司通知與雙方約定為準。",
      precautions: "請確認戶號格式與手機號碼正確；若連結已截止，請聯繫建案窗口協助。",
      faqItems: seedFaq("鷁崎建設"),
      contactWindow: "客服窗口：鷁崎建設客戶服務部\n服務時間：週一至週五 09:00-18:00",
    },
  ];

  const existingCompanyRows = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(inArray(companies.slug, defaultCompanies.map(company => company.slug)));
  const existingCompanySlugs = new Set(existingCompanyRows.map(company => company.slug));
  const missingCompanies = defaultCompanies.filter(company => !existingCompanySlugs.has(company.slug));

  if (missingCompanies.length > 0) {
    await db.insert(companies).values(missingCompanies);
  }

  if (process.env.ENABLE_DEMO_SEED !== "1") {
    return;
  }

  const companyRows = await db
    .select()
    .from(companies)
    .where(inArray(companies.slug, defaultCompanies.map(company => company.slug)));
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
        { companyId: company.id, projectId, type: "initial", shareToken: createShareToken(), isEnabled: true, startsAt, endsAt, disabledReason: null },
        { companyId: company.id, projectId, type: "reinspect", shareToken: createShareToken(), isEnabled: true, startsAt, endsAt, disabledReason: null },
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

type PublicSiteLinkInput = {
  linkToken?: string;
  companySlug?: string;
  projectSlug?: string;
  type?: "initial" | "reinspect";
};

async function getActiveLink(input: PublicSiteLinkInput) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (input.linkToken) {
    const [row] = await db
      .select({
        company: companies,
        project: projects,
        link: bookingLinks,
      })
      .from(bookingLinks)
      .innerJoin(companies, eq(companies.id, bookingLinks.companyId))
      .innerJoin(projects, eq(projects.id, bookingLinks.projectId))
      .where(eq(bookingLinks.shareToken, input.linkToken))
      .limit(1);

    if (!row) {
      throw new Error("找不到對應的預約連結");
    }

    return row;
  }

  if (!input.companySlug || !input.projectSlug || !input.type) {
    throw new Error("缺少預約連結識別資訊");
  }

  const rows = await db
    .select({
      company: companies,
      project: projects,
      link: bookingLinks,
    })
    .from(companies)
    .innerJoin(projects, eq(projects.companyId, companies.id))
    .innerJoin(
      bookingLinks,
      and(eq(bookingLinks.companyId, companies.id), eq(bookingLinks.projectId, projects.id), eq(bookingLinks.type, input.type))
    )
    .where(and(eq(companies.slug, input.companySlug), eq(projects.slug, input.projectSlug)))
    .orderBy(desc(bookingLinks.createdAt))
    .limit(2);

  if (!rows[0]) {
    throw new Error("找不到對應的公司或建案設定");
  }

  if (rows.length > 1) {
    throw new Error("此建案已有多筆同類型連結，請改用完整分享網址");
  }

  return rows[0];
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

function isPublicSelectableSlot(slotDate: Date, remaining: number) {
  // 使用 Asia/Taipei 時區取得「明天 00:00」作為最早可預約時間
  // 當日與已過日期一律排除，即使連結仍在開放期間
  const nowInTaipei = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  const tomorrowMs = new Date(nowInTaipei.getFullYear(), nowInTaipei.getMonth(), nowInTaipei.getDate() + 1).getTime();
  return new Date(slotDate).getTime() >= tomorrowMs && remaining > 0;
}

function getTaipeiDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function parseAdminCustomSlot(input: { slotDate: string; timeRange: string }, now = new Date()) {
  const slotDate = input.slotDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slotDate)) {
    throw new Error("客製日期格式不正確");
  }

  const [year, month, day] = slotDate.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    throw new Error("客製日期格式不正確");
  }

  if (slotDate < getTaipeiDateKey(now)) {
    throw new Error("客製日期不可早於今天");
  }

  const match = input.timeRange.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    throw new Error("自訂時段格式須為 HH:mm-HH:mm，例如 14:00-16:00");
  }

  const startLabel = `${match[1]}:${match[2]}`;
  const endLabel = `${match[3]}:${match[4]}`;
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);
  if (endMinutes <= startMinutes) {
    throw new Error("自訂時段的結束時間必須晚於開始時間");
  }

  return { slotDate: parsedDate, startLabel, endLabel };
}

async function lockRowForUpdate(tx: { execute?: (query: unknown) => Promise<unknown> }, tableName: "bookings" | "bookingSlots", id: number) {
  if (typeof tx.execute !== "function") {
    return;
  }

  if (tableName === "bookings") {
    await tx.execute(sql`SELECT id FROM bookings WHERE id = ${id} FOR UPDATE`);
    return;
  }

  await tx.execute(sql`SELECT id FROM bookingSlots WHERE id = ${id} FOR UPDATE`);
}

export async function getPublicSiteContext(input: PublicSiteLinkInput) {
  const row = await getActiveLink(input);
  const now = new Date();
  const isExpired = !row.link.isEnabled || row.link.startsAt > now || row.link.endsAt < now;

  if (row.link.mode === "statistics") {
    return {
      company: row.company,
      project: row.project,
      link: { ...row.link, type: row.link.type ?? "initial" },
      isExpired,
      availableSlots: [],
    };
  }

  if (!row.link.type) {
    throw new Error("驗屋預約連結缺少類型設定");
  }
  const slotUsage = await getSlotUsage(row.project.id);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const slotRows = await db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.projectId, row.project.id), eq(bookingSlots.linkId, row.link.id), eq(bookingSlots.isActive, true), eq(bookingSlots.isPrivate, false)))
    .orderBy(asc(bookingSlots.slotDate), asc(bookingSlots.startLabel));

  const availableSlots = (isExpired ? [] : slotRows)
    .map(slot => {
      const used = slotUsage.get(slot.id) ?? 0;
      return {
        ...slot,
        remaining: calculateRemainingCapacity(slot.capacity, used),
      };
    })
    .filter(slot => isPublicSelectableSlot(slot.slotDate, slot.remaining));

  return {
    company: row.company,
    project: row.project,
    link: { ...row.link, type: row.link.type },
    isExpired,
    availableSlots,
  };
}

async function getAdminLinkContext(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [row] = await db
    .select({
      company: companies,
      project: projects,
      link: bookingLinks,
    })
    .from(bookingLinks)
    .innerJoin(companies, eq(companies.id, bookingLinks.companyId))
    .innerJoin(projects, eq(projects.id, bookingLinks.projectId))
    .where(eq(bookingLinks.id, linkId))
    .limit(1);

  if (!row) {
    throw new Error("找不到對應的預約連結");
  }

  if (row.link.mode === "statistics" || !row.link.type) {
    throw new Error("這不是驗屋預約連結");
  }

  const now = new Date();

  return {
    company: row.company,
    project: row.project,
    link: { ...row.link, type: row.link.type },
    isExpired: !row.link.isEnabled || row.link.startsAt > now || row.link.endsAt < now,
  };
}

export function isStatisticsLinkOpen(link: { isEnabled: boolean; startsAt: Date; endsAt: Date }, now = new Date()) {
  return link.isEnabled && link.startsAt <= now && link.endsAt >= now;
}

function normalizeStatisticOptionName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function prepareStatisticOptionNames(optionNames: string[]) {
  const prepared = optionNames.map(name => ({ name: name.trim(), nameKey: normalizeStatisticOptionName(name) }));
  if (prepared.length < 2) {
    throw new Error("統計連結至少需要兩個啟用選項");
  }

  const seen = new Set<string>();
  for (const option of prepared) {
    if (!option.name) {
      throw new Error("統計選項名稱不可空白");
    }
    if (seen.has(option.nameKey)) {
      throw new Error("同一統計連結不可有重複選項名稱");
    }
    seen.add(option.nameKey);
  }

  return prepared;
}

async function getStatisticsLinkContext(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [row] = await db
    .select({
      company: companies,
      project: projects,
      link: bookingLinks,
    })
    .from(bookingLinks)
    .innerJoin(companies, eq(companies.id, bookingLinks.companyId))
    .innerJoin(projects, eq(projects.id, bookingLinks.projectId))
    .where(eq(bookingLinks.id, linkId))
    .limit(1);

  if (!row || row.link.mode !== "statistics") {
    throw new Error("這不是統計數量連結");
  }

  return row;
}

export async function getPublicStatisticsContext(input: PublicSiteLinkInput) {
  const row = await getActiveLink(input);
  if (row.link.mode !== "statistics") {
    throw new Error("這不是統計數量連結");
  }

  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const activeOptions = await db
    .select({ id: statisticOptions.id, name: statisticOptions.name })
    .from(statisticOptions)
    .where(and(eq(statisticOptions.linkId, row.link.id), eq(statisticOptions.isActive, true)))
    .orderBy(asc(statisticOptions.sortOrder), asc(statisticOptions.id));

  return {
    company: row.company,
    project: row.project,
    link: row.link,
    activeOptions,
    isWritable: isStatisticsLinkOpen(row.link),
  };
}

async function ensureLinkProjectOwnership(input: { companyId: number; projectId: number }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId)).limit(1);
  if (!project || project.companyId !== input.companyId) {
    throw new Error("所選建案不屬於目前公司，請重新選擇");
  }

  return project;
}

async function lockStatisticResponseForUpdate(
  tx: { execute?: (query: unknown) => Promise<unknown> },
  linkId: number,
  unitNumber: string
) {
  if (typeof tx.execute !== "function") return;
  await tx.execute(sql`SELECT id FROM statisticResponses WHERE linkId = ${linkId} AND unitNumber = ${unitNumber} FOR UPDATE`);
}

function isDuplicateKeyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate|unique/i.test(message);
}

export async function getAdminBookingAvailability(linkId: number) {
  const site = await getAdminLinkContext(linkId);

  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const slotRows = await db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.linkId, site.link.id), eq(bookingSlots.isActive, true), eq(bookingSlots.isPrivate, false)))
    .orderBy(asc(bookingSlots.slotDate), asc(bookingSlots.startLabel), asc(bookingSlots.endLabel));

  if (slotRows.length === 0) {
    return [] as Array<(typeof slotRows)[number] & { remaining: number; isCurrentSlot: boolean }>;
  }

  const usageRows = await db
    .select({ slotId: bookings.slotId, used: count(bookings.id) })
    .from(bookings)
    .where(and(inArray(bookings.slotId, slotRows.map(slot => slot.id)), sql`${bookings.status} <> 'cancelled'`))
    .groupBy(bookings.slotId);

  const usageBySlotId = new Map(usageRows.map(item => [item.slotId, Number(item.used)]));

  return buildRescheduleAvailability(slotRows, usageBySlotId, -1);
}

function formatReservedDate(slotDate: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(slotDate));

  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
}

function buildExistingBookingErrorMessage(existing: {
  slotDate: Date;
  startLabel: string;
  endLabel: string;
}, source: "public" | "admin") {
  const reservedDate = formatReservedDate(existing.slotDate);
  if (source === "admin") {
    return `此住戶已預約 ${reservedDate} ${existing.startLabel}-${existing.endLabel}，請改用編輯改期`;
  }

  return `你已預約 ${reservedDate} ${existing.startLabel}-${existing.endLabel}，不得重複預約`;
}

async function createBookingRecordForSite(input: {
  company: { id: number };
  project: { id: number };
  link: { id: number; type: "initial" | "reinspect" };
  isExpired: boolean;
  residentId: number;
  slotId?: number;
  customSlot?: {
    slotDate: string;
    timeRange: string;
  };
  gmail: string;
  hasInspectionCompany: boolean;
  internalNote?: string | null;
  duplicateSource: "public" | "admin";
  enforceLinkWindow?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (input.enforceLinkWindow !== false && input.isExpired) {
    throw new Error("此預約連結已截止");
  }

  if (Boolean(input.slotId) === Boolean(input.customSlot)) {
    throw new Error("預約時段與自訂時段必須擇一");
  }

  const [resident] = await db.select().from(residents).where(eq(residents.id, input.residentId)).limit(1);
  if (!resident) {
    throw new Error("住戶資料不存在");
  }

  if (resident.projectId !== input.project.id || resident.companyId !== input.company.id) {
    throw new Error("此住戶不屬於目前建案，不能使用這個預約連結");
  }

  const customSlot = input.customSlot ? parseAdminCustomSlot(input.customSlot) : null;
  const [slot] = input.slotId
    ? await db
        .select()
        .from(bookingSlots)
        .where(and(eq(bookingSlots.id, input.slotId), eq(bookingSlots.projectId, input.project.id), eq(bookingSlots.linkId, input.link.id), eq(bookingSlots.isActive, true), eq(bookingSlots.isPrivate, false)))
        .limit(1)
    : [];

  if (input.slotId && !slot) {
    throw new Error("選擇的時段不存在或已停用");
  }

  return db.transaction(async tx => {
    const [existing] = await tx
      .select({
        id: bookings.id,
        slotDate: bookingSlots.slotDate,
        startLabel: bookingSlots.startLabel,
        endLabel: bookingSlots.endLabel,
      })
      .from(bookings)
      .innerJoin(bookingSlots, eq(bookingSlots.id, bookings.slotId))
      .where(
        and(
          eq(bookings.linkId, input.link.id),
          eq(bookings.unitNumberSnapshot, resident.unitNumber),
          sql`${bookings.status} <> 'cancelled'`
        )
      )
      .limit(1);

    if (existing) {
      throw new Error(buildExistingBookingErrorMessage(existing, input.duplicateSource));
    }

    let targetSlotId: number;
    if (customSlot) {
      const insertedPrivateSlot = await tx.insert(bookingSlots).values({
        companyId: input.company.id,
        projectId: input.project.id,
        linkId: input.link.id,
        slotDate: customSlot.slotDate,
        startLabel: customSlot.startLabel,
        endLabel: customSlot.endLabel,
        capacity: 1,
        isActive: true,
        isPrivate: true,
        uniquenessScope: randomUUID().replace(/-/g, ""),
      });
      targetSlotId = Number(insertedPrivateSlot[0].insertId);
    } else {
      await lockRowForUpdate(tx as { execute?: (query: unknown) => Promise<unknown> }, "bookingSlots", slot!.id);

      const [lockedSlot] = await tx
        .select()
        .from(bookingSlots)
        .where(and(eq(bookingSlots.id, slot!.id), eq(bookingSlots.projectId, input.project.id), eq(bookingSlots.linkId, input.link.id), eq(bookingSlots.isActive, true), eq(bookingSlots.isPrivate, false)))
        .limit(1);

      if (!lockedSlot) {
        throw new Error("選擇的時段不存在或已停用");
      }

      const [slotUsage] = await tx
        .select({ used: count(bookings.id) })
        .from(bookings)
        .where(and(eq(bookings.slotId, lockedSlot.id), sql`${bookings.status} <> 'cancelled'`));

      const used = Number(slotUsage?.used ?? 0);
      if (used >= lockedSlot.capacity) {
        throw new Error("該時段已額滿，請改選其他時段");
      }
      targetSlotId = lockedSlot.id;
    }

    const createdAt = nowMs();
    const inserted = await tx.insert(bookings).values({
      companyId: input.company.id,
      projectId: input.project.id,
      linkId: input.link.id,
      residentId: resident.id,
      slotId: targetSlotId,
      bookingType: input.link.type,
      unitNumberSnapshot: resident.unitNumber,
      phoneNumberSnapshot: resident.phoneNumber,
      gmail: input.gmail,
      hasInspectionCompany: input.hasInspectionCompany,
      status: "booked",
      internalNote: input.internalNote?.trim() ? input.internalNote.trim() : null,
      createdAtMs: createdAt,
      updatedAtMs: createdAt,
    });

    return Number(inserted[0].insertId);
  });
}

export async function verifyResidentForBooking(input: PublicSiteLinkInput & {
  unitNumber: string;
  phoneNumber: string;
}) {
  const site = await getPublicSiteContext(input);
  if (site.link.mode === "statistics") {
    throw new Error("這不是驗屋預約連結");
  }
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

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
      linkId: bookings.linkId,
      slotId: bookings.slotId,
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
    .where(
      and(
        eq(bookings.projectId, site.project.id),
        eq(bookings.unitNumberSnapshot, resident.unitNumber),
        sql`${bookings.status} <> 'cancelled'`
      )
    )
    .orderBy(desc(bookings.createdAtMs));

  return {
    resident,
    site,
    existingBookings,
  };
}

export async function createBookingRecord(input: PublicSiteLinkInput & {
  residentId: number;
  slotId: number;
  gmail: string;
  hasInspectionCompany: boolean;
}) {
  const site = await getPublicSiteContext(input);
  if (site.link.mode === "statistics") {
    throw new Error("這不是驗屋預約連結");
  }
  return createBookingRecordForSite({
    ...site,
    residentId: input.residentId,
    slotId: input.slotId,
    gmail: input.gmail,
    hasInspectionCompany: input.hasInspectionCompany,
    internalNote: null,
    duplicateSource: "public",
    enforceLinkWindow: true,
  });
}

export async function createAdminBookingRecord(input: {
  linkId: number;
  residentId: number;
  slotId?: number;
  customSlot?: {
    slotDate: string;
    timeRange: string;
  };
  gmail: string;
  hasInspectionCompany: boolean;
  note?: string;
}) {
  const site = await getAdminLinkContext(input.linkId);
  return createBookingRecordForSite({
    ...site,
    residentId: input.residentId,
    slotId: input.slotId,
    customSlot: input.customSlot,
    gmail: input.gmail,
    hasInspectionCompany: input.hasInspectionCompany,
    internalNote: input.note ?? null,
    duplicateSource: "admin",
    enforceLinkWindow: false,
  });
}

export async function upsertStatisticsLinkRecord(input: {
  id?: number;
  companyId: number;
  projectId: number;
  title: string;
  description?: string | null;
  isEnabled: boolean;
  startsAt: Date;
  endsAt: Date;
  initialOptionNames?: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const title = input.title.trim();
  if (!title) throw new Error("請填寫統計連結名稱");
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new Error("連結結束時間必須晚於開始時間");
  }

  await ensureLinkProjectOwnership(input);
  const description = input.description?.trim() || null;

  if (input.id) {
    const [existing] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, input.id)).limit(1);
    if (!existing || existing.mode !== "statistics") {
      throw new Error("找不到可編輯的統計連結");
    }
    if (existing.companyId !== input.companyId || existing.projectId !== input.projectId) {
      throw new Error("統計連結建立後不可變更所屬公司或建案");
    }

    await db
      .update(bookingLinks)
      .set({
        statisticsTitle: title,
        statisticsDescription: description,
        isEnabled: input.isEnabled,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        disabledReason: input.isEnabled ? null : "此統計連結已由後台停止",
      })
      .where(eq(bookingLinks.id, input.id));
    return input.id;
  }

  const preparedOptions = prepareStatisticOptionNames(input.initialOptionNames ?? []);
  return db.transaction(async tx => {
    const inserted = await tx.insert(bookingLinks).values({
      companyId: input.companyId,
      projectId: input.projectId,
      mode: "statistics",
      type: null,
      shareToken: createShareToken(),
      statisticsTitle: title,
      statisticsDescription: description,
      isEnabled: input.isEnabled,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      disabledReason: input.isEnabled ? null : "此統計連結已由後台停止",
    });
    const linkId = Number(inserted[0].insertId);
    await tx.insert(statisticOptions).values(
      preparedOptions.map((option, index) => ({
        linkId,
        name: option.name,
        nameKey: option.nameKey,
        sortOrder: index + 1,
        isActive: true,
      }))
    );
    return linkId;
  });
}

export async function getStatisticOptionsForAdmin(linkId: number) {
  await getStatisticsLinkContext(linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  return db
    .select()
    .from(statisticOptions)
    .where(eq(statisticOptions.linkId, linkId))
    .orderBy(asc(statisticOptions.sortOrder), asc(statisticOptions.id));
}

export async function createStatisticOptionRecord(input: { linkId: number; name: string }) {
  await getStatisticsLinkContext(input.linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const name = input.name.trim();
  const nameKey = normalizeStatisticOptionName(name);
  if (!name) throw new Error("統計選項名稱不可空白");
  const existing = await db
    .select({ sortOrder: statisticOptions.sortOrder })
    .from(statisticOptions)
    .where(eq(statisticOptions.linkId, input.linkId));
  const sortOrder = Math.max(0, ...existing.map(option => option.sortOrder)) + 1;
  const inserted = await db.insert(statisticOptions).values({
    linkId: input.linkId,
    name,
    nameKey,
    sortOrder,
    isActive: true,
  });
  return Number(inserted[0].insertId);
}

export async function updateStatisticOptionRecord(input: { id: number; linkId: number; name: string; isActive: boolean }) {
  await getStatisticsLinkContext(input.linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  const name = input.name.trim();
  const nameKey = normalizeStatisticOptionName(name);
  if (!name) throw new Error("統計選項名稱不可空白");

  const [option] = await db
    .select()
    .from(statisticOptions)
    .where(and(eq(statisticOptions.id, input.id), eq(statisticOptions.linkId, input.linkId)))
    .limit(1);
  if (!option) throw new Error("找不到統計選項");

  await db.update(statisticOptions).set({ name, nameKey, isActive: input.isActive }).where(eq(statisticOptions.id, input.id));
  return input.id;
}

export async function deleteStatisticOptionRecord(input: { id: number; linkId: number }) {
  await getStatisticsLinkContext(input.linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [option] = await db
    .select()
    .from(statisticOptions)
    .where(and(eq(statisticOptions.id, input.id), eq(statisticOptions.linkId, input.linkId)))
    .limit(1);
  if (!option) throw new Error("找不到統計選項");

  const [responseUsage] = await db
    .select({ used: count(statisticResponses.id) })
    .from(statisticResponses)
    .where(eq(statisticResponses.optionId, input.id));
  const [historyUsage] = await db
    .select({ used: count(statisticResponseHistory.id) })
    .from(statisticResponseHistory)
    .where(sql`${statisticResponseHistory.previousOptionId} = ${input.id} OR ${statisticResponseHistory.newOptionId} = ${input.id}`);

  if (Number(responseUsage?.used ?? 0) > 0 || Number(historyUsage?.used ?? 0) > 0) {
    throw new Error("此選項已有統計答案或歷程引用，不能刪除");
  }

  await db.delete(statisticOptions).where(eq(statisticOptions.id, input.id));
  return input.id;
}

export async function reorderStatisticOptions(input: { linkId: number; optionIds: number[] }) {
  await getStatisticsLinkContext(input.linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  const options = await db.select({ id: statisticOptions.id }).from(statisticOptions).where(eq(statisticOptions.linkId, input.linkId));
  const expectedIds = options.map(option => option.id).sort((left, right) => left - right);
  const receivedIds = [...input.optionIds].sort((left, right) => left - right);
  if (expectedIds.length !== receivedIds.length || expectedIds.some((id, index) => id !== receivedIds[index])) {
    throw new Error("統計選項排序資料不完整或不屬於目前連結");
  }

  await db.transaction(async tx => {
    for (let index = 0; index < input.optionIds.length; index += 1) {
      const optionId = input.optionIds[index];
      await tx.update(statisticOptions).set({ sortOrder: index + 1 }).where(eq(statisticOptions.id, optionId));
    }
  });
  return input.optionIds;
}

async function resolveStatisticsResident(input: { linkId: number; residentId: number }) {
  const site = await getStatisticsLinkContext(input.linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  const [resident] = await db.select().from(residents).where(eq(residents.id, input.residentId)).limit(1);
  if (!resident || resident.projectId !== site.project.id || resident.companyId !== site.company.id) {
    throw new Error("此住戶不屬於目前建案，不能使用這個統計連結");
  }
  return { site, resident };
}

export async function verifyResidentForStatistics(input: PublicSiteLinkInput & { unitNumber: string; phoneNumber: string }) {
  const site = await getPublicStatisticsContext(input);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

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

  const [response] = await db
    .select({
      id: statisticResponses.id,
      optionId: statisticResponses.optionId,
      optionName: statisticOptions.name,
      optionIsActive: statisticOptions.isActive,
      updatedAtMs: statisticResponses.updatedAtMs,
    })
    .from(statisticResponses)
    .innerJoin(statisticOptions, eq(statisticOptions.id, statisticResponses.optionId))
    .where(and(eq(statisticResponses.linkId, site.link.id), eq(statisticResponses.unitNumber, resident.unitNumber)))
    .limit(1);

  return { resident, site, response: response ?? null };
}

async function writeStatisticResponse(input: {
  linkId: number;
  residentId: number;
  optionId: number;
  changedByType: "resident" | "admin";
  changedByAdminUsername?: string;
  reason?: string;
  enforcePublicWindow: boolean;
  attempt?: number;
}) {
  const { site, resident } = await resolveStatisticsResident(input);
  if (input.enforcePublicWindow && !isStatisticsLinkOpen(site.link)) {
    throw new Error("此統計連結目前未開放填答");
  }

  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  try {
    return await db.transaction(async tx => {
      await lockStatisticResponseForUpdate(tx as { execute?: (query: unknown) => Promise<unknown> }, site.link.id, resident.unitNumber);
      const [option] = await tx
        .select()
        .from(statisticOptions)
        .where(and(eq(statisticOptions.id, input.optionId), eq(statisticOptions.linkId, site.link.id), eq(statisticOptions.isActive, true)))
        .limit(1);
      if (!option) throw new Error("選擇的統計選項不存在或已停用");

      const [existing] = await tx
        .select()
        .from(statisticResponses)
        .where(and(eq(statisticResponses.linkId, site.link.id), eq(statisticResponses.unitNumber, resident.unitNumber)))
        .limit(1);

      if (existing?.optionId === option.id) {
        return { responseId: existing.id, changed: false as const, optionName: option.name };
      }

      const changedAtMs = nowMs();
      let responseId: number;
      let previousOption: { id: number; name: string } | null = null;
      if (existing) {
        const [previous] = await tx
          .select({ id: statisticOptions.id, name: statisticOptions.name })
          .from(statisticOptions)
          .where(eq(statisticOptions.id, existing.optionId))
          .limit(1);
        previousOption = previous ?? null;
        await tx
          .update(statisticResponses)
          .set({
            optionId: option.id,
            lastChangedByType: input.changedByType,
            lastChangedByAdminUsername: input.changedByAdminUsername ?? null,
            updatedAtMs: changedAtMs,
          })
          .where(eq(statisticResponses.id, existing.id));
        responseId = existing.id;
      } else {
        const inserted = await tx.insert(statisticResponses).values({
          linkId: site.link.id,
          projectId: site.project.id,
          unitNumber: resident.unitNumber,
          optionId: option.id,
          lastChangedByType: input.changedByType,
          lastChangedByAdminUsername: input.changedByAdminUsername ?? null,
          createdAtMs: changedAtMs,
          updatedAtMs: changedAtMs,
        });
        responseId = Number(inserted[0].insertId);
      }

      await tx.insert(statisticResponseHistory).values({
        responseId,
        previousOptionId: previousOption?.id ?? null,
        newOptionId: option.id,
        previousOptionNameSnapshot: previousOption?.name ?? null,
        newOptionNameSnapshot: option.name,
        changedByType: input.changedByType,
        changedByAdminUsername: input.changedByAdminUsername ?? null,
        reason: input.changedByType === "admin" ? input.reason?.trim() || null : null,
        changedAtMs,
      });
      return { responseId, changed: true as const, optionName: option.name };
    });
  } catch (error) {
    if (input.attempt !== 1 && isDuplicateKeyError(error)) {
      return writeStatisticResponse({ ...input, attempt: 1 });
    }
    throw error;
  }
}

export async function submitPublicStatisticResponse(input: PublicSiteLinkInput & { residentId: number; optionId: number }) {
  const site = await getPublicStatisticsContext(input);
  return writeStatisticResponse({
    linkId: site.link.id,
    residentId: input.residentId,
    optionId: input.optionId,
    changedByType: "resident",
    enforcePublicWindow: true,
  });
}

export async function submitAdminStatisticResponse(input: { linkId: number; residentId: number; optionId: number; reason?: string; changedByAdminUsername: string }) {
  return writeStatisticResponse({
    linkId: input.linkId,
    residentId: input.residentId,
    optionId: input.optionId,
    changedByType: "admin",
    changedByAdminUsername: input.changedByAdminUsername,
    reason: input.reason,
    enforcePublicWindow: false,
  });
}

export async function searchStatisticResidents(input: { linkId: number; unitNumber?: string }) {
  const site = await getStatisticsLinkContext(input.linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  const residentRows = await db
    .select({ id: residents.id, unitNumber: residents.unitNumber, phoneNumber: residents.phoneNumber, name: residents.name })
    .from(residents)
    .where(and(eq(residents.projectId, site.project.id), input.unitNumber ? like(residents.unitNumber, `%${input.unitNumber}%`) : undefined))
    .orderBy(asc(residents.unitNumber), asc(residents.id));
  const firstResidentByUnit = new Map<string, (typeof residentRows)[number]>();
  for (const resident of residentRows) {
    if (!firstResidentByUnit.has(resident.unitNumber)) firstResidentByUnit.set(resident.unitNumber, resident);
  }
  return Array.from(firstResidentByUnit.values());
}

export async function getStatisticResults(linkId: number) {
  const site = await getStatisticsLinkContext(linkId);
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [options, responseRows] = await Promise.all([
    db.select().from(statisticOptions).where(eq(statisticOptions.linkId, site.link.id)).orderBy(asc(statisticOptions.sortOrder), asc(statisticOptions.id)),
    db
      .select({
        responseId: statisticResponses.id,
        optionId: statisticOptions.id,
        optionName: statisticOptions.name,
        optionIsActive: statisticOptions.isActive,
        unitNumber: statisticResponses.unitNumber,
        updatedAtMs: statisticResponses.updatedAtMs,
        lastChangedByType: statisticResponses.lastChangedByType,
      })
      .from(statisticResponses)
      .innerJoin(statisticOptions, eq(statisticOptions.id, statisticResponses.optionId))
      .where(eq(statisticResponses.linkId, site.link.id))
      .orderBy(asc(statisticOptions.sortOrder), asc(statisticResponses.unitNumber)),
  ]);

  const responsesByOptionId = new Map<number, typeof responseRows>();
  for (const response of responseRows) {
    const current = responsesByOptionId.get(response.optionId) ?? [];
    current.push(response);
    responsesByOptionId.set(response.optionId, current);
  }
  return {
    link: site.link,
    options: options.map(option => {
      const responses = responsesByOptionId.get(option.id) ?? [];
      return {
        ...option,
        count: responses.length,
        units: responses.map(response => ({
          unitNumber: response.unitNumber,
          updatedAtMs: response.updatedAtMs,
          lastChangedByType: response.lastChangedByType,
        })),
      };
    }),
  };
}

export async function getAdminDashboardData() {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [companyRows, projectRows, residentRows, linkRows, slotRows, bookingRows, historyRows] = await Promise.all([
    db.select().from(companies).orderBy(asc(companies.name)),
    db.select().from(projects).orderBy(desc(projects.createdAt)),
    db.select().from(residents).orderBy(desc(residents.createdAt)),
    db.select().from(bookingLinks).orderBy(desc(bookingLinks.createdAt)),
    db.select().from(bookingSlots).where(and(sql`${bookingSlots.linkId} is not null`, eq(bookingSlots.isPrivate, false))).orderBy(desc(bookingSlots.slotDate)),
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

export async function upsertResidentRecord(input: {
  id?: number;
  companyId: number;
  projectId: number;
  unitNumber: string;
  phoneNumber: string;
  name: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const phoneNumber = input.phoneNumber.trim();
  const name = input.name.trim();
  if (!phoneNumber && !name) {
    throw new Error("手機號碼與姓名至少需填寫一項");
  }

  if (input.id) {
    const [existing] = await db.select().from(residents).where(eq(residents.id, input.id)).limit(1);
    if (!existing) {
      throw new Error("找不到住戶資料");
    }
    if (existing.companyId !== input.companyId || existing.projectId !== input.projectId || existing.unitNumber !== input.unitNumber.trim()) {
      throw new Error("個別住戶資料只能修改手機號碼與姓名");
    }

    const [duplicate] = await db
      .select({ id: residents.id })
      .from(residents)
      .where(and(eq(residents.projectId, existing.projectId), eq(residents.unitNumber, existing.unitNumber), eq(residents.phoneNumber, phoneNumber), eq(residents.name, name)))
      .limit(1);
    if (duplicate && duplicate.id !== input.id) {
      throw new Error("同一戶號已有相同手機與姓名的聯絡資料");
    }

    await db.update(residents).set({ phoneNumber, name }).where(eq(residents.id, input.id));
    return input.id;
  }

  const unitNumber = input.unitNumber.trim();
  const [duplicate] = await db
    .select({ id: residents.id })
    .from(residents)
    .where(and(eq(residents.projectId, input.projectId), eq(residents.unitNumber, unitNumber), eq(residents.phoneNumber, phoneNumber), eq(residents.name, name)))
    .limit(1);
  if (duplicate) {
    throw new Error("同一戶號已有相同手機與姓名的聯絡資料");
  }

  const inserted = await db.insert(residents).values({
    companyId: input.companyId,
    projectId: input.projectId,
    unitNumber,
    phoneNumber,
    name,
    note: null,
  });
  return Number(inserted[0].insertId);
}

async function deleteReschedulesByBookingIds(tx: { delete: (table: typeof bookingReschedules) => { where: (condition: ReturnType<typeof inArray>) => Promise<unknown> } }, bookingIds: number[]) {
  if (!bookingIds.length) return;
  await tx.delete(bookingReschedules).where(inArray(bookingReschedules.bookingId, bookingIds));
}

async function assertNoStatisticsResponsesForProject(projectId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");
  const [usage] = await db
    .select({ used: count(statisticResponses.id) })
    .from(statisticResponses)
    .where(eq(statisticResponses.projectId, projectId));
  if (Number(usage?.used ?? 0) > 0) {
    throw new Error("此建案已有統計回覆，為了保留統計結果，不能直接刪除");
  }
}

export async function deleteCompanyRecord(companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const companyProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.companyId, companyId));
  for (const project of companyProjects) {
    await assertNoStatisticsResponsesForProject(project.id);
  }

  await db.transaction(async tx => {
    const companyBookingRows = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.companyId, companyId));
    const companyBookingIds = companyBookingRows.map(row => row.id);
    const companyLinkRows = await tx.select({ id: bookingLinks.id }).from(bookingLinks).where(eq(bookingLinks.companyId, companyId));
    const companyLinkIds = companyLinkRows.map(row => row.id);

    await deleteReschedulesByBookingIds(tx, companyBookingIds);
    await tx.delete(bookings).where(eq(bookings.companyId, companyId));
    await tx.delete(bookingSlots).where(eq(bookingSlots.companyId, companyId));
    if (companyLinkIds.length > 0) {
      await tx.delete(statisticOptions).where(inArray(statisticOptions.linkId, companyLinkIds));
    }
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

  await assertNoStatisticsResponsesForProject(projectId);

  await db.transaction(async tx => {
    const projectBookingRows = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.projectId, projectId));
    const projectBookingIds = projectBookingRows.map(row => row.id);
    const projectLinkRows = await tx.select({ id: bookingLinks.id }).from(bookingLinks).where(eq(bookingLinks.projectId, projectId));
    const projectLinkIds = projectLinkRows.map(row => row.id);

    await deleteReschedulesByBookingIds(tx, projectBookingIds);
    await tx.delete(bookings).where(eq(bookings.projectId, projectId));
    await tx.delete(bookingSlots).where(eq(bookingSlots.projectId, projectId));
    if (projectLinkIds.length > 0) {
      await tx.delete(statisticOptions).where(inArray(statisticOptions.linkId, projectLinkIds));
    }
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

  const [resident] = await db.select().from(residents).where(eq(residents.id, residentId)).limit(1);
  if (!resident) {
    throw new Error("找不到住戶資料");
  }

  const [responseUsage] = await db
    .select({ used: count(statisticResponses.id) })
    .from(statisticResponses)
    .where(and(eq(statisticResponses.projectId, resident.projectId), eq(statisticResponses.unitNumber, resident.unitNumber)));
  if (Number(responseUsage?.used ?? 0) > 0) {
    const [sameUnitResidents] = await db
      .select({ used: count(residents.id) })
      .from(residents)
      .where(and(eq(residents.projectId, resident.projectId), eq(residents.unitNumber, resident.unitNumber)));
    if (Number(sameUnitResidents?.used ?? 0) <= 1) {
      throw new Error("此戶已有統計答案，為了保留驗證與統計歷程，不能刪除最後一筆住戶資料");
    }
  }

  await db.delete(residents).where(eq(residents.id, residentId));
  return residentId;
}

export async function deleteBookingLinkRecord(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  await db.transaction(async tx => {
    const bookingRows = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.linkId, linkId));
    const statisticResponseRows = await tx
      .select({ id: statisticResponses.id })
      .from(statisticResponses)
      .where(eq(statisticResponses.linkId, linkId));

    const bookingIds = bookingRows.map(row => row.id);
    const statisticResponseIds = statisticResponseRows.map(row => row.id);

    if (bookingIds.length > 0) {
      await tx.delete(bookingReschedules).where(inArray(bookingReschedules.bookingId, bookingIds));
      await tx.delete(bookings).where(inArray(bookings.id, bookingIds));
    }
    if (statisticResponseIds.length > 0) {
      await tx.delete(statisticResponseHistory).where(inArray(statisticResponseHistory.responseId, statisticResponseIds));
      await tx.delete(statisticResponses).where(eq(statisticResponses.linkId, linkId));
    }

    await tx.delete(bookingSlots).where(eq(bookingSlots.linkId, linkId));
    await tx.delete(statisticOptions).where(eq(statisticOptions.linkId, linkId));
    await tx.delete(bookingLinks).where(eq(bookingLinks.id, linkId));
  });

  return linkId;
}

export async function deleteBookingSlotRecord(slotId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [bookingUsage] = await db.select({ used: count(bookings.id) }).from(bookings).where(eq(bookings.slotId, slotId));
  if (Number(bookingUsage?.used ?? 0) > 0) {
    throw new Error("此時段已有預約紀錄，為了保留歷程，不能直接刪除");
  }

  await db.delete(bookingSlots).where(eq(bookingSlots.id, slotId));
  return slotId;
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

export async function upsertBookingLinkRecord(input: Omit<InsertBookingLink, "createdAt" | "updatedAt" | "shareToken"> & { id?: number; shareToken?: string }) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (!input.type) {
    throw new Error("請選擇初驗或複驗類型");
  }

  if (input.id) {
    const [existing] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, input.id)).limit(1);
    if (!existing || existing.mode !== "inspection") {
      throw new Error("找不到可編輯的驗屋預約連結");
    }
    const updateValues = {
      ...input,
      mode: "inspection" as const,
      type: input.type,
      shareToken: input.shareToken ?? undefined,
      statisticsTitle: null,
      statisticsDescription: null,
      disabledReason: input.isEnabled ? null : input.disabledReason ?? null,
    };
    await db.update(bookingLinks).set(updateValues).where(eq(bookingLinks.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(bookingLinks).values({
    ...input,
    mode: "inspection",
    type: input.type,
    shareToken: input.shareToken ?? createShareToken(),
    statisticsTitle: null,
    statisticsDescription: null,
    disabledReason: input.isEnabled ? null : input.disabledReason ?? null,
  });
  return Number(inserted[0].insertId);
}

export async function upsertBookingSlotRecord(input: {
  id?: number;
  companyId?: number;
  projectId?: number;
  linkId?: number | null;
  slotDate: Date;
  startLabel: string;
  endLabel: string;
  capacity: number;
  isActive: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  let resolvedLink = null as null | Pick<InsertBookingLink, "id" | "companyId" | "projectId">;

  if (input.linkId) {
    const [link] = await db.select().from(bookingLinks).where(eq(bookingLinks.id, input.linkId)).limit(1);
    if (!link) {
      throw new Error("找不到對應的預約連結");
    }
    resolvedLink = link;
  } else if (input.companyId && input.projectId) {
    const links = await db
      .select({ id: bookingLinks.id, companyId: bookingLinks.companyId, projectId: bookingLinks.projectId })
      .from(bookingLinks)
      .where(and(eq(bookingLinks.companyId, input.companyId), eq(bookingLinks.projectId, input.projectId), eq(bookingLinks.isEnabled, true)))
      .orderBy(desc(bookingLinks.createdAt))
      .limit(2);

    if (!links[0]) {
      throw new Error("找不到對應的預約連結");
    }

    if (links[1]) {
      throw new Error("此建案已有多筆預約連結，請明確指定要掛載時段的 linkId");
    }

    resolvedLink = links[0];
  } else {
    throw new Error("建立時段時必須提供 linkId，或至少提供 companyId 與 projectId 供系統解析唯一連結");
  }

  const payload = {
    ...input,
    linkId: resolvedLink.id,
    companyId: resolvedLink.companyId,
    projectId: resolvedLink.projectId,
  };

  const duplicateConditions = [
    sql`${bookingSlots.linkId} = ${resolvedLink.id}`,
    eq(bookingSlots.slotDate, input.slotDate),
    eq(bookingSlots.startLabel, input.startLabel),
    eq(bookingSlots.endLabel, input.endLabel),
    eq(bookingSlots.isPrivate, false),
  ];

  if (input.id) {
    duplicateConditions.push(sql`${bookingSlots.id} <> ${input.id}` as never);
  }

  const [duplicate] = await db
    .select({ id: bookingSlots.id })
    .from(bookingSlots)
    .where(and(...duplicateConditions))
    .limit(1);

  if (duplicate) {
    throw new Error("同一預約連結在這個日期與時段已存在紀錄，請勿重複建立");
  }

  if (input.id) {
    await db.update(bookingSlots).set(payload).where(eq(bookingSlots.id, input.id));
    return input.id;
  }

  const inserted = await db.insert(bookingSlots).values(payload);
  return Number(inserted[0].insertId);
}

export async function searchBookings(filters: {
  projectId?: number;
  linkId?: number;
  unitNumber?: string;
  bookingType?: "initial" | "reinspect";
  status?: "booked" | "rescheduled" | "cancelled";
  bookingDate?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const conditions = [];
  if (filters.projectId) conditions.push(eq(bookings.projectId, filters.projectId));
  if (filters.linkId) conditions.push(eq(bookings.linkId, filters.linkId));
  if (filters.unitNumber) conditions.push(like(bookings.unitNumberSnapshot, `%${filters.unitNumber}%`));
  if (filters.bookingType) conditions.push(eq(bookings.bookingType, filters.bookingType));
  if (filters.status) conditions.push(eq(bookings.status, filters.status));

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const rows = await db
    .select({
      id: bookings.id,
      companyId: bookings.companyId,
      projectId: bookings.projectId,
      linkId: bookings.linkId,
      slotId: bookings.slotId,
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
      slotIsPrivate: bookingSlots.isPrivate,
    })
    .from(bookings)
    .innerJoin(companies, eq(companies.id, bookings.companyId))
    .innerJoin(projects, eq(projects.id, bookings.projectId))
    .innerJoin(bookingSlots, eq(bookingSlots.id, bookings.slotId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(bookingSlots.slotDate), asc(bookingSlots.startLabel), asc(bookingSlots.endLabel), asc(bookings.id));

  if (!filters.bookingDate) {
    return rows;
  }

  return rows.filter(row => {
    const parts = formatter.formatToParts(new Date(row.slotDate));
    const year = parts.find(part => part.type === "year")?.value;
    const month = parts.find(part => part.type === "month")?.value;
    const day = parts.find(part => part.type === "day")?.value;
    return `${year}-${month}-${day}` === filters.bookingDate;
  });
}

export async function getAdminRescheduleAvailability(bookingId: number) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  const [booking] = await db
    .select({
      id: bookings.id,
      linkId: bookings.linkId,
      slotId: bookings.slotId,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!booking) {
    throw new Error("找不到預約紀錄");
  }

  if (!booking.linkId) {
    throw new Error("此預約缺少對應連結，無法查詢可改期時段");
  }

  const slotRows = await db
    .select()
    .from(bookingSlots)
    .where(and(eq(bookingSlots.linkId, booking.linkId), eq(bookingSlots.isActive, true), eq(bookingSlots.isPrivate, false)))
    .orderBy(asc(bookingSlots.slotDate), asc(bookingSlots.startLabel), asc(bookingSlots.endLabel));

  if (slotRows.length === 0) {
    return [] as Array<(typeof slotRows)[number] & { remaining: number; isCurrentSlot: boolean }>;
  }

  const usageRows = await db
    .select({ slotId: bookings.slotId, used: count(bookings.id) })
    .from(bookings)
    .where(and(inArray(bookings.slotId, slotRows.map(slot => slot.id)), sql`${bookings.status} <> 'cancelled'`))
    .groupBy(bookings.slotId);

  const usageBySlotId = new Map(usageRows.map(item => [item.slotId, Number(item.used)]));

  return buildRescheduleAvailability(slotRows, usageBySlotId, booking.slotId);
}

export async function rescheduleBookingRecord(input: {
  bookingId: number;
  newSlotId?: number;
  customSlot?: {
    slotDate: string;
    timeRange: string;
  };
  note?: string;
  hasInspectionCompany?: boolean;
  changedBy: string;
  expectedCurrentSlotId?: number;
  requiredResidentId?: number;
  requiredLinkId?: number;
  sameSlotMessage?: string;
  staleMessage?: string;
  fullMessage?: string;
  slotUnavailableMessage?: string;
  bookingNotFoundMessage?: string;
  slotDateValidator?: (slotDate: Date) => void;
}) {
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  return db.transaction(async tx => {
    await lockRowForUpdate(tx as { execute?: (query: unknown) => Promise<unknown> }, "bookings", input.bookingId);

    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, input.bookingId)).limit(1);
    if (!booking) {
      throw new Error(input.bookingNotFoundMessage ?? "找不到預約紀錄");
    }

    if (input.requiredResidentId && booking.residentId !== input.requiredResidentId) {
      throw new Error(input.bookingNotFoundMessage ?? "找不到預約紀錄");
    }

    if (input.requiredLinkId && booking.linkId !== input.requiredLinkId) {
      throw new Error(input.bookingNotFoundMessage ?? "找不到預約紀錄");
    }

    if (typeof input.expectedCurrentSlotId === "number" && booking.slotId !== input.expectedCurrentSlotId) {
      throw new Error(input.staleMessage ?? "預約資料已更新，請重新整理後再試");
    }

    if (!input.newSlotId && !input.customSlot) {
      throw new Error("請選擇新時段或輸入自訂時段");
    }

    if (input.newSlotId && input.customSlot) {
      throw new Error("新時段與自訂時段只能擇一");
    }

    if (booking.slotId === input.newSlotId && input.sameSlotMessage) {
      throw new Error(input.sameSlotMessage);
    }

    let targetSlotId: number;

    if (input.customSlot) {
      const customSlot = parseAdminCustomSlot(input.customSlot);
      const inserted = await tx.insert(bookingSlots).values({
        companyId: booking.companyId,
        projectId: booking.projectId,
        linkId: booking.linkId,
        slotDate: customSlot.slotDate,
        startLabel: customSlot.startLabel,
        endLabel: customSlot.endLabel,
        capacity: 1,
        isActive: true,
        isPrivate: true,
        uniquenessScope: randomUUID().replace(/-/g, ""),
      });
      targetSlotId = Number(inserted[0].insertId);
    } else {
      const newSlotId = input.newSlotId as number;
      await lockRowForUpdate(tx as { execute?: (query: unknown) => Promise<unknown> }, "bookingSlots", newSlotId);

      const [newSlot] = await tx.select().from(bookingSlots).where(eq(bookingSlots.id, newSlotId)).limit(1);
      if (!newSlot || !newSlot.isActive || newSlot.isPrivate) {
        throw new Error(input.slotUnavailableMessage ?? "新時段不存在或已停用");
      }

      if (booking.linkId && newSlot.linkId !== booking.linkId) {
        throw new Error(input.slotUnavailableMessage ?? "新時段不存在或已停用");
      }

      if (input.requiredLinkId && newSlot.linkId !== input.requiredLinkId) {
        throw new Error(input.slotUnavailableMessage ?? "新時段不存在或已停用");
      }

      if (input.slotDateValidator) {
        input.slotDateValidator(newSlot.slotDate);
      }

      const [usage] = await tx
        .select({ used: count(bookings.id) })
        .from(bookings)
        .where(and(eq(bookings.slotId, newSlot.id), sql`${bookings.status} <> 'cancelled'`));

      if (!hasRescheduleCapacity(newSlot.capacity, Number(usage?.used ?? 0))) {
        throw new Error(input.fullMessage ?? "新時段已額滿");
      }

      targetSlotId = newSlot.id;
    }

    const changedAtMs = nowMs();
    const nextHasInspectionCompany = typeof input.hasInspectionCompany === "boolean"
      ? input.hasInspectionCompany
      : booking.hasInspectionCompany;

    await tx.insert(bookingReschedules).values({
      bookingId: booking.id,
      oldSlotId: booking.slotId,
      newSlotId: targetSlotId,
      note: input.note ?? null,
      changedAtMs,
      changedBy: input.changedBy,
    });

    await tx
      .update(bookings)
      .set({
        slotId: targetSlotId,
        status: "rescheduled",
        internalNote: input.note ?? null,
        hasInspectionCompany: nextHasInspectionCompany,
        updatedAtMs: changedAtMs,
      })
      .where(eq(bookings.id, booking.id));

    return booking.id;
  });
}

export async function publicRescheduleBookingRecord(input: PublicSiteLinkInput & {
  bookingId: number;
  residentId: number;
  currentSlotId: number;
  newSlotId: number;
  hasInspectionCompany?: boolean;
}) {
  const site = await getPublicSiteContext(input);
  if (site.link.mode === "statistics") {
    throw new Error("這不是驗屋預約連結");
  }
  const db = await getDb();
  if (!db) throw new Error("資料庫尚未連線");

  if (site.isExpired) {
    throw new Error("此預約連結已截止");
  }

  const [resident] = await db.select().from(residents).where(eq(residents.id, input.residentId)).limit(1);
  if (!resident) {
    throw new Error("住戶資料不存在");
  }

  if (resident.projectId !== site.project.id || resident.companyId !== site.company.id) {
    throw new Error("此住戶不屬於目前建案，不能使用這個預約連結");
  }

  return rescheduleBookingRecord({
    bookingId: input.bookingId,
    newSlotId: input.newSlotId,
    changedBy: "customer",
    expectedCurrentSlotId: input.currentSlotId,
    hasInspectionCompany: input.hasInspectionCompany,
    requiredResidentId: resident.id,
    requiredLinkId: site.link.id,
    bookingNotFoundMessage: "找不到對應預約資料",
    slotUnavailableMessage: "選擇的時段不存在或已停用",
    sameSlotMessage: "您目前已預約此時段",
    staleMessage: "預約資料已更新，請重新整理後再試",
    fullMessage: "該時段已無剩餘名額",
    slotDateValidator: (slotDate: Date) => {
      if (!isPublicSelectableSlot(slotDate, 1)) {
        throw new Error("無法改期至當日或已過期的時段");
      }
    },
  });
}
