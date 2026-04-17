// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

const mocks = vi.hoisted(() => {
  const invalidate = vi.fn(async () => undefined);
  const refetch = vi.fn(async () => ({ data: { username: "admin" } }));
  const saveSlotMutateAsync = vi.fn(async (payload: unknown) => payload);
  const noopMutateAsync = vi.fn(async () => undefined);
  const noopMutate = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const dashboardData = {
    companies: [
      {
        id: 1,
        slug: "demo-company",
        name: "測試公司",
        logoUrl: "https://example.com/logo.png",
        contactPhone: "04-1234-5678",
        contactEmail: "demo@example.com",
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
        name: "測試建案",
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
        shareToken: "token-initial",
      },
      {
        id: 102,
        companyId: 1,
        projectId: 11,
        type: "reinspect",
        startsAt: new Date("2026-05-01T00:00:00.000Z"),
        endsAt: new Date("2026-05-31T00:00:00.000Z"),
        isEnabled: true,
        disabledReason: null,
        shareToken: "token-reinspect",
      },
    ],
    slots: [
      {
        id: 1001,
        projectId: 11,
        linkId: 101,
        slotDate: new Date("2026-05-22T00:00:00.000Z"),
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: 3,
        isActive: true,
      },
      {
        id: 1002,
        projectId: 11,
        linkId: 102,
        slotDate: new Date("2026-05-22T00:00:00.000Z"),
        startLabel: "14:00",
        endLabel: "15:30",
        capacity: 2,
        isActive: true,
      },
    ],
    bookings: [],
  };

  return {
    invalidate,
    refetch,
    saveSlotMutateAsync,
    noopMutateAsync,
    noopMutate,
    toastSuccess,
    toastError,
    dashboardData,
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
          data: [],
          isLoading: false,
        }),
      },
      saveCompany: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      saveProject: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      saveResident: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      saveLink: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      saveSlot: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.saveSlotMutateAsync }),
      },
      rescheduleBooking: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      deleteCompany: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      deleteProject: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      deleteResident: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      deleteLink: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      deleteSlot: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
      toggleLinkEnabled: {
        useMutation: () => ({ isPending: false, mutate: mocks.noopMutate, mutateAsync: mocks.noopMutateAsync }),
      },
    },
  },
}));

import AdminPage from "../client/src/pages/AdminPage";

function renderAdminPage() {
  return render(createElement(AdminPage));
}

async function openScheduleTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: "連結與時段" }));
  return screen.getByRole("tabpanel", { name: "連結與時段" });
}

async function selectSlotBuilderScope(schedulePanel: HTMLElement, user: ReturnType<typeof userEvent.setup>) {
  const selects = within(schedulePanel).getAllByRole("combobox");
  const slotBuilderSelects = selects.slice(-3) as HTMLSelectElement[];
  const [slotCompanySelect, slotProjectSelect, slotLinkSelect] = slotBuilderSelects;

  if (!slotCompanySelect || !slotProjectSelect || !slotLinkSelect) {
    throw new Error("找不到時段建立區的公司／建案／預約連結選單");
  }

  await user.selectOptions(slotCompanySelect, "1");
  await user.selectOptions(slotProjectSelect, "11");
  await user.selectOptions(slotLinkSelect, "101");
}

