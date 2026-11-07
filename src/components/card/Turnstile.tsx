"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget for the visitor-vote forms (opinion blocks only). Put it inside the <form>: it adds
// the hidden field "cf-turnstile-response" (Cloudflare's default name), checked on the server by
// verifyTurnstile() in src/lib/core/turnstile.ts. The script loads only when a vote form is on screen.
// Without NEXT_PUBLIC_TURNSTILE_SITE_KEY nothing is rendered (local dev; the server then skips the check
// outside production and refuses votes in production).

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => { scriptPromise = null; reject(new Error("turnstile script failed")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * @param action    short name of the form (e.g. "vote-site"), also checked on the server
 * @param resetKey  change it after each submission (e.g. the action state): a token is single-use
 */
export function Turnstile({ action, resetKey }: { action: string; resetKey?: unknown }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !box.current) return;
    let cancelled = false;
    loadScript()
      .then((ts) => {
        if (cancelled || !box.current) return;
        widget.current = ts.render(box.current, {
          sitekey: siteKey, action, language: "fr", theme: "light", size: "flexible", appearance: "interaction-only",
        });
      })
      .catch(() => { /* blocked or offline: the server refuses the vote and the form shows the error */ });
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (resetKey !== undefined && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <div ref={box} className="min-h-0" />;
}
