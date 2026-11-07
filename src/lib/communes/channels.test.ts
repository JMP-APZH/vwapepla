import { describe, expect, it } from "vitest";
import type { ChannelObservation } from "./data";
import { channelStatus } from "./channels";

const o = (platform: ChannelObservation["platform"], observed_on: string, account_url: string | null): ChannelObservation => ({
  id: `${platform}-${observed_on}-${account_url}`, platform, observed_on, account_url, account_name: null, official: "yes",
  official_basis: "linked_from_site", official_evidence_url: null, last_post_date: null, posts_last_90_days: null,
  council_meetings_streamed: null, council_stream_evidence_url: null, followers: null, followers_display: null,
  screenshot_sha256: null, searched_on: account_url ? null : observed_on, search_note: account_url ? null : "cherché", observer: "AB",
});

describe("channelStatus", () => {
  const today = new Date("2026-11-05");
  it("keeps only the latest observation day per platform, and says what was not observed", () => {
    const s = channelStatus([o("facebook", "2026-01-10", "https://fb/old"), o("facebook", "2026-11-01", "https://fb/a"),
      o("facebook", "2026-11-01", "https://fb/b"), o("tiktok", "2026-11-01", null)], today);
    expect(s[0]).toMatchObject({ kind: "accounts", observedOn: "2026-11-01", stale: false });
    expect(s[0].kind === "accounts" && s[0].accounts.map((a) => a.account_url)).toEqual(["https://fb/a", "https://fb/b"]);
    expect(s[2]).toMatchObject({ platform: "tiktok", kind: "none_found", note: "cherché" });
    expect(s[1]).toEqual({ platform: "instagram", kind: "not_observed" });
  });
  it("marks observations older than six months", () => {
    expect(channelStatus([o("youtube", "2026-03-01", "https://yt")], today)[3]).toMatchObject({ stale: true });
  });
});
