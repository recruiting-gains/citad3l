import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistForm } from "@/components/marketing/WaitlistForm";
import { faqJsonLd, publicFaqItems } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ · Citad3L",
  description: "Answers about Citad3L: models, privacy, pricing, sign-in, and refunds.",
};

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function Page() {
  const jsonLd = faqJsonLd("https://citad3l.io");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="page-main">
        <section className="hero container container-narrow">
          <h1 className="display hero-title">Questions about Citad3L.</h1>
          <p className="hero-sub">What it is, how sign-in works, what we store, and how Free, Pro and Max work.</p>
        </section>
        <section className="faq-section container" aria-labelledby="faq-title">
          <h2 id="faq-title" className="sr-only">Frequently asked questions</h2>
          <div className="faq">
            {publicFaqItems().map((item) => (
              <details key={item.q}>
                <summary>{item.q}<PlusIcon /></summary>
                <p className="faq-body">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="section-lg container" aria-label="Updates">
          <WaitlistForm source="faq" />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
