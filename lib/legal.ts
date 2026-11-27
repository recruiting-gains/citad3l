import { SUPPORT_EMAIL } from "./support";

/**
 * Terms of Service and Privacy Policy copy for /terms and /privacy.
 * DRAFT for the owner (and ideally an attorney) to review before launch. Built from legal/drafts/terms.md and the code's
 * actual behavior (what lib/faq.ts says we store). Original wording; not copied from any other site.
 * Items marked REVIEW in LEGAL_REVIEW are business choices the owner still has to confirm.
 * Provider names are deliberately generic ("third-party AI providers"): never put provider model IDs here.
 */
export type LegalSection = { h: string; p: readonly string[] };
export type LegalDoc = { title: string; effective: string; intro: string; sections: readonly LegalSection[] };

export const LEGAL_OPERATOR = "Cruz Garza, doing business as Citad3L";
export const LEGAL_CONTACT = SUPPORT_EMAIL;
export const LEGAL_EFFECTIVE = "November 27, 2026";

/** Open questions for the owner before these pages go public. Not rendered. */
export const LEGAL_REVIEW = [
  "Operator name: sole proprietor (Cruz Garza dba Citad3L) or an LLC?",
  "Contact inbox: support@citad3l.io has to actually receive mail (Cloudflare Email Routing) before launch.",
  "Refund rule: draft says full refund of the first charge if asked within 7 days; otherwise no partial-period refunds.",
  "Governing law / disputes: draft says Texas law, Harris County courts or small claims; no arbitration clause yet.",
  "Age: 18+ only (adult content is allowed).",
] as const;

