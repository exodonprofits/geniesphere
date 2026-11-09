// supabase/functions/_shared/email.ts
//
// GenieSphere transactional email: templates and SMTP sending. Used by
// gs-household-invite (invitations, password resets).
//
// Sending (Edge Function secrets), first one configured wins:
//   1. Resend API (same provider as Rental Genie): RESEND_API_KEY, and
//      FROM_EMAIL e.g. "GenieSphere <invites@geniesphere.com>" on a domain
//      verified in Resend.
//   2. Bluehost SMTP: SMTP_HOST, SMTP_PORT (465, implicit TLS; Edge Functions
//      can't use 25 or 587), SMTP_USER, SMTP_PASS; SMTP_FROM_NAME optional.
// Replies go to SMTP_REPLY_TO / REPLY_TO (default info@geniesphere.com). With
// neither configured, sendEmail returns { sent: false } and callers fall back
// to showing the link.
//
// Templates are table-based with inline styles so Gmail, Apple Mail and
// Outlook render them the same. Every value is HTML-escaped.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface Email { subject: string; html: string; text: string }

const BRAND = {
  ink: "#0B1435", text: "#263A70", muted: "#5B6B93", accent: "#315BFF",
  border: "#E3E8F7", soft: "#F6F8FF",
};

export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" });
}

// Shared frame: logo, white card, footer. `body` is trusted HTML built here.
function frame(opts: { preheader: string; siteUrl: string; body: string; footer: string }): string {
  const logo = `${opts.siteUrl}/shared/assets/logo/geniesphere_logo_name.png`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>GenieSphere</title></head>
<body style="margin:0;padding:0;background:${BRAND.soft};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.soft};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td style="padding:0 8px 22px;">
      <img src="${esc(logo)}" width="168" height="auto" alt="GenieSphere" style="display:block;border:0;width:168px;height:auto;font:700 22px Arial,sans-serif;color:${BRAND.accent};">
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${BRAND.border};border-radius:20px;padding:36px 36px 32px;font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
      ${opts.body}
    </td></tr>
    <tr><td style="padding:22px 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">
      ${opts.footer}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 24px;"><tr>
<td style="border-radius:999px;background:${BRAND.accent};background-image:linear-gradient(120deg,#1234C7,#4934F4);">
<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font:700 16px Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

function fallbackLink(href: string): string {
  return `<p style="margin:0;font-size:13px;line-height:20px;color:${BRAND.muted};">If the button doesn’t work, copy this link into your browser:<br>
<a href="${esc(href)}" style="color:${BRAND.accent};word-break:break-all;">${esc(href)}</a></p>`;
}

export function inviteEmail(o: {
  inviterName: string; householdName: string; inviteeName?: string | null; email: string;
  link: string; expiresAt: string; siteUrl: string;
}): Email {
  const greeting = o.inviteeName ? `Hi ${o.inviteeName},` : "Hello,";
  const expires = longDate(o.expiresAt);
  const subject = `${o.inviterName} invited you to ${o.householdName} on GenieSphere`;
  const body = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.accent};">Private invitation</p>
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;font-weight:normal;color:${BRAND.ink};">Join ${esc(o.householdName)}</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:25px;">${esc(greeting)}</p>
<p style="margin:0;font-size:16px;line-height:25px;">${esc(o.inviterName)} has invited you to <strong style="color:${BRAND.ink};">${esc(o.householdName)}</strong> on GenieSphere, a private space for the household’s shared grocery list, weekly meal plans and tasks.</p>
${button(`Join ${o.householdName}`, o.link)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:${BRAND.soft};border-radius:14px;">
<tr><td style="padding:14px 18px;font-size:14px;line-height:21px;color:${BRAND.text};">
This invitation is for <strong style="color:${BRAND.ink};">${esc(o.email)}</strong>, which will be your sign-in. The link works once and expires on ${esc(expires)}.
</td></tr></table>
${fallbackLink(o.link)}`;
  const footer = `You received this because ${esc(o.inviterName)} invited ${esc(o.email)}. Not expecting it? You can ignore this email; nothing happens unless you join.<br>Questions? Reply to this email.<br><br>GenieSphere · geniesphere.com`;
  const text = [
    greeting, "",
    `${o.inviterName} has invited you to ${o.householdName} on GenieSphere, a private space for the household's shared grocery list, weekly meal plans and tasks.`, "",
    `Join ${o.householdName}: ${o.link}`, "",
    `This invitation is for ${o.email}, which will be your sign-in. The link works once and expires on ${expires}.`, "",
    "Not expecting it? Ignore this email; nothing happens unless you join.",
  ].join("\n");
  return { subject, text, html: frame({ preheader: `Join to share the grocery list, meal plans and tasks with ${o.inviterName}.`, siteUrl: o.siteUrl, body, footer }) };
}

