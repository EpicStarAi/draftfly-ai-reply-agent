import "./orb.css";

export function OrbCentered() {
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

      {/* Hero */}
      <section className="orb-hero orb-hero--centered">
        {/* The orb */}
        <div className="orb-glow orb-glow--center" />

        {/* Eyebrow */}
        <p className="orb-eyebrow">AI — Outbound Reply Automation</p>

        {/* Headline */}
        <h1 className="orb-headline">
          The inbox is chaos.<br />
          We make it a pipeline.
        </h1>

        {/* Sub */}
        <p className="orb-sub">
          On-brand replies drafted and waiting before you've even<br />
          seen the prospect's email. Approved in one click.
        </p>

        {/* CTAs */}
        <div className="orb-actions">
          <a className="orb-btn-primary">Get Early Access</a>
          <a className="orb-btn-ghost">See how it works</a>
        </div>

        {/* Corner metadata */}
        <span className="orb-meta orb-meta--bl">Lemlist · Slack · Claude AI</span>
        <span className="orb-meta orb-meta--br">V — 1.0</span>
      </section>
    </div>
  );
}
