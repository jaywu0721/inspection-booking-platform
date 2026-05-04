/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBookingMutateAsync, toastSuccess, toastError } = vi.hoisted(() => ({
  createBookingMutateAsync: vi.fn(),
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
  ],
  isExpired: false,
};

const verificationResult = {
  resident: {
    id: 88,
    unitNumber: "A1-01",
    phoneNumber: "0912345678",
  },
  existingBookings: [],
  site: {
    availableSlots: siteContext.availableSlots,
  },
};

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
        useMutation: (options?: { onSuccess?: (result: typeof verificationResult) => void; onError?: (error: Error) => void }) => ({
          isPending: false,
          mutateAsync: async () => {
            options?.onSuccess?.(verificationResult);
            return verificationResult;
          },
        }),
      },
      createBooking: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => ({
          isPending: false,
          mutateAsync: async (payload: unknown) => {
            createBookingMutateAsync(payload);
            return { success: true };
          },
        }),
      },
    },
  },
}));

import Home from "../client/src/pages/Home";

describe("Home booking email rules", () => {
  beforeEach(() => {
    createBookingMutateAsync.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    window.history.replaceState({}, "", "/?link=demo-link-token");
  });

  async function prepareBookingForm() {
    render(<Home />);

    fireEvent.change(screen.getByLabelText("標準戶號"), { target: { value: "A1-01" } });
    fireEvent.change(screen.getByLabelText("手機號碼"), { target: { value: "0912345678" } });
    fireEvent.click(screen.getAllByRole("button", { name: "進行住戶驗證" })[0]);

    await waitFor(() => {
      expect(screen.getByText("驗證成功")).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText("點選後顯示該日期可預約時段")[0].closest("button") as HTMLElement);
    fireEvent.click(screen.getByText("剩餘 2 名").closest("button") as HTMLElement);
  }

  it("shows the email field as optional and still submits when left blank", async () => {
    await prepareBookingForm();

    expect(screen.getByLabelText("Email（選填）")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "送出預約" }));

    await waitFor(() => {
      expect(createBookingMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          residentId: 88,
          slotId: 101,
          gmail: "",
          hasInspectionCompany: false,
        })
      );
    });
    expect(toastError).not.toHaveBeenCalledWith("請填寫信箱");
  });

  it("accepts a non-gmail email address when submitting a booking", async () => {
    await prepareBookingForm();

    fireEvent.change(screen.getByLabelText("Email（選填）"), { target: { value: "owner@yahoo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "送出預約" }));

    await waitFor(() => {
      expect(createBookingMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          gmail: "owner@yahoo.com",
        })
      );
    });
  });
});