describe("slot management ui", () => {
  beforeEach(() => {
    mocks.invalidate.mockClear();
    mocks.refetch.mockClear();
    mocks.saveSlotMutateAsync.mockClear();
    mocks.noopMutate.mockClear();
    mocks.noopMutateAsync.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows link filter tags and only renders slots for the selected booking link", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    const schedulePanel = await openScheduleTab(user);
    expect(within(schedulePanel).getByText("依預約連結篩選時段")).toBeTruthy();
    expect(within(schedulePanel).getByRole("button", { name: /測試建案 \/ initial \/ #101/i })).toBeTruthy();
    expect(within(schedulePanel).getByRole("button", { name: /測試建案 \/ reinspect \/ #102/i })).toBeTruthy();

    await selectSlotBuilderScope(schedulePanel, user);

    expect(within(schedulePanel).getByText("09:00 - 10:30")).toBeTruthy();
    expect(within(schedulePanel).queryByText("14:00 - 15:30")).toBeNull();

    await user.click(within(schedulePanel).getByRole("button", { name: /測試建案 \/ reinspect \/ #102/i }));
    expect(within(schedulePanel).getByText("14:00 - 15:30")).toBeTruthy();
    expect(within(schedulePanel).queryByText("09:00 - 10:30")).toBeNull();
  });

  it("creates four preset slots for the selected link, date and capacity", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    const schedulePanel = await openScheduleTab(user);
    await selectSlotBuilderScope(schedulePanel, user);

    const slotDateInput = schedulePanel.querySelector('input[type="date"]') as HTMLInputElement;
    const capacityInput = schedulePanel.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(slotDateInput, { target: { value: "2026-05-23" } });
    fireEvent.change(capacityInput, { target: { value: "4" } });

    await user.click(within(schedulePanel).getByRole("button", { name: "一鍵建立預設時段" }));

    await waitFor(() => expect(mocks.saveSlotMutateAsync).toHaveBeenCalledTimes(4));

    const payloads = mocks.saveSlotMutateAsync.mock.calls.map(call => call[0]);
    expect(payloads).toHaveLength(4);
    expect(payloads[0]).toMatchObject({ linkId: 101, startLabel: "09:00", endLabel: "10:30", capacity: 4, isActive: true });
    expect(payloads[1]).toMatchObject({ linkId: 101, startLabel: "10:30", endLabel: "12:00", capacity: 4, isActive: true });
    expect(payloads[2]).toMatchObject({ linkId: 101, startLabel: "14:00", endLabel: "15:30", capacity: 4, isActive: true });
    expect(payloads[3]).toMatchObject({ linkId: 101, startLabel: "15:30", endLabel: "17:00", capacity: 4, isActive: true });

    for (const payload of payloads as Array<{ slotDate: Date }>) {
      expect(payload.slotDate).toBeInstanceOf(Date);
      expect(payload.slotDate.toISOString().slice(0, 10)).toBe("2026-05-23");
    }
  });

  it("shows a clear duplicate error message before submitting duplicate preset slots", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    const schedulePanel = await openScheduleTab(user);
    await selectSlotBuilderScope(schedulePanel, user);

    const slotDateInput = schedulePanel.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(slotDateInput, { target: { value: "2026-05-22" } });

    await user.click(within(schedulePanel).getByRole("button", { name: "一鍵建立預設時段" }));

    expect(mocks.saveSlotMutateAsync).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("此預約連結在 2026-05-22 的 09:00-10:30 已存在，請先調整後再建立");
  });

  it("resets edited preset drafts back to defaults so this-time changes do not pollute the next build", async () => {
    const user = userEvent.setup();
    renderAdminPage();

    const schedulePanel = await openScheduleTab(user);
    await selectSlotBuilderScope(schedulePanel, user);

    const firstPresetCard = within(schedulePanel).getByText("預設時段 1").closest("div")?.parentElement;
    if (!firstPresetCard) {
      throw new Error("找不到第一個預設時段卡片");
    }

    const firstPresetInputs = within(firstPresetCard).getAllByRole("textbox");
    await user.clear(firstPresetInputs[0]!);
    await user.type(firstPresetInputs[0]!, "09:15");
    await user.clear(firstPresetInputs[1]!);
    await user.type(firstPresetInputs[1]!, "10:45");

    expect((firstPresetInputs[0] as HTMLInputElement).value).toBe("09:15");
    expect((firstPresetInputs[1] as HTMLInputElement).value).toBe("10:45");

    await user.click(within(schedulePanel).getByRole("button", { name: "重設本次預設" }));

    const resetInputs = within(firstPresetCard).getAllByRole("textbox");
    expect((resetInputs[0] as HTMLInputElement).value).toBe("09:00");
    expect((resetInputs[1] as HTMLInputElement).value).toBe("10:30");
  });
});
