import "./dark.css";
import { useEffect, useRef } from "react";

function GlowCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const blob = (
      cx: number, cy: number, r: number,
      inner: string, mid: string, outer: string,
      alpha = 1
    ) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,   inner);
      g.addColorStop(0.35, mid);
      g.addColorStop(0.7, outer);
      g.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      resize();
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const s = (v: number, amp: number, speed: number) =>
        v + Math.sin(t * speed) * amp;
      const c = (v: number, amp: number, speed: number) =>
        v + Math.cos(t * speed) * amp;

      // ── Layer 1: deep background pools (far, dark) ──
      // deep navy pool — top right
      blob(
        W * 0.78, H * 0.15, W * 0.55,
        "rgba(5,20,80,0.9)",
        "rgba(8,30,110,0.5)",
        "rgba(0,10,40,0.15)",
        0.9
      );
      // deep indigo — bottom left
      blob(
        W * 0.12, H * 0.85, W * 0.48,
        "rgba(20,10,90,0.85)",
        "rgba(30,15,100,0.4)",
        "rgba(0,0,0,0)",
        0.8
      );

      // ── Layer 2: mid-depth royal blue volumes ──
      // large left core
      blob(
        s(W * 0.3, W * 0.03, 0.4), s(H * 0.48, H * 0.04, 0.3),
        W * 0.48,
        "rgba(20,90,255,0.65)",
        "rgba(10,60,200,0.35)",
        "rgba(0,20,80,0.08)"
      );
      // sweeping right arm
      blob(
        c(W * 0.7, W * 0.04, 0.35), s(H * 0.35, H * 0.05, 0.45),
        W * 0.38,
        "rgba(0,110,240,0.5)",
        "rgba(5,70,190,0.25)",
        "rgba(0,0,0,0)"
      );
      // top curl
      blob(
        s(W * 0.52, W * 0.05, 0.5), c(H * 0.08, H * 0.04, 0.4),
        W * 0.32,
        "rgba(30,120,255,0.45)",
        "rgba(15,80,210,0.2)",
        "rgba(0,0,0,0)"
      );

      // ── Layer 3: bright cyan/electric highlights (close, intense) ──
      // central hot spot
      blob(
        s(W * 0.42, W * 0.025, 0.7), c(H * 0.42, H * 0.03, 0.6),
        W * 0.18,
        "rgba(80,180,255,0.75)",
        "rgba(40,140,255,0.35)",
        "rgba(10,80,220,0.05)"
      );
      // secondary cyan flare — upper right
      blob(
        c(W * 0.68, W * 0.03, 0.55), s(H * 0.22, H * 0.04, 0.48),
        W * 0.14,
        "rgba(60,200,255,0.6)",
        "rgba(20,150,240,0.28)",
        "rgba(0,0,0,0)"
      );
      // lower teal glint
      blob(
        s(W * 0.58, W * 0.02, 0.62), c(H * 0.7, H * 0.03, 0.52),
        W * 0.12,
        "rgba(0,220,210,0.4)",
        "rgba(0,160,180,0.18)",
        "rgba(0,0,0,0)"
      );

      // ── Layer 4: ultra-bright core pinpoint ──
      blob(
        s(W * 0.38, W * 0.015, 0.9), s(H * 0.4, H * 0.02, 0.8),
        W * 0.07,
        "rgba(160,220,255,0.85)",
        "rgba(80,170,255,0.4)",
        "rgba(0,0,0,0)"
      );

      // ── Layer 5: ambient scatter — tiny specks of light ──
      for (let i = 0; i < 4; i++) {
        const ang = t * 0.2 + (i * Math.PI * 2) / 4;
        const rx = W * 0.44 + Math.cos(ang) * W * 0.22;
        const ry = H * 0.44 + Math.sin(ang) * H * 0.18;
        blob(rx, ry, W * 0.04,
          "rgba(120,200,255,0.3)",
          "rgba(60,160,255,0.12)",
          "rgba(0,0,0,0)"
        );
      }

      t += 0.004;
      animRef.current = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
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
