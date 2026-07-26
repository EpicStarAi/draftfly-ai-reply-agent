import "./orb.css";

export function OrbOffset() {
  return (
    <div className="orb-root">
      {/* Nav */}
      <nav className="orb-nav">
        <span className="orb-wordmark">DRAFTFLY</span>
        <div className="orb-nav-right">
          <a className="orb-nav-link">Pricing</a>
          <a className="orb-nav-link">Sign in</a>
          <a className="orb-cta-link">Request Access →</a>
        </div>
      </nav>

      {/* Hero — text left, orb bleeds right */}
      <section className="orb-hero orb-hero--offset">
        {/* The orb */}
        <div className="orb-glow orb-glow--right" />

        <p className="orb-eyebrow">Outbound reply automation</p>

        <h1 className="orb-headline">
          The inbox<br />
          is chaos.<br />
          We make it<br />
          a pipeline.
        </h1>

        <p className="orb-sub">
          On-brand replies drafted and waiting before you've even
          seen the prospect's email. Approved in one click.
        </p>

        <div className="orb-actions">
          <a className="orb-btn-primary">Get Early Access</a>
          <a className="orb-btn-ghost">See how it works</a>
        </div>

        {/* Metadata corners */}
        <span className="orb-meta orb-meta--tl">AI — Lemlist · Slack</span>
        <span className="orb-meta orb-meta--bl">Lemlist · Slack · Claude AI</span>
        <span className="orb-meta orb-meta--br">V — 1.0</span>
      </section>
    </div>
  );
}
