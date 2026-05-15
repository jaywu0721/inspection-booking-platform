/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, searchBookingsUseQuery, bookingAvailabilityUseQuery, createBookingMutate } = vi.hoisted(() => {
  const createDashboardData = () => ({
    companies: [{ id: 10, name: "鷁欣建設" }],
    projects: [{ id: 20, companyId: 10, name: "A1" }],
    links: [
      {
        id: 30,
        companyId: 10,
        projectId: 20,
        type: "initial" as const,
        isEnabled: true,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T00:00:00.000Z"),
      },
      {
        id: 31,
        companyId: 10,
        projectId: 20,
        type: "reinspect" as const,
        isEnabled: false,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T00:00:00.000Z"),
      },
    ],
    slots: [],
    residents: [
      { id: 201, projectId: 20, unitNumber: "12F-1", phoneNumber: "0912000001", note: "已預約" },
      { id: 202, projectId: 20, unitNumber: "12F-2", phoneNumber: "0912000002", note: "尚未預約" },
      { id: 203, projectId: 20, unitNumber: "12F-3", phoneNumber: "0912000003", note: "已取消後未補約" },
      { id: 204, projectId: 20, unitNumber: " 12f-2 ", phoneNumber: "0912000004", note: "同戶第二聯絡人" },
    ],
    bookings: [
      { id: 1, projectId: 20, unitNumberSnapshot: "12F-1", status: "booked" },
      { id: 2, projectId: 20, unitNumberSnapshot: "12F-3", status: "cancelled" },
    ],
    reschedules: [],
  });

  const createSearchBookingsResult = () => [
    {
      id: 1,
      companyId: 10,
      projectId: 20,
      linkId: 30,
      slotId: 40,
      companyName: "鷁欣建設",
      projectName: "A1",
      bookingType: "initial" as const,
      unitNumberSnapshot: "12F-1",
      phoneNumberSnapshot: "0912345678",
      gmail: "owner1@example.com",
      hasInspectionCompany: true,
      status: "booked" as const,
      internalNote: null,
      createdAtMs: 1,
      updatedAtMs: 1,
      slotDate: new Date("2026-05-05T00:00:00.000Z"),
      startLabel: "09:00",
      endLabel: "10:30",
    },
    {
      id: 2,
      companyId: 10,
      projectId: 20,
      linkId: 31,
      slotId: 41,
      companyName: "鷁欣建設",
      projectName: "A1",
      bookingType: "reinspect" as const,
      unitNumberSnapshot: "12F-2",
      phoneNumberSnapshot: "0922333444",
      gmail: "owner2@example.com",
      hasInspectionCompany: false,
      status: "rescheduled" as const,
      internalNote: "改期一次",
      createdAtMs: 2,
      updatedAtMs: 2,
      slotDate: new Date("2026-05-06T00:00:00.000Z"),
      startLabel: "14:00",
      endLabel: "15:30",
    },
  ];

  const createBookingAvailabilityData = () => [
    {
      id: 40,
      companyId: 10,
      projectId: 20,
      linkId: 30,
      slotDate: new Date("2026-05-08T00:00:00.000Z"),
      startLabel: "09:00",
      endLabel: "10:30",
      capacity: 2,
      isActive: true,
      remaining: 1,
      isCurrentSlot: false,
    },
    {
      id: 41,
      companyId: 10,
      projectId: 20,
      linkId: 30,
      slotDate: new Date("2026-05-08T00:00:00.000Z"),
      startLabel: "14:00",
      endLabel: "15:30",
      capacity: 2,
      isActive: true,
      remaining: 0,
      isCurrentSlot: false,
    },
  ];

  return {
    state: {
      currentDashboardData: createDashboardData(),
      currentSearchBookingsResult: createSearchBookingsResult(),
      bookingAvailabilityData: createBookingAvailabilityData(),
      reset() {
        this.currentDashboardData = createDashboardData();
        this.currentSearchBookingsResult = createSearchBookingsResult();
        this.bookingAvailabilityData = createBookingAvailabilityData();
      },
    },
    searchBookingsUseQuery: vi.fn(),
    bookingAvailabilityUseQuery: vi.fn(),
    createBookingMutate: vi.fn(),
  };
});

