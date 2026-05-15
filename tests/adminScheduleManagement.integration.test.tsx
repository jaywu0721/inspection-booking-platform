/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastSuccess, toastError, saveSlotMutateAsync } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  saveSlotMutateAsync: vi.fn(),
}));

const dashboardData = {
  companies: [{ id: 10, name: "鷁欣建設" }],
  projects: [{ id: 20, companyId: 10, name: "A1" }],
  links: [
    {
      id: 30,
      companyId: 10,
      projectId: 20,
      type: "initial" as const,
      isEnabled: true,
      startsAt: new Date("2026-05-01T00:00:00.000Z"),
      endsAt: new Date("2026-05-31T23:59:00.000Z"),
      disabledReason: null,
      shareToken: "share-30",
    },
  ],
  slots: [
    {
      id: 401,
      companyId: 10,
      projectId: 20,
      linkId: 30,
      slotDate: new Date("2026-05-06T00:00:00.000Z"),
      startLabel: "09:00",
      endLabel: "10:30",
      capacity: 2,
      isActive: true,
    },
  ],
  residents: [],
  bookings: [],
  reschedules: [],
};

vi.mock("../client/src/lib/adminRedirect", () => ({
  redirectToAdminDashboardAfterLogin: vi.fn(),
}));

vi.mock("../client/src/hooks/useRescheduleAvailabilitySync", () => ({
  useRescheduleAvailabilitySync: () => ({ syncOnDropdownOpen: vi.fn() }),
}));

