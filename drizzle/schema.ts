import {
  bigint,
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const adminCredentials = mysqlTable("adminCredentials", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 120 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const companies = mysqlTable(
  "companies",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    logoUrl: text("logoUrl").notNull(),
    contactPhone: varchar("contactPhone", { length: 50 }).notNull(),
    contactEmail: varchar("contactEmail", { length: 320 }),
    heroTitle: varchar("heroTitle", { length: 255 }).notNull(),
    heroDescription: text("heroDescription").notNull(),
    inspectionFlow: text("inspectionFlow").notNull(),
    handoverFlow: text("handoverFlow").notNull(),
    precautions: text("precautions").notNull(),
    faqItems: json("faqItems").$type<Array<{ question: string; answer: string }>>().notNull(),
    contactWindow: text("contactWindow").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    slugUnique: uniqueIndex("companies_slug_unique").on(table.slug),
  })
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    unitFormatHint: varchar("unitFormatHint", { length: 255 }).notNull(),
    houseNumberExample: varchar("houseNumberExample", { length: 255 }).notNull(),
    address: text("address"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    companySlugUnique: uniqueIndex("projects_company_slug_unique").on(table.companyId, table.slug),
  })
);

export const bookingLinks = mysqlTable(
  "bookingLinks",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId").notNull(),
    mode: mysqlEnum("mode", ["inspection", "statistics"]).default("inspection").notNull(),
    type: mysqlEnum("type", ["initial", "reinspect"]),
    shareToken: varchar("shareToken", { length: 64 }).notNull(),
    statisticsTitle: varchar("statisticsTitle", { length: 255 }),
    statisticsDescription: text("statisticsDescription"),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt").notNull(),
    disabledReason: varchar("disabledReason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    shareTokenUnique: uniqueIndex("booking_links_share_token_unique").on(table.shareToken),
  })
);

export const statisticOptions = mysqlTable(
  "statisticOptions",
  {
    id: int("id").autoincrement().primaryKey(),
    linkId: int("linkId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    nameKey: varchar("nameKey", { length: 255 }).notNull(),
    sortOrder: int("sortOrder").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    linkNameKeyUnique: uniqueIndex("statistic_options_link_name_key_unique").on(table.linkId, table.nameKey),
  })
);

export const statisticResponses = mysqlTable(
  "statisticResponses",
  {
    id: int("id").autoincrement().primaryKey(),
    linkId: int("linkId").notNull(),
    projectId: int("projectId").notNull(),
    unitNumber: varchar("unitNumber", { length: 120 }).notNull(),
    optionId: int("optionId").notNull(),
    lastChangedByType: mysqlEnum("lastChangedByType", ["resident", "admin"]).notNull(),
    lastChangedByAdminUsername: varchar("lastChangedByAdminUsername", { length: 120 }),
    createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
    updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
  },
  table => ({
    linkUnitUnique: uniqueIndex("statistic_responses_link_unit_unique").on(table.linkId, table.unitNumber),
  })
);

export const statisticResponseHistory = mysqlTable("statisticResponseHistory", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  previousOptionId: int("previousOptionId"),
  newOptionId: int("newOptionId").notNull(),
  previousOptionNameSnapshot: varchar("previousOptionNameSnapshot", { length: 255 }),
  newOptionNameSnapshot: varchar("newOptionNameSnapshot", { length: 255 }).notNull(),
  changedByType: mysqlEnum("changedByType", ["resident", "admin"]).notNull(),
  changedByAdminUsername: varchar("changedByAdminUsername", { length: 120 }),
  reason: text("reason"),
  changedAtMs: bigint("changedAtMs", { mode: "number" }).notNull(),
});

export const residents = mysqlTable(
  "residents",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId").notNull(),
    unitNumber: varchar("unitNumber", { length: 120 }).notNull(),
    phoneNumber: varchar("phoneNumber", { length: 30 }).notNull(),
    name: varchar("name", { length: 255 }).default("").notNull(),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    residentContactUnique: uniqueIndex("residents_project_unit_phone_name_unique").on(table.projectId, table.unitNumber, table.phoneNumber, table.name),
  })
);

export const bookingSlots = mysqlTable(
  "bookingSlots",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("companyId").notNull(),
    projectId: int("projectId").notNull(),
    linkId: int("linkId"),
    slotDate: timestamp("slotDate").notNull(),
    startLabel: varchar("startLabel", { length: 20 }).notNull(),
    endLabel: varchar("endLabel", { length: 20 }).notNull(),
    capacity: int("capacity").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    isPrivate: boolean("isPrivate").default(false).notNull(),
    uniquenessScope: varchar("uniquenessScope", { length: 64 }).default("public").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    linkDateTimeScopeUnique: uniqueIndex("booking_slots_link_datetime_scope_unique").on(
      table.linkId,
      table.slotDate,
      table.startLabel,
      table.endLabel,
      table.uniquenessScope
    ),
  })
);

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  projectId: int("projectId").notNull(),
  linkId: int("linkId").notNull(),
  residentId: int("residentId").notNull(),
  slotId: int("slotId").notNull(),
  bookingType: mysqlEnum("bookingType", ["initial", "reinspect"]).notNull(),
  unitNumberSnapshot: varchar("unitNumberSnapshot", { length: 120 }).notNull(),
  phoneNumberSnapshot: varchar("phoneNumberSnapshot", { length: 30 }).notNull(),
  gmail: varchar("gmail", { length: 320 }).notNull(),
  hasInspectionCompany: boolean("hasInspectionCompany").default(false).notNull(),
  status: mysqlEnum("status", ["booked", "rescheduled", "cancelled"]).default("booked").notNull(),
  internalNote: text("internalNote"),
  createdAtMs: bigint("createdAtMs", { mode: "number" }).notNull(),
  updatedAtMs: bigint("updatedAtMs", { mode: "number" }).notNull(),
});

export const bookingReschedules = mysqlTable("bookingReschedules", {
  id: int("id").autoincrement().primaryKey(),
  bookingId: int("bookingId").notNull(),
  oldSlotId: int("oldSlotId").notNull(),
  newSlotId: int("newSlotId").notNull(),
  note: text("note"),
  changedAtMs: bigint("changedAtMs", { mode: "number" }).notNull(),
  changedBy: varchar("changedBy", { length: 120 }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AdminCredential = typeof adminCredentials.$inferSelect;
export type InsertAdminCredential = typeof adminCredentials.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type BookingLink = typeof bookingLinks.$inferSelect;
export type InsertBookingLink = typeof bookingLinks.$inferInsert;
export type StatisticOption = typeof statisticOptions.$inferSelect;
export type InsertStatisticOption = typeof statisticOptions.$inferInsert;
export type StatisticResponse = typeof statisticResponses.$inferSelect;
export type InsertStatisticResponse = typeof statisticResponses.$inferInsert;
export type StatisticResponseHistory = typeof statisticResponseHistory.$inferSelect;
export type InsertStatisticResponseHistory = typeof statisticResponseHistory.$inferInsert;
export type Resident = typeof residents.$inferSelect;
export type InsertResident = typeof residents.$inferInsert;
export type BookingSlot = typeof bookingSlots.$inferSelect;
export type InsertBookingSlot = typeof bookingSlots.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type BookingReschedule = typeof bookingReschedules.$inferSelect;
export type InsertBookingReschedule = typeof bookingReschedules.$inferInsert;
