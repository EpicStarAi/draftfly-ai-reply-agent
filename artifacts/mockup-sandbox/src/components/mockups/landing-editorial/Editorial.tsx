import "./editorial.css";

export function Editorial() {
  return (
    <div className="ed-root">
      {/* ── Nav ── */}
      <nav className="ed-nav">
        <span className="ed-logo">Draftfly</span>
        <div className="ed-nav-links">
          <a>Home</a><a>Service</a><a>Features</a><a>Blog</a><a>Pricing</a>
        </div>
        <a className="ed-nav-cta">Try it for free →</a>
      </nav>

      {/* ── Hero ── */}
      <section className="ed-hero">
        <div className="ed-hero-left">
          <p className="ed-eyebrow">Your Pipeline, In Perfect Rhythm.</p>
          <h1 className="ed-h1">
            Reply Smarter,<br />
            Not Harder
          </h1>
          <p className="ed-hero-sub">
            Take control of your inbox with our AI-powered reply pipeline. Draft responses,
            route them to Slack, and close deals — without the overwhelm.
          </p>
          <a className="ed-btn-pill">Try it for free →</a>
        </div>
        <div className="ed-hero-right">
          {/* Gradient phone stand-in */}
          <div className="ed-phone-orb">
            <div className="ed-phone-inner">
              <div className="ed-phone-screen">
                <div className="ed-screen-row"><span className="ed-dot" style={{background:"#7C3AED"}} /><span className="ed-dot" style={{background:"#EC4899"}} /><span className="ed-dot" style={{background:"#F59E0B"}} /></div>
                <div className="ed-screen-label">NEW DRAFT</div>
                <div className="ed-screen-text">"Hi John, happy to break down pricing..."</div>
                <div className="ed-screen-actions">
                  <span className="ed-screen-btn ed-screen-btn--send">Approve & Send</span>
                  <span className="ed-screen-btn ed-screen-btn--edit">Edit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why it works ── */}
      <section className="ed-why">
        <h2 className="ed-h2">Built for speed,<br />made for real teams.</h2>
        <div className="ed-why-grid">
          {[
            { n: "01", label: "Get More Done In Less Time", desc: "Stop writing from scratch. Every reply is drafted in under 3 seconds." },
            { n: "02", label: "Stay Clear & Focused", desc: "No inbox chaos. Approvals live in Slack where your team already works." },
            { n: "03", label: "Take Control of Your Schedule", desc: "Know the status of every reply, every campaign, all in one dashboard." },
          ].map((f) => (
            <div className="ed-why-card" key={f.n}>
              <span className="ed-why-num">{f.n}</span>
              <h3 className="ed-why-label">{f.label}</h3>
              <p className="ed-why-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Big statement ── */}
      <section className="ed-statement">
        <div className="ed-statement-left">
          <h2 className="ed-statement-h2">
            Designed to<br />
            Help You Close<br />
            More{" "}
            <em>With Less<br />
            Effort</em>
          </h2>
        </div>
        <div className="ed-statement-right">
          <p className="ed-statement-sub">
            DraftFly gives modern sales teams a reply automation layer that
            keeps pipeline moving without adding overhead.
          </p>
          <div className="ed-features-mini">
            {[
              { title: "AI Draft Engine", desc: "Persona-matched replies in seconds, not minutes." },
              { title: "Slack Approvals", desc: "One click sends — right from your team's home." },
              { title: "Full Visibility", desc: "Dashboard tracks every reply across every campaign." },
            ].map((f) => (
              <div className="ed-feature-row" key={f.title}>
                <div className="ed-feature-icon" />
                <div>
                  <div className="ed-feature-title">{f.title}</div>
                  <div className="ed-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="ed-cta-band">
        <div className="ed-cta-orb" />
        <div className="ed-cta-content">
          <p className="ed-cta-eyebrow">No stress, just flow.</p>
          <h2 className="ed-cta-h2">Ready to Reclaim<br />Your Pipeline?</h2>
          <a className="ed-btn-white">Get Early Access →</a>
        </div>
      </section>

      {/* ── Footer strip ── */}
      <footer className="ed-footer">
        <p className="ed-footer-trust">Trusted by growing sales teams</p>
        <div className="ed-footer-logos">
          {["Lemlist", "Slack", "Smartlead", "HubSpot", "Instantly", "Salesforce"].map(l => (
            <span className="ed-footer-logo" key={l}>{l}</span>
          ))}
        </div>
        <p className="ed-footer-tagline">Make replies work for you. Draft smarter. Close better.</p>
      </footer>
    </div>
  );
}
