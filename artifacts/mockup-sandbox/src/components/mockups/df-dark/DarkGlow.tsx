import "./dark.css";
import { useEffect, useRef } from "react";

function GlowCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;

    const draw = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const W = canvas.width, H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // blob 1 — large leftish
      const g1 = ctx.createRadialGradient(W * 0.35, H * 0.42, 0, W * 0.35, H * 0.42, W * 0.42);
      g1.addColorStop(0, "rgba(30,130,255,0.55)");
      g1.addColorStop(0.4, "rgba(0,90,220,0.3)");
      g1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, W, H);

      // blob 2 — right lower
      const g2 = ctx.createRadialGradient(W * 0.72, H * 0.65, 0, W * 0.72, H * 0.65, W * 0.34);
      g2.addColorStop(0, "rgba(0,160,255,0.45)");
      g2.addColorStop(0.5, "rgba(10,80,200,0.2)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);

      // blob 3 — top center (the curling arm)
      const g3 = ctx.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.1, W * 0.28);
      g3.addColorStop(0, "rgba(20,100,255,0.35)");
      g3.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, W, H);
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return <canvas ref={ref} className="dg-canvas" />;
}

export function DarkGlow() {
  return (
    <div className="dg-root">
      {/* ── Nav ── */}
      <nav className="dg-nav">
        <div className="dg-nav-brand">
          <span className="dg-nav-star">✦</span>
          <span className="dg-nav-name">DraftFly</span>
        </div>
        <div className="dg-nav-links">
          <a>services</a>
          <a>process</a>
          <a>team</a>
          <a>pricing</a>
          <a>contact</a>
        </div>
        <a className="dg-nav-cta">Get early access</a>
      </nav>

      {/* ── Hero ── */}
      <section className="dg-hero">
        <GlowCanvas />
        <div className="dg-hero-content">
          <h1 className="dg-headline">DraftFly.</h1>
          <p className="dg-sub">We automate outbound replies for innovative sales teams.</p>
          <div className="dg-hero-btns">
            <a className="dg-btn dg-btn--outline">our services</a>
            <a className="dg-btn dg-btn--primary">contact us →</a>
          </div>
        </div>
      </section>

      {/* ── Statement ── */}
      <section className="dg-statement">
        <div className="dg-watermark">DRAFTFLY</div>
        <div className="dg-statement-content">
          <p className="dg-statement-text">
            We're DraftFly. We build AI-powered reply pipelines
            for high-velocity sales teams.
          </p>
          <a className="dg-btn dg-btn--outline dg-btn--sm">Get in touch</a>
        </div>
      </section>

      {/* ── What we do ── */}
      <section className="dg-what">
        <h2 className="dg-what-title">What we do</h2>
        <div className="dg-cards">
          {/* Card 1 */}
          <div className="dg-card">
            <div className="dg-card-screen">
              <div className="dg-chat-row dg-chat-row--user">
                <span className="dg-chat-avatar dg-chat-avatar--user">P</span>
                <div className="dg-chat-bubble">
                  <div className="dg-chat-meta">You · 8:25 AM</div>
                  <div className="dg-chat-msg">"Tell me more about your pricing and onboarding."</div>
                </div>
              </div>
              <div className="dg-chat-row">
                <span className="dg-chat-avatar">AI</span>
                <div className="dg-chat-bubble">
                  <div className="dg-chat-meta">AI Draft · 8:15 AM</div>
                  <div className="dg-chat-msg">"Hi John, happy to break down pricing — Enterprise starts at..."</div>
                </div>
              </div>
              <div className="dg-card-input">
                <span>Message AI Assistant...</span>
                <span className="dg-card-send">↑</span>
              </div>
            </div>
            <h3 className="dg-card-title">AI Draft Engine</h3>
            <p className="dg-card-desc">We draft persona-matched replies from incoming emails in under 3 seconds using advanced context loading.</p>
          </div>

          {/* Card 2 */}
          <div className="dg-card">
            <div className="dg-card-screen">
              <div className="dg-gen-label">Routing to Slack...</div>
              <div className="dg-slack-mock">
                <div className="dg-slack-header">
                  <span className="dg-slack-dot" />
                  <span className="dg-slack-channel">#sales-approvals</span>
                </div>
                <div className="dg-slack-msg">
                  <div className="dg-slack-from">DraftFly Bot <span>2:04 PM</span></div>
                  <div className="dg-slack-draft">"Hi John, happy to share pricing. Enterprise includes SSO, dedicated onboarding..."</div>
                  <div className="dg-slack-btns">
                    <span className="dg-slack-btn dg-slack-btn--approve">Approve & Send</span>
                    <span className="dg-slack-btn">Edit</span>
                  </div>
                </div>
              </div>
              <div className="dg-card-gen-row">
                <span>Approve or edit draft</span>
                <span className="dg-card-gen-btn">Send →</span>
              </div>
            </div>
            <h3 className="dg-card-title">Slack Approval Flow</h3>
            <p className="dg-card-desc">Every AI draft lands in your Slack channel for one-click approval. No inbox switching, no lost context.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