vi.mock("../client/src/lib/adminRedirect", () => ({
  redirectToAdminDashboardAfterLogin: vi.fn(),
}));

vi.mock("../client/src/hooks/useRescheduleAvailabilitySync", () => ({
  useRescheduleAvailabilitySync: () => ({ syncOnDropdownOpen: vi.fn() }),
}));

vi.mock("../client/src/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (value === "bookings" ? <div>{children}</div> : null),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

searchBookingsUseQuery.mockImplementation((filters?: { projectId?: number; linkId?: number }) => ({
  data:
    typeof filters?.linkId === "number"
      ? state.currentSearchBookingsResult.filter(booking => booking.linkId === filters.linkId)
      : state.currentSearchBookingsResult,
}));

bookingAvailabilityUseQuery.mockImplementation(() => ({
  data: state.bookingAvailabilityData,
  error: undefined,
  isFetching: false,
  refetch: vi.fn(),
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        dashboard: { invalidate: vi.fn() },
        searchBookings: { invalidate: vi.fn() },
        bookingAvailability: { invalidate: vi.fn() },
        rescheduleAvailability: { invalidate: vi.fn() },
      },
    }),
    adminAuth: {
      me: {
        useQuery: () => ({ data: { username: "admin" }, refetch: vi.fn() }),
      },
      login: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      logout: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
    admin: {
      dashboard: {
        useQuery: () => ({ data: state.currentDashboardData }),
      },
      searchBookings: {
        useQuery: searchBookingsUseQuery,
      },
      bookingAvailability: {
        useQuery: bookingAvailabilityUseQuery,
      },
      rescheduleAvailability: {
        useQuery: () => ({ data: [], error: undefined, isFetching: false, refetch: vi.fn() }),
      },
      saveCompany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveProject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveResident: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveSlot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteSlot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rescheduleBooking: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createBooking: {
        useMutation: (options?: { onSuccess?: (data: { success: true; id: number }) => void }) => ({
          mutate: (input: { linkId: number; residentId: number; slotId: number; gmail: string; hasInspectionCompany: boolean; note?: string }) => {
            createBookingMutate(input);
            const resident = state.currentDashboardData.residents.find(item => item.id === input.residentId);
            const project = resident ? state.currentDashboardData.projects.find(item => item.id === resident.projectId) : undefined;
            const company = project ? state.currentDashboardData.companies.find(item => item.id === project.companyId) : undefined;
            if (!resident || !project || !company) {
              throw new Error("測試假資料缺少必要關聯");
            }

            const nextId = 99;
            state.currentDashboardData = {
              ...state.currentDashboardData,
              bookings: [
                ...state.currentDashboardData.bookings,
                { id: nextId, projectId: project.id, unitNumberSnapshot: resident.unitNumber, status: "booked" as const },
              ],
            };
            state.currentSearchBookingsResult = [
              ...state.currentSearchBookingsResult,
              {
                id: nextId,
                companyId: company.id,
                projectId: project.id,
                linkId: input.linkId,
                slotId: input.slotId,
                companyName: company.name,
                projectName: project.name,
                bookingType: "initial" as const,
                unitNumberSnapshot: resident.unitNumber,
                phoneNumberSnapshot: resident.phoneNumber,
                gmail: input.gmail,
                hasInspectionCompany: input.hasInspectionCompany,
                status: "booked" as const,
                internalNote: input.note ?? null,
                createdAtMs: 3,
                updatedAtMs: 3,
                slotDate: new Date("2026-05-08T00:00:00.000Z"),
                startLabel: "09:00",
                endLabel: "10:30",
              },
            ];
            options?.onSuccess?.({ success: true, id: nextId });
          },
          isPending: false,
        }),
      },
      deleteCompany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteProject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteResident: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      toggleLinkEnabled: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AdminPage from "../client/src/pages/AdminPage";

describe("AdminPage booking inspection company integration", () => {
  beforeEach(() => {
    state.reset();
    searchBookingsUseQuery.mockClear();
    bookingAvailabilityUseQuery.mockClear();
    createBookingMutate.mockClear();
  });

  it("renders the inspection company column from trpc searchBookings data", () => {
    render(<AdminPage />);

    expect(screen.getByText("是否驗屋公司")).toBeTruthy();
    expect(screen.getAllByText("有")).toHaveLength(1);
    expect(screen.getAllByText("無")).toHaveLength(1);
    expect(screen.getAllByText("鷁欣建設 / A1").length).toBeGreaterThanOrEqual(1);
  });

  it("shows project-specific booking links and sends linkId back to the booking query", () => {
    searchBookingsUseQuery.mockClear();
    render(<AdminPage />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "20" } });

    expect(screen.getByRole("option", { name: "initial / #30" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "reinspect / #31（已停用）" })).toBeTruthy();

    fireEvent.change(selects[1], { target: { value: "30" } });

    expect(searchBookingsUseQuery.mock.calls.at(-1)?.[0]).toMatchObject({ projectId: 20, linkId: 30 });

    const bookingTable = screen.getAllByRole("table").find(table => within(table).queryByText("是否驗屋公司"));
    expect(bookingTable).toBeTruthy();
    expect(within(bookingTable as HTMLElement).getByText("12F-1")).toBeTruthy();
    expect(within(bookingTable as HTMLElement).queryByText("12F-2")).toBeNull();
  });

  it("shows unbooked residents for the selected project when the admin clicks the shortcut button", () => {
    render(<AdminPage />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "20" } });
    fireEvent.click(screen.getAllByRole("button", { name: "查看未完成預約住戶" })[0]);

    expect(screen.getByText("2 戶未完成")).toBeTruthy();

    const unbookedTable = screen
      .getAllByRole("table")
      .find(table => within(table).queryByText("備註") && within(table).queryByText("尚未預約"));

    expect(unbookedTable).toBeTruthy();
    expect(within(unbookedTable as HTMLElement).getAllByText("12F-2").length).toBe(1);
    expect(within(unbookedTable as HTMLElement).getByText("12F-3")).toBeTruthy();
    expect(within(unbookedTable as HTMLElement).queryByText("12F-1")).toBeNull();
  });

  it("books an unbooked resident from the admin shortcut and removes the resident from the unfinished list", async () => {
    render(<AdminPage />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "20" } });
    fireEvent.change(selects[1], { target: { value: "30" } });
    fireEvent.click(screen.getAllByRole("button", { name: "查看未完成預約住戶" })[0]);

    const unbookedTable = screen
      .getAllByRole("table")
      .find(table => within(table).queryByText("備註") && within(table).queryByText("尚未預約"));

    expect(unbookedTable).toBeTruthy();

    const residentRow = within(unbookedTable as HTMLElement).getAllByRole("row").find(row => within(row).queryByText("12F-3"));
    expect(residentRow).toBeTruthy();

    fireEvent.click(within(residentRow as HTMLElement).getByRole("button", { name: "代客預約" }));
    fireEvent.change(screen.getByLabelText("預約日期"), { target: { value: "2026-05-08" } });
    fireEvent.change(screen.getByLabelText("預約時段"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("備註"), { target: { value: "後台協助住戶完成預約" } });
    fireEvent.change(screen.getByLabelText("Email（選填）"), { target: { value: "owner3@example.com" } });
    fireEvent.click(screen.getByLabelText("是否驗屋公司"));
    fireEvent.click(screen.getByRole("button", { name: "確認代客預約" }));

    expect(createBookingMutate).toHaveBeenCalledWith({
      linkId: 30,
      residentId: 203,
      slotId: 40,
      note: "後台協助住戶完成預約",
      gmail: "owner3@example.com",
      hasInspectionCompany: true,
    });

    await waitFor(() => {
      expect(screen.getByText("1 戶未完成")).toBeTruthy();
    });

    const refreshedUnbookedTable = screen
      .getAllByRole("table")
      .find(table => within(table).queryByText("備註") && within(table).queryByText("尚未預約"));

    expect(refreshedUnbookedTable).toBeTruthy();
    expect(within(refreshedUnbookedTable as HTMLElement).queryByText("12F-3")).toBeNull();
    expect(screen.getAllByText("12F-3").length).toBeGreaterThan(0);
  });
});
