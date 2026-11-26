/** Public FAQ copy. Keep this as the single source for the /faq page, JSON-LD, and tests. */

export type FaqItem = { q: string; a: string };

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    q: "What is Citad3L?",
    a: "Citad3L is a private, less-filtered AI chat app at citad3l.io. You can chat, generate images and short video clips, and use encrypted Private chat and Swarm mode. The logo is a rook.",
  },
  {
    q: "Who made it?",
    a: "Citad3L was founded by Cruz Garza.",
  },
  {
    q: "How is it different?",
    a: "Citad3L is built to be private and less filtered than typical chat apps. Adult text chat between adults is allowed, and chat does not lecture or pile on extra refusals. The only hard lines across the app are no sexual content involving minors, and nothing about bombs or explosives. Image mode keeps a safety filter and will not produce explicit nude or sexual images.",
  },
  {
    q: "Which models can I use?",
    a: "Citad3L V1 is the default and the best all-round chat model. Citad3L Fast is cheaper and quicker. Citad3L Image generates images from a written prompt. Citad3L Private is encrypted, text-only chat in a secure enclave. Citad3L Video makes 5-second 720p clips with sound. Swarm mode splits big requests across V1 and Fast workers.",
  },
  {
    q: "What skills can I turn on?",
    a: "Signed-in users can turn on web search, including in Swarm (off by default). Web search in Swarm uses up to 4 search calls in that run, on top of the 4 Swarm replies. On Citad3L V1, extended thinking is available outside Swarm; it stays off in Swarm. There is also a coding-assistance toggle that steers the model to write complete, runnable code. It cannot run commands or edit your files. Guests do not get web search or extended thinking.",
  },
  {
    q: "Is it private, and what do you store?",
    a: "If you sign in, we store your email, your chats and projects, and account and usage data so you can come back to them. You can export or delete your data from your account. We store a hashed IP for rate limits. Filter refusals log only a category, not the prompt or reply. Guest chats are not saved to an account. V1, Fast and Image are not end-to-end encrypted. Citad3L Private is not end-to-end encrypted from your device: your browser sends the message to our server over HTTPS, like any chat, and our server can read it. Our server runs the safety check on that text, then encrypts it to a secure enclave at our model provider. It only sends after the provider confirms the enclave (attestation) and our nonce, model and key checks pass; we do not check the enclave hardware report ourselves. The AI part of the safety check for Private runs inside the same enclave. Our server decrypts the enclave's reply, checks it, and saves the chat to your history in readable form like other chats (delete it any time). The model host's servers and logs only see encrypted text. Private is text only.",
  },
  {
    q: "What's not allowed?",
    a: "Two hard lines across the app: no sexual content involving minors, and nothing about bombs or explosives. Adult text chat between adults is allowed. Image mode keeps a safety filter and will not produce explicit nude or sexual images. If a message is blocked, we tell you why and you can try different wording. We do not automatically pause or suspend an account just because a message was blocked.",
  },
  {
    q: "How much does it cost?",
    a: "Guests get 5 free messages, one time, with no account. A free account gives you 3 messages every day on Fast and Private, resetting at midnight Central. Swarm uses 4 replies, so it is on Pro and Max. Pro is $20 a month (25 replies every 5 hours, up to 150 a week) and adds Citad3L Image. Max is $50 a month, at 2.5× those windows, and adds Citad3L Video and per-model settings. Subscribe on the pricing page; plans renew monthly and you can cancel any time from your account.",
  },
  {
    q: "Is there a public API?",
    a: "Not yet. Citad3L is a chat app in the browser. There is no public API today, and we have not set a date for one.",
  },
  {
    q: "How do usage caps work?",
    a: "Guests get 5 free messages, one time, with no account. A free account gives you 3 messages every day on Fast and Private, resetting at midnight Central. Swarm uses 4 replies, so it is on Pro and Max. Pro is $20 a month: 25 replies every 5 hours, up to 150 a week, plus Image (up to 10 images a day). Max is $50 a month: 62 replies every 5 hours, up to 375 a week, plus Video (up to 2 clips a day) and per-model settings. Each image or video clip also uses 1 reply of your allowance. Failed or stopped replies do not count. Caps do not roll over.",
  },
  {
    q: "How do I sign in?",
    a: "Enter your email and we'll send a 6-digit code. There are no passwords.",
  },
  {
    q: "How many messages can I send without an account?",
    a: "Guests get 5 free messages, one time, with no account and no card. After that, create a free account for 3 messages every day. Failed or stopped replies never count.",
  },
  {
    q: "Can I generate images?",
    a: "Yes, on Pro and Max. Choose Citad3L Image, or type /image followed by a prompt in chat. Images have a daily limit per account. Image mode keeps a safety filter and will not produce explicit nude or sexual images. Citad3L V1 and Fast can also look at images you upload on any plan. Citad3L Private is text only and cannot read images.",
  },
  {
    q: "Can Citad3L make explicit or nude images?",
    a: "No. Citad3L keeps image generation safe-for-work, and anything sexual involving minors is always blocked.",
  },
  {
    q: "Can I make videos?",
    a: "Yes, on Max. Choose Citad3L Video and describe a clip. Each clip is 5 seconds at 720p, with sound, and there is a daily clip limit per account.",
  },
  {
    q: "How do refunds and contact work?",
    a: "Cancel any time from your account; you keep your plan until the end of the period you paid for. If you ask within 7 days of your first charge, we refund it in full. For refunds, questions or safety reports, email support@citad3l.io. The full rules are in the Terms of Service.",
  },
];

export function faqJsonLd(origin = "https://citad3l.io") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${origin.replace(/\/$/, "")}/faq#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
