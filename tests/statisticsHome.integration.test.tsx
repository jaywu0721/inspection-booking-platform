/** @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitMutation, confirmMock } = vi.hoisted(() => ({
  submitMutation: vi.fn(),
  confirmMock: vi.fn(() => true),
}));

const statisticsContext = {
  company: { name: "鷁欣建設", logoUrl: "https://example.com/logo.png" },
  project: { name: "松園", unitFormatHint: "棟別-戶別", houseNumberExample: "A1-01" },
  link: { id: 30, statisticsTitle: "第一次區權會出席意願調查", statisticsDescription: "請選擇你的出席意願。" },
  activeOptions: [{ id: 1, name: "出席" }, { id: 2, name: "委託他人出席" }],
  isWritable: true,
};

const verification = {
  resident: { id: 88, unitNumber: "A1-01", phoneNumber: "0912345678" },
  response: null,
};

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    publicSite: {
      getStatisticsContext: { useQuery: () => ({ data: statisticsContext, isLoading: false, error: null }) },
      verifyStatisticsResident: {
        useMutation: (options?: { onSuccess?: (value: typeof verification) => void }) => ({
          isPending: false,
          mutate: () => options?.onSuccess?.(verification),
          mutateAsync: async () => { options?.onSuccess?.(verification); return verification; },
        }),
      },
      submitStatisticsResponse: {
        useMutation: (options?: { onSuccess?: (value: { changed: boolean }) => Promise<void> }) => ({
          isPending: false,
          mutateAsync: async (payload: unknown) => {
            submitMutation(payload);
            await options?.onSuccess?.({ changed: true });
            return { changed: true };
          },
        }),
      },
    },
  },
}));

import StatisticsHome from "../client/src/pages/StatisticsHome";

describe("StatisticsHome", () => {
  beforeEach(() => {
    submitMutation.mockReset();
    confirmMock.mockClear();
    window.confirm = confirmMock;
    window.history.replaceState({}, "", "/?link=statistics-token");
  });

  it("shows only the statistics survey flow and submits one selected option after verification", async () => {
    render(<StatisticsHome />);

    expect(screen.getByText("第一次區權會出席意願調查")).toBeTruthy();
    expect(screen.queryByText("驗屋流程說明")).toBeNull();
    expect(screen.queryByText("交屋流程說明")).toBeNull();

    fireEvent.change(screen.getByLabelText("標準戶號"), { target: { value: "A1-01" } });
    fireEvent.change(screen.getByLabelText("手機號碼"), { target: { value: "0912345678" } });
    fireEvent.click(screen.getByRole("button", { name: "進行住戶驗證" }));

    expect(screen.getByText("驗證戶別")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("出席"));
    fireEvent.click(screen.getByRole("button", { name: "確認送出" }));

    await waitFor(() => expect(submitMutation).toHaveBeenCalledWith({ linkToken: "statistics-token", residentId: 88, optionId: 1 }));
    expect(confirmMock).toHaveBeenCalledTimes(1);
  });
});
