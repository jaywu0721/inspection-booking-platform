/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../client/src/pages/AdminPage", () => ({
  default: () => <div>mock-admin-entry</div>,
}));

vi.mock("../client/src/pages/Home", () => ({
  default: () => <div>mock-public-booking-entry</div>,
}));

vi.mock("../client/src/components/ui/sonner", () => ({
  Toaster: () => null,
}));

vi.mock("../client/src/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../client/src/contexts/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from "../client/src/App";

describe("App root entry routing", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders the admin entry when the root URL has no booking parameters", () => {
    window.history.replaceState({}, "", "/");

    render(<App />);

    expect(screen.getByText("mock-admin-entry")).toBeTruthy();
    expect(screen.queryByText("mock-public-booking-entry")).toBeNull();
  });

  it("renders the public booking entry when the root URL contains a valid share link token", () => {
    window.history.replaceState({}, "", "/?link=formal-token");

    render(<App />);

    expect(screen.getByText("mock-public-booking-entry")).toBeTruthy();
    expect(screen.queryByText("mock-admin-entry")).toBeNull();
  });
});
