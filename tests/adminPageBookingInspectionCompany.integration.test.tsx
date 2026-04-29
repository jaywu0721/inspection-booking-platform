/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { dashboardData, searchBookingsUseQuery } = vi.hoisted(() => ({
  dashboardData: {
    companies: [{ id: 10, name: "鷁欣建設" }],
    projects: [{ id: 20, companyId: 10, name: "A1" }],
    links: [
      { id: 30, companyId: 10, projectId: 20, type: "initial" as const, isEnabled: true },
      { id: 31, companyId: 10, projectId: 20, type: "reinspect" as const, isEnabled: false },
    ],
    slots: [],
    residents: [],
    bookings: [],
    reschedules: [],
  },
  searchBookingsUseQuery: vi.fn(),
}));

const searchBookingsResult = [
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
  data: filters?.linkId === 30 ? [searchBookingsResult[0]] : searchBookingsResult,
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        dashboard: { invalidate: vi.fn() },
        searchBookings: { invalidate: vi.fn() },
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
        useQuery: () => ({ data: dashboardData }),
      },
      searchBookings: {
        useQuery: searchBookingsUseQuery,
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
});