export function resetEmail(o: { link: string; email: string; siteUrl: string }): Email {
  const subject = "Reset your GenieSphere password";
  const body = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${BRAND.accent};">Account</p>
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:36px;font-weight:normal;color:${BRAND.ink};">Reset your password</h1>
<p style="margin:0;font-size:16px;line-height:25px;">Someone asked to reset the password for <strong style="color:${BRAND.ink};">${esc(o.email)}</strong>. If it was you, choose a new password below.</p>
${button("Choose a new password", o.link)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:${BRAND.soft};border-radius:14px;">
<tr><td style="padding:14px 18px;font-size:14px;line-height:21px;color:${BRAND.text};">
The link works once and expires in 1 hour. If you didn’t ask for this, ignore this email: your password stays the same.
</td></tr></table>
${fallbackLink(o.link)}`;
  const footer = `Sent to ${esc(o.email)} because a password reset was requested on geniesphere.com.<br>Questions? Reply to this email.<br><br>GenieSphere · geniesphere.com`;
  const text = [
    `Someone asked to reset the password for ${o.email}. If it was you, choose a new password:`, "", o.link, "",
    "The link works once and expires in 1 hour. If you didn't ask for this, ignore this email: your password stays the same.",
  ].join("\n");
  return { subject, text, html: frame({ preheader: "Choose a new password. The link expires in 1 hour.", siteUrl: o.siteUrl, body, footer }) };
}

// Sends one email. Never throws: returns { sent: false, reason } so callers
// can fall back (e.g. show the invitation link to copy).
export async function sendEmail(to: string, mail: Email): Promise<{ sent: boolean; reason?: string; via?: string }> {
  const replyTo = Deno.env.get("REPLY_TO") || Deno.env.get("SMTP_REPLY_TO") || "info@geniesphere.com";
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const from = Deno.env.get("FROM_EMAIL") || "GenieSphere <invites@geniesphere.com>";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject: mail.subject, html: mail.html, text: mail.text }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { sent: true, via: "resend" };
      console.error("[email] resend failed:", res.status, (await res.text()).slice(0, 300));
      return { sent: false, reason: "send_failed", via: "resend" };
    } catch (e) {
      console.error("[email] resend failed:", String(e).slice(0, 300));
      return { sent: false, reason: "send_failed", via: "resend" };
    }
  }

  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  if (!host || !user || !pass) return { sent: false, reason: "not_configured" };
  const fromName = Deno.env.get("SMTP_FROM_NAME") || "GenieSphere";
  const client = new SMTPClient({ connection: { hostname: host, port, tls: true, auth: { username: user, password: pass } } });
  try {
    await client.send({ from: `${fromName} <${user}>`, to, replyTo, subject: mail.subject, content: mail.text, html: mail.html });
    return { sent: true, via: "smtp" };
  } catch (e) {
    console.error("[email] smtp failed:", String(e).slice(0, 300));
    return { sent: false, reason: "send_failed", via: "smtp" };
  } finally {
    try { await client.close(); } catch { /* already closed */ }
  }
}

// The site's address for links in emails: the caller's page origin if it is
// one of ours, else the canonical address. Switches to https by itself once
// the site serves it.
const SITE_ORIGINS = ["https://geniesphere.com", "https://www.geniesphere.com", "http://geniesphere.com", "http://www.geniesphere.com"];
export function siteUrlFrom(req: Request): string {
  const origin = req.headers.get("Origin") || "";
  return SITE_ORIGINS.includes(origin) ? origin : "http://geniesphere.com";
}
