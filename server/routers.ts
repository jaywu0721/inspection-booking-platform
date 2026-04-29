import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  clearAdminSessionCookie,
  getAdminSessionFromHeader,
  setAdminSessionCookie,
} from "./adminAuth";
import {
  createBookingRecord,
  deleteBookingLinkRecord,
  deleteBookingSlotRecord,
  deleteCompanyRecord,
  deleteProjectRecord,
  deleteResidentRecord,
  getAdminDashboardData,
  getAdminProfile,
  getAdminRescheduleAvailability,
  getPublicSiteContext,
  rescheduleBookingRecord,
  searchBookings,
  setBookingLinkEnabledRecord,
  upsertBookingLinkRecord,
  upsertBookingSlotRecord,
  upsertCompanyRecord,
  upsertProjectRecord,
  upsertResidentRecord,
  validateAdminLogin,
  verifyResidentForBooking,
} from "./db";

const bookingTypeSchema = z.enum(["initial", "reinspect"]);
const bookingStatusSchema = z.enum(["booked", "rescheduled", "cancelled"]);
const publicSiteLocatorSchema = z
  .object({
    linkToken: z.string().min(1).optional(),
    companySlug: z.string().min(1).optional(),
    projectSlug: z.string().min(1).optional(),
    type: bookingTypeSchema.optional(),
  })
  .refine(input => Boolean(input.linkToken) || Boolean(input.companySlug && input.projectSlug && input.type), {
    message: "缺少預約連結識別資訊",
  });

