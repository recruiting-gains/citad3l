import Link from "next/link";
import type { LegalDoc } from "@/lib/legal";
import { SiteFooter } from "@/components/SiteFooter";

export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
    <main className="state-page" style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px", textAlign: "left" }}>
      <h1 className="display" style={{ fontSize: 40 }}>{doc.title}</h1>
      <p className="tiny" style={{ marginTop: 8 }}>Effective {doc.effective}</p>
      <p className="text-2" style={{ marginTop: 20 }}>{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.h} style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{s.h}</h2>
          {s.p.map((t, i) => <p key={i} className="text-2" style={{ marginTop: 10, lineHeight: 1.6 }}>{t}</p>)}
        </section>
      ))}
      <p className="tiny" style={{ marginTop: 40 }}><Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/faq">FAQ</Link></p>
    </main>
    <SiteFooter />
    </>
  );
}
