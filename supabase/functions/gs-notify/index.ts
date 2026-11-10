// supabase/functions/gs-notify/index.ts
//
// GenieSphere notification emails (ADR-019, migration 0010).
//
// Two callers:
//   * pg_cron every 5 minutes: POST { mode: "cron" } with header x-cron-secret
//     (a random secret kept in Vault, checked by gs_notify_cron_ok). Emails
//     pending "assigned to you" notifications, and on Sunday from 5 PM
//     Chicago time sends each member's weekly summary (once per week).
//   * A signed-in member, from the Notifications page:
//     POST { action: "test_digest", householdId } emails them this week's
//     summary now (at most every 10 minutes). Doubles as an email check.
//
// Emails respect notification_prefs (missing row = on). The weekly summary
// covers tasks overdue or due in the next 7 days that are assigned to the
// member or to nobody; with nothing to report, Sunday sends nothing.
//
// Project: GenieSphere (nxgtefbqizvihwikqnaw). Secrets: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (auto-provided); RESEND_API_KEY, FROM_EMAIL (see
// _shared/email.ts); SITE_URL optional (default https://geniesphere.com).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assignedEmail, digestEmail, sendEmail, siteUrlFrom, type DigestTask } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SOURCES: Record<string, string> = { home: "Home Genie", nutrition: "Nutrition", grocery: "Grocery" };
const DAY = 864e5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