export const TERMS: LegalDoc = {
  title: "Terms of Service",
  effective: LEGAL_EFFECTIVE,
  intro: `These Terms are an agreement between you and ${LEGAL_OPERATOR} ("Citad3L", "we", "us"). By creating an account, sending a message as a guest, or buying a plan, you accept these Terms and our Privacy Policy. If you don't accept them, don't use Citad3L.`,
  sections: [
    { h: "1. What Citad3L is", p: [
      "Citad3L is an AI chat app at citad3l.io. It runs AI models with fewer built-in refusals than typical assistants, served through third-party AI providers. We don't train the base models, and we don't review replies before you see them, except for the narrow safety filter in section 5. Image and video generation are turned off.",
    ] },
    { h: "2. Who can use it", p: [
      "You must be at least 18 years old and able to enter a contract where you live. We close accounts we believe belong to minors.",
      "You're responsible for your account and everything done with it. Don't share, sell or transfer your account or access, and don't use someone else's account.",
      "Don't use Citad3L where it's illegal, or if we've banned you before.",
    ] },
    { h: "3. Plans, billing and renewal", p: [
      "Free: guests get 5 messages one time. A free account gets 3 messages every day on Fast and Private, resetting at midnight Central. Swarm uses 4 replies, so it is on Pro and Max. Pro: $20 per month. Max: $50 per month, 2.5× the Pro allowance, plus per-model settings. The current allowances are on the pricing page. A first-month discount, when we offer one, applies only to that first charge; the plan then renews at the listed price.",
      "Paid plans are billed in advance through our payment processor, Stripe, and renew automatically every month until you cancel. Taxes may be added where required.",
      "Allowances reset on a rolling 5-hour window and a weekly cap and don't roll over. Failed or stopped replies don't count against your allowance.",
      "We may change prices for future billing periods. We'll tell you before your next renewal, and you can cancel before the new price applies.",
      "Cancel any time from your account page. You keep access until the end of the period you paid for. There are no cancellation fees.",
      `Refunds: if you ask within 7 days of your first charge, we'll refund that charge in full. Otherwise we don't refund partial periods, unless the law requires it. Accounts closed for breaking these Terms aren't refunded. Email ${LEGAL_CONTACT} before disputing a charge with your bank.`,
    ] },
    { h: "4. Your content", p: [
      "You keep whatever rights you have in what you type or upload (\"Inputs\"). To the extent we have any rights in the replies the models produce, and in any images or clips already in your chats (\"Outputs\"), we assign them to you, subject to the underlying model's license.",
      "You let us and our third-party AI providers process your Inputs and Outputs only as needed to run, secure and support Citad3L and to enforce these Terms. We don't use your chats to train models.",
      "You confirm you have the rights to what you submit and that it doesn't infringe anyone's rights or break the law. Don't put a real person's name, image or likeness into a sexual or deceptive prompt without their consent.",
      "Outputs can be wrong, offensive, or similar to what other people get. You use them at your own risk.",
    ] },
    { h: "5. Acceptable use and safety", p: [
      "Adult text chat between adults is allowed. Two lines are absolute under this acceptable use section: no sexual content involving anyone under 18 (real or fictional), and no help making bombs, explosives or other weapons capable of mass harm. Breaking either ends the conversation and gets the account banned permanently. Image and video generation are turned off. If image generation is offered again, it keeps a safety filter and will not produce explicit nude or sexual images.",
      "Also don't use Citad3L to break the law, harass or threaten real people, defraud anyone, distribute malware, attack systems you don't own, get around our limits or safety filter, resell access, or for anything where a wrong reply could cause death, serious injury or major financial harm.",
      "We screen messages and replies for the two absolute categories. We may block a message, stop a reply, limit or close an account, and report to authorities where the law requires. Apparent child sexual abuse material is preserved and reported to the National Center for Missing & Exploited Children (NCMEC). Screening isn't a promise that we catch everything.",
    ] },
    { h: "6. Third-party AI providers", p: [
      "Replies are generated by Venice.ai. You don't get an account, key or endpoint with them, and you may not try to extract or resell their access through Citad3L.",
      "We make no promise about a provider's uptime, privacy, security or accuracy beyond what that provider itself states. A provider may change or withdraw a model at any time, and we may switch providers.",
      "Don't use Citad3L in a way that would put us in breach of a provider's terms. Our providers are intended third-party beneficiaries of sections 5, 9, 10 and 11, to the extent those sections protect them, and may enforce them directly.",
    ] },
    { h: "7. Changes to the service", p: [
      "We may change, pause or remove models, features or providers at any time. There may be downtime, slow replies, rate limits and daily caps. Don't rely on Citad3L for anything time-critical or safety-critical.",
    ] },
    { h: "8. Ending your account", p: [
      "You can stop using Citad3L and delete your account at any time. We may suspend or close an account that breaks these Terms, when the law requires it, or to protect the service or other people. If we close your account for a breach, don't open a new one.",
    ] },
    { h: "9. No warranties", p: [
      "To the fullest extent the law allows, Citad3L, its owner and its providers (the \"Covered Parties\") provide the service \"as is\" and \"as available\", with no warranties of any kind, including merchantability, fitness for a particular purpose and non-infringement. Outputs aren't professional, legal, medical or financial advice and aren't a source of truth.",
    ] },
    { h: "10. Limits on liability", p: [
      "To the fullest extent the law allows, the Covered Parties aren't liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or goodwill. Their total liability for all claims is limited to the greater of what you paid us in the 6 months before the claim or $50. Some places don't allow these limits, so they apply only as far as your local law permits.",
    ] },
    { h: "11. Indemnity", p: [
      "To the fullest extent the law allows, you'll defend and compensate the Covered Parties for third-party claims arising from your Inputs, your use of Outputs, or your breaking these Terms or the law.",
    ] },
    { h: "12. Disputes", p: [
      "These Terms are governed by the laws of the State of Texas, without regard to conflict-of-law rules. Disputes go to the state or federal courts in Harris County, Texas, or to small-claims court where you qualify. Please email us first; most problems can be fixed quickly.",
    ] },
    { h: "13. Changes to these Terms", p: [
      "We may update these Terms. We'll post the new version with a new effective date and, for material changes, tell paid users by email or in the app before they apply. Using Citad3L after that means you accept the new Terms.",
    ] },
    { h: "14. Contact", p: [`Questions, refund requests and safety reports: ${LEGAL_CONTACT}.`] },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Privacy Policy",
  effective: LEGAL_EFFECTIVE,
  intro: `This policy explains what ${LEGAL_OPERATOR} ("Citad3L", "we") collects when you use citad3l.io, why, and the choices you have. We don't sell your data and we don't show ads.`,
  sections: [
    { h: "What we collect", p: [
      "Account: your email address, used for 6-digit sign-in codes and account notices. There are no passwords.",
      "Your content: chats, projects, custom instructions, files you attach, and any images or clips already saved in your chats, stored so you can come back to them.",
      "Usage: which model you used, when, and how much of your allowance and daily limits you used.",
      "Billing: if you buy a plan, Stripe handles your card. We receive your plan, subscription status and a Stripe customer ID, never your full card number.",
      "Security: a hashed version of your IP address for rate limits and abuse prevention, and session records (device type, sign-in time). Sign-in is protected by Cloudflare Turnstile.",
      "Safety: when the filter blocks something, we log the category, not the prompt or reply.",
      "Guests: guest chats aren't saved to an account. A signed cookie counts your free messages.",
    ] },
    { h: "How your messages are processed", p: [
      "Venice.ai handles every chat mode, including Swarm worker requests: Citad3L V1, Citad3L Fast, Citad3L Private, and the Fast workers Swarm uses. A request can include the message you just sent, earlier messages in the chat, and files or other content you upload. We don't use your chats to train models. Venice.ai's terms say it does not use your content to train models, and that it requires its language-model providers not to (https://venice.ai/legal/tos, section 10.2, last updated November 15, 2026). Venice.ai's API documentation says it does not store or log prompt and response content for normal inference (https://docs.venice.ai/overview/privacy). Its privacy policy says it does not store the content of prompts or outputs (https://venice.ai/legal/privacy-policy, effective November 26, 2026). For a model Venice marks as anonymized, the model host may keep prompts under that host's own rules. We don't promise more than Venice.ai publishes.",
      "Private-mode text is read by Citad3L on Cloudflare Workers for the safety check before it is encrypted to the provider's enclave. Your browser sends the message to our server over HTTPS. The server reads it, runs the safety check, then encrypts it. The provider's servers and logs only see encrypted text. The chat is saved to your history in readable form like other chats. Citad3L V1, Fast, and Swarm are sent to Venice.ai after that same safety check, without the extra encryption step.",
    ] },
    { h: "Who processes your data", p: [
      "These companies process data to run Citad3L. Each gets only what its job needs.",
      "Venice.ai generates replies for every chat mode, including Swarm. It receives the message, earlier chat context, and uploaded files or other content. For Private, Citad3L reads the text on Cloudflare Workers for the safety check, then encrypts it; Venice.ai receives that ciphertext. Venice.ai says it does not train on that content. It says it does not store prompt or reply text for normal inference. A model host for a model Venice marks as anonymized may still keep prompts under that host's own rules.",
      "Stripe takes card payments if you buy a plan. Stripe receives your card details and billing email. We receive your plan, subscription status, and a Stripe customer id. We never receive your full card number.",
      "Neon hosts our Postgres database. It stores your account, chats, projects, usage, and billing records.",
      "Cloudflare hosts the app on Workers, stores export files in R2, checks sign-in with Turnstile, and can send login-code email through Cloudflare Email Sending. It also sees connection data such as IP address for hosting and security.",
      "Resend sends login-code email when Cloudflare Email Sending is not the sender in use. It receives your email address and the message.",
    ] },
    { h: "Cookies", p: [
      "We use only a few cookies: a sign-in session cookie, a guest-message cookie, and security cookies from Cloudflare.",
      "We also set two first-party cookies for up to 30 days that remember which link or referral brought you here. They stay on citad3l.io, contain no personal info, and are never used for ads or cross-site tracking. We also keep a simple count of which links bring visitors, using only the link's tags, the referring site's name and a random ID we store in scrambled form, never your IP address.",
    ] },
    { h: "Who we share data with", p: [
      "The companies named under \"Who processes your data.\" Each gets only what it needs for its job.",
      "Authorities, when the law requires it, including reports of apparent child sexual abuse material to NCMEC.",
      "A buyer or successor, if Citad3L is sold or reorganized, under this same policy.",
    ] },
    { h: "How long we keep it", p: [
      "Chats, projects and generated media stay until you delete them or your account. Usage and billing records are kept as long as needed for accounting, tax and fraud prevention. Rate-limit records expire within days. Content involved in a child-safety report is preserved as the law requires.",
    ] },
    { h: "Your choices", p: [
      "Export or delete your data any time from your account page. Deleting your account removes your chats, projects and generated media from our systems; backups age out on their normal schedule.",
      `You can also email ${LEGAL_CONTACT} to ask what we hold about you, or to correct or delete it. Depending on where you live, you may have extra rights under local privacy law; we'll honor them.`,
    ] },
    { h: "Security", p: [
      "We use HTTPS everywhere, hashed IPs, signed cookies, rate limits and access controls. No system is perfectly secure, so we can't promise that.",
    ] },
    { h: "Age", p: ["Citad3L is for adults 18 and over. We don't knowingly collect data from anyone under 18 and delete it when we learn of it."] },
    { h: "Changes", p: ["We'll post updates here with a new effective date and tell signed-in users about material changes."] },
    { h: "Contact", p: [`Privacy questions: ${LEGAL_CONTACT}.`] },
  ],
};
