import type { ChannelObservation } from "./data";

export const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "whatsapp_channel"] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", whatsapp_channel: "Chaîne WhatsApp",
};
export const BASIS_LABEL: Record<string, string> = {
  linked_from_site: "lien sur le site de la mairie",
  platform_verified: "compte certifié par la plateforme",
  town_hall_confirmed: "confirmé par la mairie",
};
/** An observation older than this is marked « relevé ancien » (B1-CHANNELS.md §4). */
export const STALE_DAYS = 183;

export type PlatformStatus =
  | { platform: Platform; kind: "accounts"; observedOn: string; accounts: ChannelObservation[]; stale: boolean }
  | { platform: Platform; kind: "none_found"; observedOn: string; note: string | null; stale: boolean }
  | { platform: Platform; kind: "not_observed" };

/** Per platform, the latest observation date and what was seen that day. No verdict, no comparison. */
export function channelStatus(obs: ChannelObservation[], today: Date): PlatformStatus[] {
  return PLATFORMS.map((platform) => {
    const mine = obs.filter((o) => o.platform === platform);
    if (!mine.length) return { platform, kind: "not_observed" as const };
    const observedOn = mine.map((o) => o.observed_on).sort().at(-1)!;
    const latest = mine.filter((o) => o.observed_on === observedOn);
    const stale = (today.getTime() - new Date(observedOn).getTime()) / 86_400_000 > STALE_DAYS;
    const accounts = latest.filter((o) => o.account_url);
    return accounts.length
      ? { platform, kind: "accounts" as const, observedOn, accounts, stale }
      : { platform, kind: "none_found" as const, observedOn, note: latest[0].search_note, stale };
  });
}
