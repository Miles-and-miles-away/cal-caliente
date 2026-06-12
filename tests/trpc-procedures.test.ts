import { describe, expect, it } from "vitest";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../server/_core/trpc";
import type { TrpcContext } from "../server/_core/context";

// Exercise the auth middlewares directly through a minimal router, so the
// UNAUTHORIZED / FORBIDDEN gates are pinned independently of any app routes.
const testRouter = router({
  open: publicProcedure.query(() => "open"),
  authed: protectedProcedure.query(({ ctx }) => ctx.user.id),
  admin: adminProcedure.query(() => "admin-only"),
});

function ctxWith(user: Partial<TrpcContext["user"]> | null): TrpcContext {
  return {
    user: user as TrpcContext["user"],
    req: { headers: {}, protocol: "https" } as any,
    res: {} as any,
  };
}

const regularUser = { id: 7, openId: "u-7", role: "user" } as any;
const adminUser = { id: 1, openId: "u-1", role: "admin" } as any;

describe("procedure auth middlewares", () => {
  it("publicProcedure works without a user", async () => {
    const caller = testRouter.createCaller(ctxWith(null));
    await expect(caller.open()).resolves.toBe("open");
  });

  it("protectedProcedure rejects a null user with UNAUTHORIZED", async () => {
    const caller = testRouter.createCaller(ctxWith(null));
    await expect(caller.authed()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("protectedProcedure passes the user through to the resolver", async () => {
    const caller = testRouter.createCaller(ctxWith(regularUser));
    await expect(caller.authed()).resolves.toBe(7);
  });

  it("adminProcedure rejects a signed-out caller with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(ctxWith(null));
    await expect(caller.admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adminProcedure rejects a regular user with FORBIDDEN", async () => {
    const caller = testRouter.createCaller(ctxWith(regularUser));
    await expect(caller.admin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adminProcedure admits an admin", async () => {
    const caller = testRouter.createCaller(ctxWith(adminUser));
    await expect(caller.admin()).resolves.toBe("admin-only");
  });
});