vi.mock("../client/src/components/ui/tabs", () => {
  const TabsContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

  return {
    Tabs: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (value: string) => void }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => {
      const context = React.useContext(TabsContext);
      return (
        <button type="button" disabled={disabled} onClick={() => context.onValueChange?.(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const context = React.useContext(TabsContext);
      return context.value === value ? <div>{children}</div> : null;
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
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
        useQuery: () => ({ data: { username: "admin" }, refetch: vi.fn(), isLoading: false }),
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
        useQuery: () => ({ data: [] }),
      },
      bookingAvailability: {
        useQuery: () => ({ data: [], error: undefined, isFetching: false, refetch: vi.fn() }),
      },
      rescheduleAvailability: {
        useQuery: () => ({ data: [], error: undefined, isFetching: false, refetch: vi.fn() }),
      },
      saveCompany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveProject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveResident: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveSlot: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: saveSlotMutateAsync, isPending: false }) },
      deleteSlot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rescheduleBooking: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createBooking: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteCompany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteProject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteResident: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      toggleLinkEnabled: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AdminPage from "../client/src/pages/AdminPage";

describe("AdminPage schedule management UI", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    saveSlotMutateAsync.mockReset();
    saveSlotMutateAsync.mockResolvedValue({ success: true });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("removes the disabled reason field from link management and link records table", () => {
    render(<AdminPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "連結與時段" })[0]);

    expect(screen.queryByLabelText("停用原因")).toBeNull();
    expect(screen.queryByText("停用原因")).toBeNull();
    expect(screen.getByText("預約連結管理")).toBeTruthy();
  });

  it("switches to the 日期區間 tab and shows range fields for preset slot creation", () => {
    render(<AdminPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "連結與時段" })[0]);

    const slotManagementCard = screen.getAllByText("時段管理")[0].closest("[data-slot='card']") as HTMLElement;

    const slotSelects = within(slotManagementCard).getAllByRole("combobox");

    fireEvent.change(slotSelects[0], { target: { value: "10" } });
    fireEvent.change(slotSelects[1], { target: { value: "20" } });
    fireEvent.change(slotSelects[2], { target: { value: "30" } });
    fireEvent.click(within(slotManagementCard).getByRole("button", { name: "驗屋預約連接開放時間：日期區間" }));

    expect(within(slotManagementCard).getByText("區間開始")).toBeTruthy();
    expect(within(slotManagementCard).getByText("區間結束")).toBeTruthy();
    expect(within(slotManagementCard).getByText(/系統會對區間內每一天建立同一組預設時段/)).toBeTruthy();
  });

  it("creates preset slots for every day inside the selected date range", async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "連結與時段" })[0]);

    const slotManagementCard = screen.getAllByText("時段管理")[0].closest("[data-slot='card']") as HTMLElement;
    const slotSelects = within(slotManagementCard).getAllByRole("combobox");

    fireEvent.change(slotSelects[0], { target: { value: "10" } });
    fireEvent.change(slotSelects[1], { target: { value: "20" } });
    fireEvent.change(slotSelects[2], { target: { value: "30" } });
    fireEvent.click(within(slotManagementCard).getByRole("button", { name: "驗屋預約連接開放時間：日期區間" }));
    const rangeDateInputs = slotManagementCard.querySelectorAll('input[type="date"]');
    fireEvent.change(rangeDateInputs[0], { target: { value: "2026-05-07" } });
    fireEvent.change(rangeDateInputs[1], { target: { value: "2026-05-08" } });

    fireEvent.click(within(slotManagementCard).getByRole("button", { name: "一鍵建立預設時段" }));

    await waitFor(() => {
      expect(saveSlotMutateAsync).toHaveBeenCalledTimes(8);
    });

    const payloadSummary = saveSlotMutateAsync.mock.calls
      .map(([payload]) => ({
        linkId: payload.linkId,
        slotDate: payload.slotDate.toISOString().slice(0, 10),
        startLabel: payload.startLabel,
        endLabel: payload.endLabel,
        capacity: payload.capacity,
        isActive: payload.isActive,
      }))
      .sort((left, right) => `${left.slotDate}-${left.startLabel}`.localeCompare(`${right.slotDate}-${right.startLabel}`));

    expect(payloadSummary).toEqual([
      { linkId: 30, slotDate: "2026-05-07", startLabel: "09:00", endLabel: "10:30", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-07", startLabel: "10:30", endLabel: "12:00", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-07", startLabel: "14:00", endLabel: "15:30", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-07", startLabel: "15:30", endLabel: "17:00", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-08", startLabel: "09:00", endLabel: "10:30", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-08", startLabel: "10:30", endLabel: "12:00", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-08", startLabel: "14:00", endLabel: "15:30", capacity: 1, isActive: true },
      { linkId: 30, slotDate: "2026-05-08", startLabel: "15:30", endLabel: "17:00", capacity: 1, isActive: true },
    ]);
  });

  it("blocks range preset creation when any date already has the same slot for the selected link", async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "連結與時段" })[0]);

    const slotManagementCard = screen.getAllByText("時段管理")[0].closest("[data-slot='card']") as HTMLElement;
    const slotSelects = within(slotManagementCard).getAllByRole("combobox");

    fireEvent.change(slotSelects[0], { target: { value: "10" } });
    fireEvent.change(slotSelects[1], { target: { value: "20" } });
    fireEvent.change(slotSelects[2], { target: { value: "30" } });
    fireEvent.click(within(slotManagementCard).getByRole("button", { name: "驗屋預約連接開放時間：日期區間" }));
    const rangeDateInputs = slotManagementCard.querySelectorAll('input[type="date"]');
    fireEvent.change(rangeDateInputs[0], { target: { value: "2026-05-06" } });
    fireEvent.change(rangeDateInputs[1], { target: { value: "2026-05-07" } });

    fireEvent.click(within(slotManagementCard).getByRole("button", { name: "一鍵建立預設時段" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("此預約連結在 2026-05-06 的 09:00-10:30 已存在，請先調整後再建立");
    });
    expect(saveSlotMutateAsync).not.toHaveBeenCalled();
  });

  it("loads slot data back into slot management when clicking edit and gives explicit feedback", async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "連結與時段" })[0]);

    const slotTable = screen.getAllByRole("table")[1];
    fireEvent.click(within(slotTable).getByRole("button", { name: "編輯" }));

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("已帶入該時段資料，請直接在上方時段管理區編輯");
    });

    const slotManagementCard = screen.getAllByText("時段管理")[0].closest("[data-slot='card']") as HTMLElement;
    expect(within(slotManagementCard).getByDisplayValue("2026-05-06")).toBeTruthy();
    expect(within(slotManagementCard).getByRole("button", { name: "更新時段" })).toBeTruthy();
  });
});
