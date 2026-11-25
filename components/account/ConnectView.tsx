import { SiteFooter } from "@/components/SiteFooter";

export function ConnectView() {
  return (
    <>
      <main className="page-main connect-page">
        <section className="connect-hero container">
          <span className="connect-soon">Coming soon</span>
          <h1 className="display hero-title">Citad3L in your terminal.</h1>
          <p className="hero-sub">The Citad3L API speaks the standard chat-completions format, so coding agents and CLI tools can run on Citad3L models. Your other subscriptions stay separate.</p>
        </section>
        <section className="container connect-grid">
          <article className="connect-card">
            <h2 className="connect-card-title">Coding agents</h2>
            <p className="connect-card-desc">Point compatible tools — coding assistants, CLIs, and other tools that speak this format — at Citad3L when keys launch.</p>
            <button type="button" className="btn btn-secondary" disabled>Soon</button>
          </article>
          <article className="connect-card">
            <h2 className="connect-card-title">Your own scripts</h2>
            <p className="connect-card-desc">The same API, from any language. Keys will be issued from your account and are never shared.</p>
            <pre className="connect-snippet">{`# Coming soon
export CITAD3L_API_KEY=…  # issued from your account
curl \$CITAD3L_BASE_URL/chat/completions`}</pre>
            <button type="button" className="btn btn-secondary" disabled>Soon</button>
          </article>
        </section>
        <p className="container tiny" style={{ marginTop: 28, paddingBottom: 48 }}>Included with Pro and Max at launch. Keys are issued from your account. Provider credentials stay on the server.</p>
      </main>
      <SiteFooter />
    </>
  );
}

export default ConnectView;
