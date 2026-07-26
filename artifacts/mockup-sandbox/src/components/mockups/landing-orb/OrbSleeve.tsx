import "./orb.css";

export function OrbSleeve() {
  return (
    <div className="orb-root">
      {/* Fixed nav wordmark */}
      <nav className="orb-nav">
        <span className="orb-wordmark">DRAFTFLY</span>
        <a className="orb-cta-link">Request Access →</a>
      </nav>

      <div className="orb-sleeve">
        <div className="orb-sleeve-inner">
          {/* Corner labels — record sleeve style */}
          <div className="orb-sleeve-label orb-sleeve-label--tl">
            AI Outbound<br />
            — Reply Automation
          </div>
          <div className="orb-sleeve-label orb-sleeve-label--tr">
            DFY — 001
          </div>

          {/* The orb */}
          <div
            style={{
              width: 480,
              height: 480,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 38%, #F47322 0%, #E84040 28%, #A020B0 56%, #3A18A0 82%, transparent 100%)",
              filter: "blur(72px)",
              opacity: 0.88,
              flexShrink: 0,
            }}
          />

          {/* Headline sits just below orb center */}
          <div className="orb-sleeve-headline">
            The inbox is chaos. We make it a pipeline.
          </div>
        </div>

        {/* Bottom bar — record label footer */}
        <div className="orb-sleeve-meta-grid">
          <div>
            <div style={{ marginBottom: 4 }}>Original Mix</div>
            <div style={{ color: "#BAB4AD" }}>Lemlist · Slack · Claude AI</div>
          </div>
          <div className="orb-sleeve-meta-right">
            <div>00 — 00 — 000</div>
            <div style={{ color: "#BAB4AD", marginTop: 4 }}>
              <span style={{ textDecoration: "line-through" }}>DRAFTFLY</span> RECORDS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
