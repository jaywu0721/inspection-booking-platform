/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { confirmMock, deleteLinkMutate, emptyOptions, emptyResidents } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  deleteLinkMutate: vi.fn(),
  emptyOptions: [],
  emptyResidents: [],
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        getStatisticOptions: { invalidate: vi.fn() },
        getStatisticResults: { invalidate: vi.fn() },
        searchStatisticResidents: { invalidate: vi.fn() },
      },
    }),
    admin: {
      getStatisticOptions: { useQuery: () => ({ data: emptyOptions }) },
      getStatisticResults: { useQuery: () => ({ data: undefined, isFetching: false }) },
      searchStatisticResidents: { useQuery: () => ({ data: emptyResidents }) },
      saveStatisticsLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createStatisticOption: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateStatisticOption: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteStatisticOption: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      reorderStatisticOptions: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      submitStatisticResponse: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      toggleLinkEnabled: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteLink: { useMutation: () => ({ mutate: deleteLinkMutate, isPending: false }) },
    },
  },
}));

import { AdminStatisticsPanel } from "../client/src/components/AdminStatisticsPanel";

const links = [{
  id: 30,
  companyId: 10,
  projectId: 20,
  mode: "statistics" as const,
  shareToken: "statistics-token",
  statisticsTitle: "出席意願調查",
  statisticsDescription: null,
  isEnabled: true,
  startsAt: new Date("2026-06-01T00:00:00.000Z"),
  endsAt: new Date("2026-06-30T00:00:00.000Z"),
}];

describe("AdminStatisticsPanel permanent delete", () => {
  beforeEach(() => {
    cleanup();
    deleteLinkMutate.mockReset();
    confirmMock.mockReset();
    window.confirm = confirmMock;
  });

  function renderPanel() {
    render(
      <AdminStatisticsPanel
        companies={[{ id: 10, name: "鷁欣建設" }]}
        projects={[{ id: 20, companyId: 10, name: "松園" }]}
        links={links}
        onRefresh={async () => undefined}
      />
    );
  }

  it("does not delete when the second confirmation is cancelled", () => {
    confirmMock.mockReturnValueOnce(true).mockReturnValueOnce(false);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "刪除" }));

    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(confirmMock.mock.calls[0]?.[0]).toContain("所有選項、住戶回覆與回覆歷程");
    expect(confirmMock.mock.calls[1]?.[0]).toContain("無法復原");
    expect(deleteLinkMutate).not.toHaveBeenCalled();
  });

  it("permanently deletes only after both confirmations", () => {
    confirmMock.mockReturnValueOnce(true).mockReturnValueOnce(true);
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "刪除" }));

    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(deleteLinkMutate).toHaveBeenCalledWith({ id: 30 });
  });
});
