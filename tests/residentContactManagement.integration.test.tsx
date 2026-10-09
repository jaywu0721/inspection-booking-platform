/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveResidentMutate, toastError } = vi.hoisted(() => ({
  saveResidentMutate: vi.fn(),
  toastError: vi.fn(),
}));

const dashboardData = {
  companies: [{ id: 10, name: "鷁欣建設" }],
  projects: [{ id: 20, companyId: 10, name: "松園" }],
  residents: [
    { id: 101, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912000001", name: "王小明" },
  ],
  links: [],
  slots: [],
  bookings: [],
  reschedules: [],
};

vi.mock("../client/src/lib/adminRedirect", () => ({ redirectToAdminDashboardAfterLogin: vi.fn() }));
vi.mock("../client/src/hooks/useRescheduleAvailabilitySync", () => ({ useRescheduleAvailabilitySync: () => ({ syncOnDropdownOpen: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }));
vi.mock("../client/src/components/ui/tabs", () => {
  const Context = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({});
  return {
    Tabs: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) => <Context.Provider value={{ value, onValueChange }}><div>{children}</div></Context.Provider>,
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => { const context = React.useContext(Context); return <button type="button" onClick={() => context.onValueChange?.(value)}>{children}</button>; },
    TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => { const context = React.useContext(Context); return context.value === value ? <div>{children}</div> : null; },
  };
});
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { dashboard: { invalidate: vi.fn() }, searchBookings: { invalidate: vi.fn() }, bookingAvailability: { invalidate: vi.fn() }, rescheduleAvailability: { invalidate: vi.fn() } } }),
    adminAuth: {
      me: { useQuery: () => ({ data: { username: "admin" }, refetch: vi.fn(), isLoading: false }) },
      login: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      logout: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    admin: {
      dashboard: { useQuery: () => ({ data: dashboardData }) },
      searchBookings: { useQuery: () => ({ data: [] }) },
      bookingAvailability: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      rescheduleAvailability: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      saveCompany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveProject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveResident: { useMutation: () => ({ mutate: saveResidentMutate, isPending: false }) },
      saveLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveSlot: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      deleteSlot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      rescheduleBooking: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createBooking: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteCompany: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteProject: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteResident: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }) },
      deleteLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      toggleLinkEnabled: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import AdminPage from "../client/src/pages/AdminPage";

describe("AdminPage resident contact management", () => {
  beforeEach(() => {
    cleanup();
    saveResidentMutate.mockReset();
    toastError.mockReset();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  function openResidents() {
    render(<AdminPage />);
    fireEvent.click(screen.getByRole("button", { name: "住戶" }));
    return screen.getByText("住戶清單").closest("[data-slot='card']") as HTMLElement;
  }

  it("replaces the note column with name and edits only the individual contact fields", () => {
    const listCard = openResidents();
    expect(within(listCard).getByText("姓名")).toBeTruthy();
    expect(within(listCard).queryByText("備註")).toBeNull();

    fireEvent.click(within(listCard).getByRole("button", { name: "編輯" }));
    expect(screen.getByText("編輯住戶聯絡資料")).toBeTruthy();
    expect(screen.getByDisplayValue("A1-01")).toBeTruthy();
    expect(screen.getByDisplayValue("王小明")).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("0912000001"), { target: { value: "0912999999" } });
    fireEvent.change(screen.getByDisplayValue("王小明"), { target: { value: "王小華" } });
    fireEvent.click(screen.getByRole("button", { name: "更新聯絡資料" }));

    expect(saveResidentMutate).toHaveBeenCalledWith({ id: 101, companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "0912999999", name: "王小華" });
  });

  it("adds another contact for the same unit, allows name-only data, and blocks a fully blank contact", () => {
    const listCard = openResidents();
    fireEvent.click(within(listCard).getByRole("button", { name: "新增該戶資料" }));
    expect(screen.getAllByText("新增該戶資料").length).toBeGreaterThan(1);
    expect(screen.getByDisplayValue("A1-01")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "儲存新增資料" }));
    expect(toastError).toHaveBeenCalledWith("手機號碼與姓名至少需填寫一項");

    fireEvent.change(screen.getAllByRole("textbox")[2], { target: { value: "王小美" } });
    fireEvent.click(screen.getByRole("button", { name: "儲存新增資料" }));
    expect(saveResidentMutate).toHaveBeenLastCalledWith({ companyId: 10, projectId: 20, unitNumber: "A1-01", phoneNumber: "", name: "王小美" });
  });
});
