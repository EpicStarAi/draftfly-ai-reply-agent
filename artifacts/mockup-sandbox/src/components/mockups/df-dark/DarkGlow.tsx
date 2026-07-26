import "./dark.css";
import { useEffect, useRef } from "react";

function GlowCanvas() {
  const ref     = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let t = 0;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    // Single radial gradient drawn over the full canvas rect with blur
    const glow = (
      cx: number, cy: number, r: number,
      inner: string, outer: string,
      blurPx: number,
      alpha: number
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${blurPx}px)`;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,    inner);
      g.addColorStop(0.55, outer);
      g.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    };

    const s = (a: number, f: number, ph = 0) => Math.sin(t * f + ph) * a;
    const c = (a: number, f: number, ph = 0) => Math.cos(t * f + ph) * a;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "none";

      // ── 1. Deep royal-blue atmosphere (the broad dark-blue volume on the right)
      //    Matches the large blue field behind the teal in the reference.
      glow(
        W * (0.68 + s(0.03, 0.10)), H * (0.40 + c(0.03, 0.09)),
        W * 0.72,
        "rgba(10, 55, 175, 0.92)",
        "rgba(3,  18,  80, 0.50)",
        55, 0.92
      );

      // ── 2. Upper teal lobe — the dominant bright teal mass (upper-right)
      //    This is the brightest, most saturated area visible in the hero.
      glow(
        W * (0.67 + s(0.025, 0.14)), H * (0.20 + c(0.030, 0.12)),
        W * 0.40,
        "rgba(0, 228, 212, 1.00)",
        "rgba(0, 130, 172, 0.42)",
        28, 0.92
      );

      // ── 3. Lower teal lobe — the secondary mass (lower-center)
      //    Together with #2 it creates the S-curve / flowing form.
      glow(
        W * (0.44 + c(0.030, 0.16)), H * (0.72 + s(0.025, 0.14)),
        W * 0.30,
        "rgba(0, 200, 188, 0.88)",
        "rgba(0, 100, 155, 0.38)",
        32, 0.80
      );

      // ── 4. Connecting neck (darker teal-blue waist linking the two lobes)
      //    This creates the narrow pinch seen in the middle of the form.
      glow(
        W * (0.56 + s(0.020, 0.20)), H * (0.45 + c(0.025, 0.18)),
        W * 0.18,
        "rgba(0, 110, 172, 0.65)",
        "rgba(0,  42, 105, 0.28)",
        22, 0.72
      );

      // ── 5. Bright white-teal hotspot (the near-white peak at the top of the upper lobe)
      //    The very bright concentrated point seen clearly in the reference.
      glow(
        W * (0.64 + s(0.015, 0.26)), H * (0.15 + c(0.018, 0.23)),
        W * 0.12,
        "rgba(190, 255, 250, 0.96)",
        "rgba(  0, 228, 215, 0.48)",
        14, 0.88
      );

      t += 0.003;
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
      <nav className="dg-nav">
        <div className="dg-nav-brand">
          <span className="dg-nav-star">✦</span>
          <span className="dg-nav-name">DraftFly</span>
        </div>
        <div className="dg-nav-links">
          <a>services</a><a>process</a><a>team</a><a>pricing</a><a>contact</a>
        </div>
        <a className="dg-nav-cta">Get early access</a>
      </nav>

      <section className="dg-hero">
        <GlowCanvas />
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
