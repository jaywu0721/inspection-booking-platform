/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { rescheduleBookingMutateAsync, toastSuccess, toastError } = vi.hoisted(() => ({
  rescheduleBookingMutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

const siteContext = {
  company: {
    name: "鷁欣建設",
    logoUrl: "https://example.com/logo.png",
    heroTitle: "鷁欣建設驗屋預約",
    heroDescription: "請依照通知完成住戶驗證與預約。",
    inspectionFlow: "驗屋流程說明",
    handoverFlow: "交屋流程說明",
    precautions: "注意事項",
    faqItems: [{ question: "Q1", answer: "A1" }],
    contactWindow: "客服窗口",
    contactPhone: "02-1234-5678",
    contactEmail: "service@example.com",
  },
  project: {
    id: 20,
    name: "A1",
    houseNumberExample: "A1-01",
    unitFormatHint: "棟別-戶別",
  },
  link: {
    id: 30,
    type: "initial" as const,
  },
  availableSlots: [
    {
      id: 101,
      slotDate: new Date("2026-05-20T00:00:00.000Z"),
      startLabel: "09:00",
      endLabel: "10:30",
      remaining: 2,
    },
    {
      id: 102,
      slotDate: new Date("2026-05-20T00:00:00.000Z"),
      startLabel: "10:30",
      endLabel: "12:00",
      remaining: 1,
    },
  ],
  isExpired: false,
};

function createVerificationResult() {
  return {
    resident: {
      id: 88,
      unitNumber: "A1-01",
      phoneNumber: "0912345678",
    },
    existingBookings: [
      {
        id: 501,
        linkId: 30,
        slotId: 101,
        bookingType: "initial" as const,
        status: "booked" as const,
        gmail: "owner@example.com",
        hasInspectionCompany: false,
        createdAtMs: 1,
        updatedAtMs: 1,
        slotDate: new Date("2026-05-20T00:00:00.000Z"),
        startLabel: "09:00",
        endLabel: "10:30",
        projectName: "A1",
        companyName: "鷁欣建設",
      },
    ],
    site: {
      availableSlots: siteContext.availableSlots,
    },
  };
}

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    publicSite: {
      getContext: {
        useQuery: () => ({ data: siteContext, isLoading: false, error: null }),
      },
      verifyResident: {
        useMutation: (options?: { onSuccess?: (result: ReturnType<typeof createVerificationResult>) => void }) => ({
          isPending: false,
          mutateAsync: async () => {
            const result = createVerificationResult();
            options?.onSuccess?.(result);
            return result;
          },
        }),
      },
      createBooking: {
        useMutation: () => ({
          isPending: false,
          mutateAsync: async () => ({ success: true }),
        }),
      },
      rescheduleBooking: {
        useMutation: () => ({
          isPending: false,
          mutateAsync: async (payload: unknown) => {
            rescheduleBookingMutateAsync(payload);
            return { success: true };
          },
        }),
      },
    },
  },
}));

import Home from "../client/src/pages/Home";

describe("Home customer reschedule flow", () => {
  beforeEach(() => {
    rescheduleBookingMutateAsync.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    window.history.replaceState({}, "", "/?link=demo-link-token");
  });

  async function verifyResident() {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("標準戶號"), { target: { value: "A1-01" } });
    fireEvent.change(screen.getByLabelText("手機號碼"), { target: { value: "0912345678" } });
    fireEvent.click(screen.getAllByRole("button", { name: "進行住戶驗證" })[0]);

    await waitFor(() => {
      expect(screen.getByText("你已完成預約")).toBeTruthy();
    });
  }

  it("shows a modify-date entry after verification and blocks resubmitting the same slot", async () => {
    await verifyResident();

    fireEvent.click(screen.getByRole("button", { name: "修改日期" }));
    fireEvent.click(screen.getAllByText("點選後顯示該日期仍可改期的時段")[0].closest("button") as HTMLElement);
    fireEvent.click(screen.getByText("目前時段").closest("button") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "確認修改日期" }));

    expect(toastError).toHaveBeenCalledWith("您目前已預約此時段");
    expect(rescheduleBookingMutateAsync).not.toHaveBeenCalled();
  });

  it("submits the expected payload when the customer picks another slot", async () => {
    await verifyResident();

    fireEvent.click(screen.getByRole("button", { name: "修改日期" }));
    fireEvent.click(screen.getAllByText("點選後顯示該日期仍可改期的時段")[0].closest("button") as HTMLElement);
    fireEvent.click(screen.getByText("剩餘 1 名").closest("button") as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "確認修改日期" }));

    await waitFor(() => {
      expect(rescheduleBookingMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 501,
          residentId: 88,
          currentSlotId: 101,
          newSlotId: 102,
        })
      );
    });
  });
});
