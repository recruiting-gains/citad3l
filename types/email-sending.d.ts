/** Cloudflare Email Sending Workers binding, attached as env.EMAIL. */
interface SendEmail {
  send(message: {
    to: string | { email: string; name: string } | Array<string | { email: string; name: string }>;
    from: string | { email: string; name: string };
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string | { email: string; name: string };
  }): Promise<{ messageId: string }>;
}

declare global {
  interface CloudflareEnv {
    EMAIL?: SendEmail;
  }
}

export {};