// Today's date, weekday and hour in Chicago.
function chicagoNow(at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hour12: false,
  }).formatToParts(at).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, weekday: parts.weekday as string, hour: Number(parts.hour) % 24 };
}
function addDays(day: string, n: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
}
function dueLabel(dueDay: string, today: string): string {
  const diff = Math.round((Date.parse(dueDay) - Date.parse(today)) / DAY);
  if (diff < -1) return `${-diff} days overdue`;
  if (diff === -1) return "Due yesterday";
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return "Due " + new Date(dueDay + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

type Admin = ReturnType<typeof createClient>;
interface Member { household_id: string; user_id: string; email: string | null; display_name: string | null }

async function memberEmail(admin: Admin, m: Member): Promise<string | null> {
  if (m.email) return m.email;
  const { data } = await admin.auth.admin.getUserById(m.user_id);
  return data?.user?.email || null;
}

async function prefs(admin: Admin, householdId: string, userId: string) {
  const { data } = await admin.from("notification_prefs").select("weekly_digest, assigned_email")
    .eq("household_id", householdId).eq("user_id", userId).maybeSingle();
  return { weekly: data ? data.weekly_digest !== false : true, assigned: data ? data.assigned_email !== false : true };
}

// One member's summary: overdue and due within 7 days, theirs or nobody's.
async function digestFor(admin: Admin, m: Member, members: Member[], today: string) {
  const { data, error } = await admin.from("household_tasks")
    .select("title, due_at, assigned_to, source_module")
    .eq("household_id", m.household_id).is("completed_at", null).not("due_at", "is", null)
    .or(`assigned_to.is.null,assigned_to.eq.${m.user_id}`)
    .order("due_at", { ascending: true }).limit(200);
  if (error) throw new Error(error.message);
  const horizon = addDays(today, 7);
  const overdue: DigestTask[] = [], week: DigestTask[] = [];
  for (const t of data || []) {
    const dueDay = String(t.due_at).slice(0, 10);
    if (dueDay > horizon) continue;
    const who = t.assigned_to === m.user_id ? "You" : t.assigned_to ? (() => { const x = members.find((y) => y.user_id === t.assigned_to); return x ? (x.display_name || (x.email || "").split("@")[0] || null) : null; })() : "Anyone";
    const row = { title: t.title as string, due: dueLabel(dueDay, today), who, source: SOURCES[t.source_module as string] || null };
    (dueDay < today ? overdue : week).push(row);
  }
  return { overdue, week };
}

async function householdName(admin: Admin, id: string): Promise<string> {
  const { data } = await admin.from("households").select("name").eq("id", id).maybeSingle();
  return (data?.name as string) || "Your household";
}

function links(siteUrl: string) {
  return { tasks: `${siteUrl}/core/tasks/index.html`, prefs: `${siteUrl}/core/notifications/index.html#email` };
}

async function sendPending(admin: Admin, siteUrl: string) {
  const counts = { sent: 0, skipped: 0, failed: 0 };
  const dayAgo = new Date(Date.now() - DAY).toISOString();
  // Anything left pending for a day is stale: don't email it any more.
  await admin.from("household_notifications").update({ email_status: "skipped" }).eq("email_status", "pending").lt("created_at", dayAgo);
  const { data: pending } = await admin.from("household_notifications").select("id")
    .eq("email_status", "pending").order("created_at", { ascending: true }).limit(50);
  for (const p of pending || []) {
    const { data: n } = await admin.from("household_notifications").update({ email_status: "sending" })
      .eq("id", p.id).eq("email_status", "pending").select("id, household_id, user_id, kind, title, body, ref").maybeSingle();
    if (!n) continue;
    let status = "skipped";
    try {
      const taskId = String(n.ref || "").startsWith("assign:") ? String(n.ref).slice(7) : null;
      const { data: task } = taskId
        ? await admin.from("household_tasks").select("assigned_to, completed_at").eq("id", taskId).maybeSingle()
        : { data: null };
      const stillTheirs = n.kind === "task_assigned" && task && !task.completed_at && task.assigned_to === n.user_id;
      if (stillTheirs && (await prefs(admin, n.household_id, n.user_id)).assigned) {
        const { data: m } = await admin.from("household_members").select("household_id, user_id, email, display_name")
          .eq("household_id", n.household_id).eq("user_id", n.user_id).maybeSingle();
        const to = m ? await memberEmail(admin, m as Member) : null;
        if (to) {
          const l = links(siteUrl);
          const sent = await sendEmail(to, assignedEmail({
            title: n.title, due: n.body, householdName: await householdName(admin, n.household_id),
            link: l.tasks, prefsLink: l.prefs, email: to, siteUrl,
          }));
          status = sent.sent ? "sent" : "failed";
        }
      }
    } catch (e) {
      console.error("[gs-notify] pending:", String(e).slice(0, 300));
      status = "failed";
    }
    await admin.from("household_notifications").update({ email_status: status }).eq("id", n.id);
    counts[status as keyof typeof counts]++;
  }
  return counts;
}

async function sendDigests(admin: Admin, siteUrl: string, today: string) {
  const counts = { members: 0, emailed: 0, empty: 0, failed: 0 };
  const { data: all } = await admin.from("household_members").select("household_id, user_id, email, display_name").limit(1000);
  const members = (all || []) as Member[];
  for (const m of members) {
    const { data: claimed } = await admin.rpc("gs_notify_claim_digest", { p_household: m.household_id, p_user: m.user_id, p_day: today });
    if (!claimed) continue;
    counts.members++;
    try {
      const housemates = members.filter((x) => x.household_id === m.household_id);
      const d = await digestFor(admin, m, housemates, today);
      if (!d.overdue.length && !d.week.length) { counts.empty++; continue; }
      const want = (await prefs(admin, m.household_id, m.user_id)).weekly;
      const title = `This week: ${d.overdue.length ? d.overdue.length + " overdue, " : ""}${d.week.length} due`;
      const { data: note } = await admin.from("household_notifications").insert({
        household_id: m.household_id, user_id: m.user_id, source_module: "tasks", kind: "digest",
        title, body: [...d.overdue, ...d.week].slice(0, 3).map((t) => t.title).join(" · ").slice(0, 400),
        link: "/core/tasks/index.html", ref: `digest:${today}`, email_status: want ? "sending" : "skipped",
      }).select("id").maybeSingle();
      if (!want) continue;
      const to = await memberEmail(admin, m);
      if (!to) continue;
      const l = links(siteUrl);
      const sent = await sendEmail(to, digestEmail({
        name: m.display_name, householdName: await householdName(admin, m.household_id), overdue: d.overdue, week: d.week,
        link: l.tasks, prefsLink: l.prefs, email: to, siteUrl,
      }));
      if (note) await admin.from("household_notifications").update({ email_status: sent.sent ? "sent" : "failed" }).eq("id", note.id);
      if (sent.sent) counts.emailed++; else counts.failed++;
    } catch (e) {
      console.error("[gs-notify] digest:", String(e).slice(0, 300));
      counts.failed++;
    }
  }
  return counts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);
  let body: { mode?: unknown; action?: unknown; householdId?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid request." }, 400); }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const now = chicagoNow();

  // Scheduled run.
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret) {
    const { data: ok } = await admin.rpc("gs_notify_cron_ok", { p_secret: cronSecret });
    if (!ok) return json({ ok: false, error: "Forbidden" }, 403);
    const siteUrl = Deno.env.get("SITE_URL") || "https://geniesphere.com";
    const pending = await sendPending(admin, siteUrl);
    const digests = now.weekday === "Sun" && now.hour >= 17 ? await sendDigests(admin, siteUrl, now.day) : null;
    if (pending.sent || pending.failed || pending.skipped || digests) {
      console.log("[gs-notify] cron", JSON.stringify({ pending, digests }));
    }
    return json({ ok: true, pending, digests });
  }

  // A member asks for this week's summary now.
  if (body.action !== "test_digest" || typeof body.householdId !== "string") return json({ ok: false, error: "Unknown request." }, 400);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ ok: false, error: "Sign in again." }, 401);
  const { data: me } = await admin.from("household_members").select("household_id, user_id, email, display_name")
    .eq("household_id", body.householdId).eq("user_id", user.id).maybeSingle();
  if (!me) return json({ ok: false, error: "You are not a member of this household." }, 403);
  const { data: claimed } = await admin.rpc("gs_notify_claim_test", { p_household: me.household_id, p_user: user.id });
  if (!claimed) return json({ ok: false, error: "Summary already sent. You can send another in 10 minutes." }, 429);

  const siteUrl = Deno.env.get("SITE_URL") || siteUrlFrom(req);
  const { data: housemates } = await admin.from("household_members").select("household_id, user_id, email, display_name").eq("household_id", me.household_id);
  const d = await digestFor(admin, me as Member, (housemates || []) as Member[], now.day);
  const to = user.email || (await memberEmail(admin, me as Member));
  if (!to) return json({ ok: false, error: "Your account has no email address." }, 400);
  const l = links(siteUrl);
  const sent = await sendEmail(to, digestEmail({
    name: me.display_name, householdName: await householdName(admin, me.household_id), overdue: d.overdue, week: d.week,
    link: l.tasks, prefsLink: l.prefs, email: to, siteUrl,
  }));
  console.log("[gs-notify] test_digest", JSON.stringify({ emailed: sent.sent, via: sent.via || null, reason: sent.reason || null, tasks: d.overdue.length + d.week.length }));
  if (!sent.sent) return json({ ok: false, error: "The email could not be sent. Try again later." }, 502);
  return json({ ok: true, email: to, tasks: d.overdue.length + d.week.length });
});
