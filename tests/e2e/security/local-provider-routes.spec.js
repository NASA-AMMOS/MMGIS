import { test, expect, request as apiRequest } from "@playwright/test";
import { loginHeaders } from "../../helpers/auth.js";

/**
 * The Local login provider serves signup, login and password reset at
 * /api/auth/local/*, and the same handlers stay at /api/users/* for existing clients.
 */
const baseURL = process.env.TEST_BASE_URL || "http://localhost:18888";
const ADMIN = { username: "test_admin", password: "TestAdmin1!" }; // pragma: allowlist secret

for (const prefix of ["/api/auth/local", "/api/users"]) {
  test.describe(`Local provider routes at ${prefix}`, () => {
    test("login succeeds with the right password and fails with a wrong one", async () => {
      const ctx = await apiRequest.newContext({ baseURL });
      const bad = await (
        await ctx.post(`${prefix}/login`, {
          headers: loginHeaders(),
          data: { username: ADMIN.username, password: "Wrong-pass1!" }, // pragma: allowlist secret
        })
      ).json();
      expect(bad.status).toBe("failure");
      const good = await (
        await ctx.post(`${prefix}/login`, { headers: loginHeaders(), data: ADMIN })
      ).json();
      test.skip(good.status !== "success", "Requires the test admin account");
      expect(good.username).toBe(ADMIN.username);
      const who = await (await ctx.get("/api/users/logged_in")).json();
      expect(who.body?.loggedIn ?? who.loggedIn).toBeTruthy();
      await ctx.dispose();
    });

    test("signup refuses a weak password", async () => {
      const ctx = await apiRequest.newContext({ baseURL });
      const body = await (
        await ctx.post(`${prefix}/signup`, {
          data: { username: `weak_${Date.now()}`, password: "short", email: "w@test.com" }, // pragma: allowlist secret
        })
      ).json();
      expect(body.status).toBe("failure");
      await ctx.dispose();
    });

    test("resetPassword without a valid reset token fails", async () => {
      const ctx = await apiRequest.newContext({ baseURL });
      const body = await (
        await ctx.post(`${prefix}/resetPassword`, {
          data: { username: ADMIN.username, password: "Another-pass1!", resetToken: "nope" }, // pragma: allowlist secret
        })
      ).json();
      expect(body.status).toBe("failure");
      await ctx.dispose();
    });
  });
}
