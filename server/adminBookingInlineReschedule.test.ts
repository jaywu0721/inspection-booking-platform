// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

const mocks = vi.hoisted(() => {
  const invalidate = vi.fn(async () => undefined);
  const refetch = vi.fn(async () => ({ data: { username: "admin" } }));
  const noopMutate = vi.fn();
  const noopMutateAsync = vi.fn(async () => undefined);
  const rescheduleMutate = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const dashboardData = {
    companies: [
      {
        id: 1,
        slug: "yisin",
        name: "鷁欣建設",
        logoUrl: "https://example.com/logo.png",
        contactPhone: "04-0000-0001",
        contactEmail: "service@example.com",
        heroTitle: "Hero",
        heroDescription: "Description",
        inspectionFlow: "1. 驗證",
        handoverFlow: "交屋流程",
        precautions: "注意事項",
        faqItems: [],
        contactWindow: "週一到週五",
      },
    ],
    projects: [
      {
        id: 11,
        companyId: 1,
        slug: "demo-project",
        name: "鷁欣示範建案",
        unitFormatHint: "A-4-A",
        houseNumberExample: "A-4-A",
        address: "台中市測試路 1 號",
      },
    ],
    residents: [],
    links: [
      {
        id: 101,
        companyId: 1,
        projectId: 11,
        type: "initial",
        startsAt: new Date("2026-05-01T00:00:00.000Z"),
        endsAt: new Date("2026-05-31T00:00:00.000Z"),
        isEnabled: true,
        disabledReason: null,
        shareToken: "token-101",
      },
    ],
    slots: [
      {
        id: 2001,
        companyId: 1,
        projectId: 11,
        linkId: 101,
        slotDate: new Date("2026-05-22T00:00:00.000Z"),
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: 3,
        isActive: true,
      },
      {
        id: 2002,
        companyId: 1,
        projectId: 11,
        linkId: 101,
        slotDate: new Date("2026-05-23T00:00:00.000Z"),
        startLabel: "14:00",
        endLabel: "15:30",
        capacity: 2,
        isActive: true,
      },
      {
        id: 2003,
        companyId: 1,
        projectId: 11,
        linkId: 101,
        slotDate: new Date("2026-05-23T00:00:00.000Z"),
        startLabel: "15:30",
        endLabel: "17:00",
        capacity: 1,
        isActive: true,
      },
    ],
    bookings: [],
  };

  const bookingRows = [
    {
      id: 5001,
      companyId: 1,
      projectId: 11,
      linkId: 101,
      slotId: 2001,
      companyName: "鷁欣建設",
      projectName: "鷁欣示範建案",
      bookingType: "initial",
      unitNumberSnapshot: "A-4-A",
      phoneNumberSnapshot: "0912345678",
      gmail: "owner@gmail.com",
      hasInspectionCompany: false,
      status: "booked",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      slotDate: new Date("2026-05-22T00:00:00.000Z"),
      startLabel: "09:00",
      endLabel: "10:30",
      internalNote: "原始備註",
    },
  ];

  return {
    invalidate,
    refetch,
    noopMutate,
    noopMutateAsync,
    rescheduleMutate,
    toastSuccess,
    toastError,
    dashboardData,
    bookingRows,
  };
});

vi.mock("@/lib/adminRedirect", () => ({
  redirectToAdminDashboardAfterLogin: vi.fn(async () => undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        dashboard: { invalidate: mocks.invalidate },
        searchBookings: { invalidate: mocks.invalidate },
      },
    }),
    adminAuth: {
      me: {
        useQuery: () => ({
          data: { username: "admin" },
          isLoading: false,
          refetch: mocks.refetch,
        }),
      },
      login: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      logout: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
    },
    admin: {
      dashboard: {
        useQuery: () => ({
          data: mocks.dashboardData,
          isLoading: false,
        }),
      },
      searchBookings: {
        useQuery: () => ({
          data: mocks.bookingRows,
          isLoading: false,
        }),
      },
      saveCompany: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      saveProject: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      saveResident: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      saveLink: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      saveSlot: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      deleteCompany: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      deleteProject: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      deleteResident: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      deleteLink: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      deleteSlot: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      toggleLinkEnabled: { useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }) },
      rescheduleBooking: {
        useMutation: () => ({
          isPending: false,
          mutate: mocks.rescheduleMutate,
          mutateAsync: mocks.noopMutateAsync,
        }),
      },
    },
  },
}));

import AdminPage from "../client/src/pages/AdminPage";

describe("admin booking inline reschedule ui", () => {
  beforeEach(() => {
    mocks.invalidate.mockClear();
    mocks.refetch.mockClear();
    mocks.noopMutate.mockClear();
    mocks.noopMutateAsync.mockClear();
    mocks.rescheduleMutate.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("allows editing a booking row to choose a new date and then a new slot", async () => {
    const user = userEvent.setup();
    render(createElement(AdminPage));

    await user.click(screen.getByRole("tab", { name: "預約與改期" }));
    const panel = screen.getByRole("tabpanel", { name: "預約與改期" });

    await user.click(within(panel).getByRole("button", { name: "編輯改期" }));

    const confirmButton = await within(panel).findByRole("button", { name: "確認改期" });
    const editRow = confirmButton.closest("tr");
    if (!editRow) throw new Error("找不到內嵌改期列");

    const [dateSelect, slotSelect] = within(editRow).getAllByRole("combobox") as HTMLSelectElement[];
    const noteInput = within(editRow).getByPlaceholderText("例如：住戶要求改期") as HTMLInputElement;

    await user.selectOptions(dateSelect, "2026-05-23");
    expect(within(slotSelect).getByRole("option", { name: /14:00-15:30/i })).toBeTruthy();
    expect(within(slotSelect).getByRole("option", { name: /15:30-17:00/i })).toBeTruthy();

    await user.selectOptions(slotSelect, "2002");
    await user.clear(noteInput);
    await user.type(noteInput, "住戶要求改期");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mocks.rescheduleMutate).toHaveBeenCalledWith({
        bookingId: 5001,
        newSlotId: 2002,
        note: "住戶要求改期",
      });
    });
  });
});
