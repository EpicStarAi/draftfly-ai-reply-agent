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

    // Draw a radial gradient blob
    const blob = (
      cx: number, cy: number, r: number,
      c0: string, c1: string, c2: string,
      alpha = 1
    ) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,    c0);
      g.addColorStop(0.38, c1);
      g.addColorStop(0.75, c2);
      g.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
    };

    // Smooth organic position — sum of two sine waves with different freqs
    const ox = (base: number, a1: number, f1: number, a2: number, f2: number, ph = 0) =>
      base + Math.sin(t * f1 + ph) * a1 + Math.sin(t * f2 + ph * 1.3) * a2;
    const oy = (base: number, a1: number, f1: number, a2: number, f2: number, ph = 0) =>
      base + Math.cos(t * f1 + ph) * a1 + Math.cos(t * f2 + ph * 0.7) * a2;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ── Layer 0: far background — deep navy anchors ──
      blob(
        ox(W * 0.8, W * 0.06, 0.18, W * 0.03, 0.41, 0),
        oy(H * 0.12, H * 0.05, 0.22, H * 0.02, 0.37, 0),
        W * 0.58,
        "rgba(4,16,72,0.95)", "rgba(6,24,90,0.5)", "rgba(2,8,35,0.1)",
        0.9
      );
      blob(
        ox(W * 0.1, W * 0.05, 0.15, W * 0.03, 0.34, 2.1),
        oy(H * 0.88, H * 0.06, 0.19, H * 0.02, 0.43, 2.1),
        W * 0.46,
        "rgba(12,6,80,0.9)", "rgba(18,10,95,0.42)", "rgba(0,0,0,0)",
        0.85
      );

      // ── Layer 1: large sweeping royal-blue volumes ──
      // Primary left mass — slowest, biggest
      blob(
        ox(W * 0.28, W * 0.12, 0.25, W * 0.05, 0.57, 0.5),
        oy(H * 0.5,  H * 0.1,  0.21, H * 0.04, 0.48, 0.5),
        W * 0.52,
        "rgba(18,88,255,0.62)", "rgba(10,58,195,0.3)", "rgba(0,18,72,0.06)"
      );
      // Right sweeping arm
      blob(
        ox(W * 0.72, W * 0.1, 0.32, W * 0.04, 0.63, 1.2),
        oy(H * 0.3,  H * 0.12, 0.27, H * 0.05, 0.52, 1.2),
        W * 0.4,
        "rgba(8,105,235,0.48)", "rgba(4,68,185,0.22)", "rgba(0,0,0,0)"
      );
      // Top curl that dips down
      blob(
        ox(W * 0.55, W * 0.08, 0.38, W * 0.04, 0.71, 2.5),
        oy(H * 0.06, H * 0.1,  0.31, H * 0.04, 0.59, 2.5),
        W * 0.34,
        "rgba(28,115,250,0.42)", "rgba(14,78,205,0.18)", "rgba(0,0,0,0)"
      );

      // ── Layer 2: mid brighter secondary cores ──
      blob(
        ox(W * 0.62, W * 0.09, 0.44, W * 0.03, 0.83, 3.8),
        oy(H * 0.58, H * 0.08, 0.38, H * 0.03, 0.72, 3.8),
        W * 0.24,
        "rgba(40,148,255,0.55)", "rgba(20,110,240,0.25)", "rgba(0,0,0,0)"
      );
      blob(
        ox(W * 0.3,  W * 0.07, 0.51, W * 0.03, 0.9, 5.1),
        oy(H * 0.28, H * 0.09, 0.43, H * 0.03, 0.78, 5.1),
        W * 0.2,
        "rgba(55,160,255,0.5)", "rgba(28,120,245,0.22)", "rgba(0,0,0,0)"
      );

      // ── Layer 3: cyan/teal highlights — fast and close ──
      blob(
        ox(W * 0.42, W * 0.07, 0.65, W * 0.025, 1.1, 0.8),
        oy(H * 0.44, H * 0.07, 0.58, H * 0.025, 0.97, 0.8),
        W * 0.15,
        "rgba(90,195,255,0.72)", "rgba(45,155,255,0.32)", "rgba(10,80,210,0.04)"
      );
      // teal glint — drifts independently
      blob(
        ox(W * 0.64, W * 0.06, 0.77, W * 0.02, 1.25, 4.2),
        oy(H * 0.65, H * 0.07, 0.69, H * 0.02, 1.08, 4.2),
        W * 0.1,
        "rgba(0,225,215,0.42)", "rgba(0,170,190,0.18)", "rgba(0,0,0,0)"
      );
      // electric cyan top-right flare
      blob(
        ox(W * 0.76, W * 0.05, 0.83, W * 0.02, 1.4, 6.0),
        oy(H * 0.18, H * 0.06, 0.74, H * 0.02, 1.2, 6.0),
        W * 0.09,
        "rgba(70,210,255,0.55)", "rgba(30,165,250,0.24)", "rgba(0,0,0,0)"
      );

      // ── Layer 4: ultra-bright pinpoint core ──
      blob(
        ox(W * 0.38, W * 0.04, 1.1, W * 0.015, 1.8, 1.5),
        oy(H * 0.42, H * 0.04, 0.95, H * 0.015, 1.6, 1.5),
        W * 0.065,
        "rgba(180,230,255,0.88)", "rgba(100,190,255,0.38)", "rgba(0,0,0,0)"
      );

      // ── Layer 5: orbiting micro-sparks ──
      for (let i = 0; i < 5; i++) {
        const phase = (i / 5) * Math.PI * 2;
        const speed = 0.28 + i * 0.04;
        const rx = W * 0.44 + Math.cos(t * speed + phase) * W * 0.26;
        const ry = H * 0.44 + Math.sin(t * speed * 0.75 + phase) * H * 0.2;
        blob(rx, ry, W * 0.038,
          "rgba(130,210,255,0.28)", "rgba(60,160,255,0.1)", "rgba(0,0,0,0)"
        );
      }

      t += 0.006;
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

      {/* ── Hero + glow ── */}
      <section className="dg-hero">
        <GlowCanvas />
        {/* Bottom fade — blends glow into page */}
        <div className="dg-hero-fade" />
        <div className="dg-hero-content">
          <h1 className="dg-headline">DraftFly.</h1>
          <p className="dg-sub">We automate outbound replies for innovative sales teams.</p>
          <div className="dg-hero-btns">
            <a className="dg-btn dg-btn--outline">our services</a>
            <a className="dg-btn dg-btn--primary">contact us →</a>
          </div>
        </div>
      </section>

      {/* ── Statement — glow bleeds in from above ── */}
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
            <p className="dg-card-desc">Persona-matched replies drafted from incoming emails in under 3 seconds.</p>
          </div>

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
                  <div className="dg-slack-draft">"Hi John, Enterprise includes SSO, dedicated onboarding..."</div>
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
            <p className="dg-card-desc">One-click Slack approvals. No inbox switching, no lost context.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
