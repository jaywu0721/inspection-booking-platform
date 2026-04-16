import { describe, expect, it } from "vitest";
import type { Response } from "express";
import {
  ADMIN_COOKIE_NAME,
  clearAdminSessionCookie,
  getAdminSessionFromHeader,
  hashPassword,
  setAdminSessionCookie,
  verifyPassword,
} from "./adminAuth";

function createResponseRecorder() {
  const headers = new Map<string, string>();
  const response = {
    setHeader: (name: string, value: string) => {
      headers.set(name, value);
    },
  } as unknown as Response;

  return { response, headers };
}

describe("adminAuth helpers", () => {
  it("hashes and verifies password correctly", async () => {
    const password = "ChangeMe123!";
    const hashed = await hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(await verifyPassword(password, hashed)).toBe(true);
    expect(await verifyPassword("wrong-password", hashed)).toBe(false);
  });

  it("creates a valid admin session cookie and parses it back", () => {
    const { response, headers } = createResponseRecorder();
    setAdminSessionCookie(response, "admin");

    const cookieHeader = headers.get("Set-Cookie");
    expect(cookieHeader).toContain(ADMIN_COOKIE_NAME);

    const session = getAdminSessionFromHeader(cookieHeader);
    expect(session).toEqual({ username: "admin" });
  });

  it("clears the admin session cookie", () => {
    const { response, headers } = createResponseRecorder();
    clearAdminSessionCookie(response);

    const cookieHeader = headers.get("Set-Cookie");
    expect(cookieHeader).toContain(`${ADMIN_COOKIE_NAME}=`);
    expect(cookieHeader).toContain("Max-Age=0");
  });
});
