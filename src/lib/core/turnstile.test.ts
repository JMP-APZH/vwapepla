import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { verifyTurnstile } = await import("./turnstile");

const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("verifyTurnstile", () => {
  it("skips without a secret outside production, refuses in production", async () => {
    expect(await verifyTurnstile("t", { secret: "", production: false })).toEqual({ ok: true, skipped: true });
    expect(await verifyTurnstile("t", { secret: "", production: true })).toEqual({ ok: false, reason: "not_configured" });
  });

  it("refuses a missing or oversized token without calling Cloudflare", async () => {
    const f = reply({ success: true });
    expect(await verifyTurnstile(null, { secret: "s", fetchImpl: f })).toMatchObject({ reason: "missing_token" });
    expect(await verifyTurnstile("", { secret: "s", fetchImpl: f })).toMatchObject({ reason: "missing_token" });
    expect(await verifyTurnstile("x".repeat(2049), { secret: "s", fetchImpl: f })).toMatchObject({ reason: "missing_token" });
    expect(f).not.toHaveBeenCalled();
  });

  it("accepts a valid token and sends no IP", async () => {
    const f = reply({ success: true, action: "vote-site" });
    expect(await verifyTurnstile("tok", { secret: "s", action: "vote-site", fetchImpl: f })).toEqual({ ok: true });
    const body = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body as URLSearchParams;
    expect([...body.keys()].sort()).toEqual(["response", "secret"]);
  });

  it("refuses a failed check or a token made for another form", async () => {
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: reply({ success: false, "error-codes": ["timeout-or-duplicate"] }) }))
      .toEqual({ ok: false, reason: "failed", codes: ["timeout-or-duplicate"] });
    expect(await verifyTurnstile("tok", { secret: "s", action: "vote-site", fetchImpl: reply({ success: true, action: "vote-etat" }) }))
      .toEqual({ ok: false, reason: "failed", codes: ["action-mismatch"] });
  });

  it("fails closed when Cloudflare is unreachable or answers an error", async () => {
    const down = vi.fn(async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: down })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: reply({}, 500) })).toEqual({ ok: false, reason: "unavailable" });
  });
});
