// supabase/functions/gs-household-invite/index.ts
//
// Household invitations by one-time link (docs/DECISIONS.md ADR-016). Called
// only through core/household/invites.js. Actions:
//
//   create  {household_id, email, display_name}  owner only -> {token, invite_id, expires_at, emailed}
//           (also emails the link to the invitee; a new create for the same
//           email is how "Resend" works)
//   revoke  {invite_id}                           owner only
//   preview {token}                               anyone holding the link
//   accept  {token, password?, display_name?}     anyone holding the link
//
// The token is 32 random bytes (base64url). Only its SHA-256 is stored, so the
// database never holds a usable link. An invite is bound to one email: a new
// account is created for that email (confirmed, with the chosen password), or,
// if the email already has an account, the caller must be signed in as it.
//
// Project: GenieSphere (nxgtefbqizvihwikqnaw). Secrets: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (auto-provided); SMTP_* for email (_shared/email.ts).
// If email can't be sent, emailed=false and the owner sends the link.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inviteEmail, sendEmail, siteUrlFrom } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_OPEN_INVITES = 10;
const MIN_PASSWORD = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}
const fail = (error: string, status = 400) => json({ ok: false, error }, status);

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteStatus(inv: { accepted_at: string | null; revoked_at: string | null; expires_at: string }): string {
  if (inv.revoked_at) return "revoked";
  if (inv.accepted_at) return "accepted";
  return new Date(inv.expires_at).getTime() <= Date.now() ? "expired" : "open";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return fail("POST only", 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // The caller's user, if signed in. Signed out, the header carries the
  // public anon key, which is not a user and resolves to null here.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  let caller: { id: string; email?: string } | null = null;
  if (jwt) {
    const { data } = await admin.auth.getUser(jwt);
    if (data?.user) caller = { id: data.user.id, email: data.user.email };
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Invalid request."); }
  const action = String(body.action || "");

  async function isOwner(householdId: string, userId: string) {
    const { data } = await admin.from("household_members").select("role")
      .eq("household_id", householdId).eq("user_id", userId).maybeSingle();
    return data?.role === "owner";
  }

  // ── create ──
  if (action === "create") {
    if (!caller) return fail("Sign in to invite people.", 401);
    const householdId = String(body.household_id || "");
    const email = clean(body.email, 254).toLowerCase();
    const displayName = clean(body.display_name, 80) || null;
    if (!UUID_RE.test(householdId)) return fail("household_id required.");
    if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
    if (!(await isOwner(householdId, caller.id))) return fail("Only the household owner can invite people.", 403);

    const { data: member } = await admin.from("household_members").select("user_id")
      .eq("household_id", householdId).eq("email", email).maybeSingle();
    if (member) return fail(`${email} is already a member of this household.`, 409);

    const nowIso = new Date().toISOString();
    // A new link for the same email replaces the old one.
    await admin.from("household_invites").update({ revoked_at: nowIso })
      .eq("household_id", householdId).eq("email", email).is("accepted_at", null).is("revoked_at", null);
    const { count } = await admin.from("household_invites").select("id", { count: "exact", head: true })
      .eq("household_id", householdId).is("accepted_at", null).is("revoked_at", null).gt("expires_at", nowIso);
    if ((count || 0) >= MAX_OPEN_INVITES) return fail(`This household already has ${MAX_OPEN_INVITES} open invitations. Revoke one first.`, 429);

    const token = newToken();
    const { data: inv, error } = await admin.from("household_invites").insert({
      household_id: householdId, email, display_name: displayName, token_hash: await sha256(token), created_by: caller.id,
    }).select("id, expires_at").single();
    if (error) { console.error("[gs-household-invite] create:", error.message); return fail("Could not create the invitation. Try again.", 500); }

    const siteUrl = siteUrlFrom(req);
    const [{ data: household }, { data: inviter }] = await Promise.all([
      admin.from("households").select("name").eq("id", householdId).maybeSingle(),
      admin.from("household_members").select("display_name").eq("household_id", householdId).eq("user_id", caller.id).maybeSingle(),
    ]);
    const mail = inviteEmail({
      inviterName: inviter?.display_name || "Your household owner", householdName: household?.name || "your household",
      inviteeName: displayName, email, link: `${siteUrl}/core/auth/invite.html#t=${token}`, expiresAt: inv.expires_at, siteUrl,
    });
    const sent = await sendEmail(email, mail);
    console.log("[gs-household-invite] created", JSON.stringify({ invite: inv.id, emailed: sent.sent, reason: sent.reason || null }));
    return json({ ok: true, token, invite_id: inv.id, expires_at: inv.expires_at, emailed: sent.sent });
  }

  // ── revoke ──
  if (action === "revoke") {
    if (!caller) return fail("Sign in first.", 401);
    const inviteId = String(body.invite_id || "");
    if (!UUID_RE.test(inviteId)) return fail("invite_id required.");
    const { data: inv } = await admin.from("household_invites").select("id, household_id").eq("id", inviteId).maybeSingle();
    if (!inv || !(await isOwner(inv.household_id, caller.id))) return fail("Invitation not found.", 404);
    await admin.from("household_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId).is("revoked_at", null);
    return json({ ok: true });
  }

  // ── preview / accept: identified by the token ──
  if (action !== "preview" && action !== "accept") return fail("Unknown action.");
  const token = clean(body.token, 100);
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return fail("This invitation link is not valid.", 404);
  const { data: invite } = await admin.from("household_invites")
    .select("id, household_id, email, display_name, created_by, expires_at, accepted_at, revoked_at")
    .eq("token_hash", await sha256(token)).maybeSingle();
  if (!invite) return fail("This invitation link is not valid.", 404);
  const { data: existing } = await admin.rpc("gs_user_id_by_email", { p_email: invite.email });

  if (action === "preview") {
    const [{ data: household }, { data: inviter }] = await Promise.all([
      admin.from("households").select("name").eq("id", invite.household_id).maybeSingle(),
      admin.from("household_members").select("display_name").eq("household_id", invite.household_id).eq("user_id", invite.created_by).maybeSingle(),
    ]);
    return json({
      ok: true, status: inviteStatus(invite), household_name: household?.name || "a household",
      inviter_name: inviter?.display_name || "The household owner",
      email: invite.email, display_name: invite.display_name, has_account: !!existing,
    });
  }

  // accept
  if (inviteStatus(invite) !== "open") return fail("This invitation can no longer be used.", 410);
  const displayName = clean(body.display_name, 80) || invite.display_name || null;
  let userId: string;
  if (existing) {
    if (!caller || caller.id !== existing) return fail(`Sign in as ${invite.email} to join.`, 401);
    userId = existing as string;
  } else {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < MIN_PASSWORD) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`);
    if (password.length > 72) return fail("Use a password of at most 72 characters.");
  }

  // Claim the invite first, atomically, so a link can't be used twice.
  const { data: claimed } = await admin.from("household_invites").update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString())
    .select("id");
  if (!claimed?.length) return fail("This invitation can no longer be used.", 410);
  const release = () => admin.from("household_invites").update({ accepted_at: null, accepted_by: null }).eq("id", invite.id);

  if (!existing) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: invite.email, password: body.password as string, email_confirm: true,
      user_metadata: displayName ? { full_name: displayName } : {},
    });
    if (error || !created?.user) {
      console.error("[gs-household-invite] createUser:", error?.message);
      await release();
      return fail(error?.message?.includes("weak") ? "Choose a stronger password." : "Could not create your account. Try again.", 400);
    }
    userId = created.user.id;
  }

  const { error: memberErr } = await admin.from("household_members").upsert({
    household_id: invite.household_id, user_id: userId!, role: "member", email: invite.email, display_name: displayName,
  }, { onConflict: "household_id,user_id", ignoreDuplicates: true });
  if (memberErr) {
    console.error("[gs-household-invite] membership:", memberErr.message);
    await release();
    return fail("Could not add you to the household. Try again.", 500);
  }
  await admin.from("household_invites").update({ accepted_by: userId! }).eq("id", invite.id);
  // Open the household they just joined next time they load the app.
  await admin.from("user_household_context").upsert({ user_id: userId!, household_id: invite.household_id, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  console.log("[gs-household-invite] accepted", JSON.stringify({ invite: invite.id, new_account: !existing }));
  return json({ ok: true, household_id: invite.household_id });
});
