import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => {
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const verifyMutateAsync = vi.fn();
  const createBookingMutateAsync = vi.fn();

  const site = {
    company: {
      id: 1,
      slug: "yisin",
      name: "鷁欣建設",
      logoUrl: "https://example.com/logo.png",
      contactPhone: "04-0000-0001",
      contactEmail: "service@example.com",
      heroTitle: "鷁欣建設驗屋預約系統",
      heroDescription: "提供住戶預約入口。",
      inspectionFlow: "1. 驗證\n2. 預約",
      handoverFlow: "交屋流程",
      precautions: "注意事項",
      faqItems: [{ question: "Q1", answer: "A1" }],
      contactWindow: "客服窗口",
    },
    project: {
      id: 11,
      companyId: 1,
      slug: "yisin-demo",
      name: "鷁欣示範建案",
      unitFormatHint: "棟別-樓層-戶別",
      houseNumberExample: "A-4-A",
      address: "台中市測試路 1 號",
    },
    link: {
      id: 101,
      companyId: 1,
      projectId: 11,
      type: "initial",
      shareToken: "token-101",
      isEnabled: true,
      startsAt: new Date("2026-05-01T00:00:00.000Z"),
      endsAt: new Date("2026-05-31T00:00:00.000Z"),
      disabledReason: null,
    },
    isExpired: false,
    availableSlots: [
      {
        id: 9001,
        projectId: 11,
        linkId: 101,
        slotDate: new Date("2026-05-22T00:00:00.000Z"),
        startLabel: "09:00",
        endLabel: "10:30",
        capacity: 2,
        isActive: true,
        remaining: 2,
      },
    ],
  };

  const verificationResult = {
    resident: {
      id: 501,
      projectId: 11,
      companyId: 1,
      unitNumber: "A-4-A",
      phoneNumber: "0912345678",
    },
    site,
    existingBookings: [
      {
        id: 7001,
        linkId: 101,
        bookingType: "initial",
        status: "booked",
        gmail: "owner@gmail.com",
        hasInspectionCompany: false,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        slotDate: new Date("2026-05-22T00:00:00.000Z"),
        startLabel: "09:00",
        endLabel: "10:30",
        projectName: "鷁欣示範建案",
        companyName: "鷁欣建設",
      },
    ],
  };

  verifyMutateAsync.mockResolvedValue(verificationResult);
  createBookingMutateAsync.mockResolvedValue({ id: 1 });

  return {
    toastSuccess,
    toastError,
    verifyMutateAsync,
    createBookingMutateAsync,
    site,
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    publicSite: {
      getContext: {
        useQuery: () => ({ data: mocks.site, isLoading: false, error: null }),
      },
      verifyResident: {
        useMutation: (options?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => ({
          isPending: false,
          mutateAsync: async (payload: unknown) => {
            try {
              const result = await mocks.verifyMutateAsync(payload);
              options?.onSuccess?.(result);
              return result;
            } catch (error) {
              options?.onError?.(error as Error);
              throw error;
            }
          },
        }),
      },
      createBooking: {
        useMutation: (options?: { onSuccess?: (result: unknown) => void; onError?: (error: Error) => void }) => ({
          isPending: false,
          mutateAsync: async (payload: unknown) => {
            try {
              const result = await mocks.createBookingMutateAsync(payload);
              options?.onSuccess?.(result);
              return result;
            } catch (error) {
              options?.onError?.(error as Error);
              throw error;
            }
          },
        }),
      },
    },
  },
}));

describe("home booking guard ui", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?link=token-101");
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
    mocks.verifyMutateAsync.mockClear();
    mocks.createBookingMutateAsync.mockClear();
    mocks.verifyMutateAsync.mockResolvedValue({
      resident: {
        id: 501,
        projectId: 11,
        companyId: 1,
        unitNumber: "A-4-A",
        phoneNumber: "0912345678",
      },
      site: mocks.site,
      existingBookings: [
        {
          id: 7001,
          linkId: 101,
          bookingType: "initial",
          status: "booked",
          gmail: "owner@gmail.com",
          hasInspectionCompany: false,
          createdAtMs: Date.now(),
          updatedAtMs: Date.now(),
          slotDate: new Date("2026-05-22T00:00:00.000Z"),
          startLabel: "09:00",
          endLabel: "10:30",
          projectName: "鷁欣示範建案",
          companyName: "鷁欣建設",
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the existing booking time and blocks duplicate booking UI for the same link", async () => {
    const user = userEvent.setup();
    const { default: Home } = await import("../client/src/pages/Home");

    render(<Home />);

    await user.type(screen.getByLabelText("標準戶號"), "A-4-A");
    await user.type(screen.getByLabelText("手機號碼"), "0912345678");
    await user.click(screen.getByRole("button", { name: "進行住戶驗證" }));

    await waitFor(() => expect(screen.getByText("你已完成預約，不得重複預約")).toBeTruthy());
    expect(screen.getByText(/你已預約時間：/)).toBeTruthy();
    expect(screen.getByText(/09:00 - 10:30/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "送出預約" })).toBeNull();
    expect(mocks.createBookingMutateAsync).not.toHaveBeenCalled();
  });
});
