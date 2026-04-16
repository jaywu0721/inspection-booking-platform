import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

describe("admin credentials env validation", () => {
  it("allows adminAuth.login to succeed with configured ADMIN_USERNAME and ADMIN_PASSWORD", async () => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    expect(username).toBeTruthy();
    expect(password).toBeTruthy();

    let cookieHeader = "";
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        setHeader: (name: string, value: string) => {
          if (name === "Set-Cookie") {
            cookieHeader = value;
          }
        },
        clearCookie: () => undefined,
      } as unknown as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.adminAuth.login({
      username: username as string,
      password: password as string,
    });

    expect(result).toEqual({ success: true });
    expect(cookieHeader).toContain("inspection_admin_session=");
  }, 20000);
});
