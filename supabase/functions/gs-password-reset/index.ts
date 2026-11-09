// supabase/functions/gs-password-reset/index.ts
//
// "Forgot password?" for GenieSphere (core/auth/forgot.html via
// core/auth/account.js). POST { email }.
//
// Always answers { ok: true } whether or not the email has an account, so the
// page can't be used to find out who has one. For a real account it creates a
// one-time recovery link (Supabase Auth, expires per the project's email OTP
// setting, 1 hour) that opens /core/auth/reset.html signed in, and emails it
// from invites@ with the GenieSphere template (_shared/email.ts). At most one
// email per account every 5 minutes (time kept in app_metadata), so the form
// can't be used to flood someone's inbox.
//
// Project: GenieSphere (nxgtefbqizvihwikqnaw). Secrets: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (auto-provided); SMTP_* (see _shared/email.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resetEmail, sendEmail, siteUrlFrom } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MIN_INTERVAL_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  let body: { email?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const done = () => json({ ok: true });

  try {
    const { data: userId } = await admin.rpc("gs_user_id_by_email", { p_email: email });
    if (!userId) return done();

    const { data: found } = await admin.auth.admin.getUserById(userId as string);
    const meta = (found?.user?.app_metadata || {}) as Record<string, unknown>;
    const last = Date.parse(String(meta.reset_sent_at || ""));
    if (Number.isFinite(last) && Date.now() - last < MIN_INTERVAL_MS) {
      console.log("[gs-password-reset] throttled");
      return done();
    }

    const siteUrl = siteUrlFrom(req);
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "recovery", email, options: { redirectTo: `${siteUrl}/core/auth/reset.html` },
    });
    if (error || !link?.properties?.action_link) {
      console.error("[gs-password-reset] generateLink:", error?.message);
      return done();
    }
    const sent = await sendEmail(email, resetEmail({ link: link.properties.action_link, email, siteUrl }));
    if (sent.sent) {
      await admin.auth.admin.updateUserById(userId as string, { app_metadata: { ...meta, reset_sent_at: new Date().toISOString() } });
    }
    console.log("[gs-password-reset] requested", JSON.stringify({ emailed: sent.sent, reason: sent.reason || null }));
  } catch (e) {
    console.error("[gs-password-reset] failed:", String(e).slice(0, 300));
  }
  return done();
});
