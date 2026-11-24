import "server-only";
import { isProd } from "@/lib/config";

export interface MailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailSender {
  name: "cloudflare" | "resend" | "console";
  send(message: MailMessage): Promise<void>;
}

export class MailNotConfigured extends Error {
  constructor() {
    super("No email sender is configured");
    this.name = "MailNotConfigured";
  }
}

export class MailSendFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailSendFailed";
  }
}

/** Minimal shape of the Workers `send_email` binding. */
export interface SendEmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name: string };
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{ messageId: string }>;
}

export function emailFrom(): string | null {
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  return from || null;
}

/** Parse "Name <addr@host>" or a bare address into the Cloudflare Email Address shape. */
export function parseFrom(from: string): { email: string; name: string } | string {
  const m = /^\s*(.+?)\s*<([^>]+)>\s*$/.exec(from);
  if (!m) return from;
  return { name: m[1]!.trim(), email: m[2]!.trim() };
}

export function consoleSender(): MailSender {
  return {
    name: "console",
    async send(message) {
      console.info(`[citad3l:mail] Dev console sender → ${message.to}\n${message.subject}\n\n${message.text}`);
    },
  };
}

export function resendSender(apiKey: string, from: string): MailSender {
  return {
    name: "resend",
    async send(message) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!res.ok) {
        await res.text().catch(() => "");
        throw new MailSendFailed(`Resend rejected the message (${res.status})`);
      }
    },
  };
}

export function cloudflareSender(binding: SendEmailBinding, from: string): MailSender {
  return {
    name: "cloudflare",
    async send(message) {
      try {
        await binding.send({
          to: message.to,
          from: parseFrom(from),
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
        throw new MailSendFailed(code ? `Cloudflare Email Sending failed (${code})` : "Cloudflare Email Sending failed");
      }
    },
  };
}

/**
 * Prefer the Workers send_email binding, then Resend, then a dev console sender.
 * Production refuses to start a send if nothing real is configured.
 */
export function getMailSender(binding?: SendEmailBinding | null): MailSender {
  const from = emailFrom();
  if (binding && from) return cloudflareSender(binding, from);
  const key = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;
  if (key && from) return resendSender(key, from);
  if (!isProd()) return consoleSender();
  throw new MailNotConfigured();
}

export async function getEmailBinding(): Promise<SendEmailBinding | undefined> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    return ctx.env.EMAIL;
  } catch {
    return undefined;
  }
}

export async function resolveMailSender(): Promise<MailSender> {
  return getMailSender(await getEmailBinding());
}