function requireAdmin(headers: Record<string, unknown> | undefined) {
  const cookieHeader = typeof headers?.cookie === "string" ? headers.cookie : undefined;
  const session = getAdminSessionFromHeader(cookieHeader);
  if (!session) {
    throw new Error("管理員尚未登入");
  }
  return session;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ?? null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  publicSite: router({
    getContext: publicProcedure.input(publicSiteLocatorSchema).query(({ input }) => getPublicSiteContext(input)),
    verifyResident: publicProcedure
      .input(
        publicSiteLocatorSchema.safeExtend({
          unitNumber: z.string().min(1),
          phoneNumber: z.string().min(1),
        })
      )
      .mutation(({ input }) => verifyResidentForBooking(input)),
    createBooking: publicProcedure
      .input(
        publicSiteLocatorSchema.safeExtend({
          residentId: z.number().int().positive(),
          slotId: z.number().int().positive(),
          gmail: z
            .string()
            .trim()
            .min(1, { message: "請填寫信箱" })
            .email({ message: "請填寫有效的 Email 信箱" })
            .refine(value => value.endsWith("@gmail.com"), {
              message: "請填寫 Gmail 信箱",
            }),
          hasInspectionCompany: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        const bookingId = await createBookingRecord(input);
        return { success: true, bookingId } as const;
      }),
  }),
  adminAuth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      const session = getAdminSessionFromHeader(ctx.req.headers.cookie);
      if (!session) return null;
      return getAdminProfile(session.username);
    }),
    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isValid = await validateAdminLogin(input.username, input.password);
        if (!isValid) {
          throw new Error("帳號或密碼錯誤");
        }
        setAdminSessionCookie(ctx.res, input.username);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearAdminSessionCookie(ctx.res);
      return { success: true } as const;
    }),
  }),
  admin: router({
    dashboard: publicProcedure.query(({ ctx }) => {
      const cookieHeader = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : undefined;
      const session = getAdminSessionFromHeader(cookieHeader);
      if (!session) {
        return {
          companies: [],
          projects: [],
          residents: [],
          links: [],
          slots: [],
          bookings: [],
          reschedules: [],
        };
      }
      return getAdminDashboardData();
    }),
    saveCompany: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          slug: z.string().min(1),
          name: z.string().min(1),
          logoUrl: z.string().url(),
          contactPhone: z.string().min(1),
          contactEmail: z.string().email().optional().or(z.literal("")),
          heroTitle: z.string().min(1),
          heroDescription: z.string().min(1),
          inspectionFlow: z.string().min(1),
          handoverFlow: z.string().min(1),
          precautions: z.string().min(1),
          faqItems: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(1),
          contactWindow: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        const id = await upsertCompanyRecord({ ...input, contactEmail: input.contactEmail || null });
        return { success: true, id } as const;
      }),
    saveProject: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          companyId: z.number().int().positive(),
          slug: z.string().min(1).optional(),
          name: z.string().min(1),
          unitFormatHint: z.string().min(1),
          houseNumberExample: z.string().min(1),
          address: z.string().optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        const id = await upsertProjectRecord({ ...input, address: input.address || null });
        return { success: true, id } as const;
      }),
    saveResident: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          companyId: z.number().int().positive(),
          projectId: z.number().int().positive(),
          unitNumber: z.string().min(1),
          phoneNumber: z.string().min(1),
          note: z.string().optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        const id = await upsertResidentRecord({ ...input, note: input.note || null });
        return { success: true, id } as const;
      }),
    deleteCompany: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        await deleteCompanyRecord(input.id);
        return { success: true } as const;
      }),
    deleteProject: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        await deleteProjectRecord(input.id);
        return { success: true } as const;
      }),
    deleteResident: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        await deleteResidentRecord(input.id);
        return { success: true } as const;
      }),
    deleteLink: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        await deleteBookingLinkRecord(input.id);
        return { success: true } as const;
      }),
    toggleLinkEnabled: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          isEnabled: z.boolean(),
          disabledReason: z.string().optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        await setBookingLinkEnabledRecord({
          id: input.id,
          isEnabled: input.isEnabled,
          disabledReason: input.disabledReason || null,
        });
        return { success: true } as const;
      }),
    saveLink: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          companyId: z.number().int().positive(),
          projectId: z.number().int().positive(),
          type: bookingTypeSchema,
          isEnabled: z.boolean(),
          startsAt: z.coerce.date(),
          endsAt: z.coerce.date(),
          disabledReason: z.string().optional().or(z.literal("")),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        const id = await upsertBookingLinkRecord({ ...input, disabledReason: input.disabledReason || null });
        return { success: true, id } as const;
      }),
    saveSlot: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          linkId: z.number().int().positive(),
          slotDate: z.coerce.date(),
          startLabel: z.string().min(1),
          endLabel: z.string().min(1),
          capacity: z.number().int().positive(),
          isActive: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        const id = await upsertBookingSlotRecord(input);
        return { success: true, id } as const;
      }),
    deleteSlot: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        await deleteBookingSlotRecord(input.id);
        return { success: true } as const;
      }),
    searchBookings: publicProcedure
      .input(
        z.object({
          projectId: z.number().int().positive().optional(),
          linkId: z.number().int().positive().optional(),
          unitNumber: z.string().optional(),
          bookingType: bookingTypeSchema.optional(),
          status: bookingStatusSchema.optional(),
          bookingDate: z.string().optional(),
        })
      )
      .query(({ ctx, input }) => {
        const cookieHeader = typeof ctx.req.headers.cookie === "string" ? ctx.req.headers.cookie : undefined;
        const session = getAdminSessionFromHeader(cookieHeader);
        if (!session) {
          return [];
        }
        return searchBookings(input);
      }),
    rescheduleAvailability: publicProcedure
      .input(z.object({ bookingId: z.number().int().positive() }))
      .query(({ ctx, input }) => {
        requireAdmin(ctx.req.headers);
        return getAdminRescheduleAvailability(input.bookingId);
      }),
    rescheduleBooking: publicProcedure
      .input(
        z.object({
          bookingId: z.number().int().positive(),
          newSlotId: z.number().int().positive(),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = requireAdmin(ctx.req.headers);
        const id = await rescheduleBookingRecord({ ...input, changedBy: session.username });
        return { success: true, id } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
