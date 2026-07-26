import "./dark.css";
import { useEffect, useRef } from "react";

type Pt = [number, number];

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

    // Draw a closed Catmull-Rom smooth path through pts, then
    // fill with an off-center radial gradient and blur.
    const filledShape = (
      pts: Pt[],
      gradX: number, gradY: number, gradR: number,   // gradient hot-spot
      c0: string, c1: string, c2: string,            // inner → mid → outer
      blurPx: number,
      alpha: number
    ) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${blurPx}px)`;

      const n = pts.length;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 5;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 5;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 5;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 5;
        if (i === 0) ctx.moveTo(p1[0], p1[1]);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
      }
      ctx.closePath();

      const g = ctx.createRadialGradient(gradX, gradY, 0, gradX, gradY, gradR);
      g.addColorStop(0,    c0);
      g.addColorStop(0.40, c1);
      g.addColorStop(0.80, c2);
      g.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    };

    // Gentle oscillators for slow organic drift
    const s = (a: number, f: number, ph = 0) => Math.sin(t * f + ph) * a;
    const c = (a: number, f: number, ph = 0) => Math.cos(t * f + ph) * a;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "none";

      // ── Shape 1 — LARGE dominant teal/cyan mass (right-center dominant) ──
      // This is the big volumetric form filling ~60% of the hero, like in the reference.
      // Outline traces a large irregular wing/crescent anchored to the right side.
      filledShape(
        [
          [W*(0.90+s(0.02,0.10)),  H*(0.00+c(0.03,0.08))],  // top-right
          [W*(1.05+s(0.02,0.12)),  H*(0.30+c(0.03,0.11))],  // far right
          [W*(0.95+c(0.02,0.09)),  H*(0.65+s(0.03,0.13))],  // right-lower
          [W*(0.70+s(0.03,0.14)),  H*(0.85+c(0.02,0.10))],  // lower
          [W*(0.40+c(0.03,0.11)),  H*(0.78+s(0.03,0.09))],  // lower-left
          [W*(0.18+s(0.02,0.13)),  H*(0.58+c(0.03,0.12))],  // left waist (the "neck")
          [W*(0.28+c(0.03,0.10)),  H*(0.28+s(0.02,0.08))],  // upper-left
          [W*(0.55+s(0.02,0.09)),  H*(0.05+c(0.03,0.11))],  // top-center
        ],
        W*0.62, H*0.22,   // hot-spot upper-right area
        W*0.65,           // gradient radius
        "rgba(0,225,210,0.95)",   // bright cyan core
        "rgba(0,130,175,0.55)",   // teal mid
        "rgba(0,40,120,0.15)",    // deep blue edge
        45, 0.85
      );

      // ── Shape 2 — deeper blue underlayer (behind shape 1, sets the atmosphere) ──
      filledShape(
        [
          [W*(0.80+c(0.03,0.07)),  H*(-0.05+s(0.02,0.06))],
          [W*(1.10+s(0.02,0.08)),  H*(0.45+c(0.03,0.07))],
          [W*(0.85+c(0.02,0.09)),  H*(0.95+s(0.02,0.08))],
          [W*(0.45+s(0.03,0.07)),  H*(1.00+c(0.02,0.09))],
          [W*(0.10+c(0.02,0.08)),  H*(0.70+s(0.03,0.07))],
          [W*(0.05+s(0.02,0.09)),  H*(0.30+c(0.02,0.08))],
          [W*(0.30+c(0.03,0.07)),  H*(0.05+s(0.02,0.06))],
        ],
        W*0.68, H*0.30,
        W*0.80,
        "rgba(10,80,210,0.80)",
        "rgba(5,40,130,0.45)",
        "rgba(2,15,70,0.12)",
        60, 0.80
      );

      // ── Shape 3 — secondary teal "wing" (upper left, like in thumbnail 1) ──
      filledShape(
        [
          [W*(0.05+s(0.02,0.16)),  H*(0.05+c(0.03,0.14))],
          [W*(0.38+c(0.03,0.18)),  H*(0.00+s(0.02,0.15))],
          [W*(0.50+s(0.02,0.17)),  H*(0.22+c(0.03,0.16))],
          [W*(0.35+c(0.02,0.19)),  H*(0.45+s(0.03,0.17))],
          [W*(0.10+s(0.03,0.16)),  H*(0.42+c(0.02,0.15))],
          [W*(-0.05+c(0.02,0.18)), H*(0.22+s(0.03,0.14))],
        ],
        W*0.28, H*0.16,
        W*0.36,
        "rgba(0,210,200,0.85)",
        "rgba(0,110,170,0.40)",
        "rgba(0,30,100,0.08)",
        38, 0.70
      );

      // ── Shape 4 — bright hot-spot accent (the "fold" highlight seen in reference) ──
      // This is the very bright concentrated teal that makes it look lit from within.
      filledShape(
        [
          [W*(0.48+s(0.02,0.22)),  H*(0.08+c(0.02,0.20))],
          [W*(0.68+c(0.02,0.24)),  H*(0.12+s(0.02,0.21))],
          [W*(0.72+s(0.02,0.23)),  H*(0.35+c(0.02,0.22))],
          [W*(0.58+c(0.02,0.24)),  H*(0.42+s(0.02,0.20))],
          [W*(0.40+s(0.02,0.22)),  H*(0.35+c(0.02,0.23))],
          [W*(0.38+c(0.02,0.21)),  H*(0.15+s(0.02,0.22))],
        ],
        W*0.57, H*0.22,
        W*0.22,
        "rgba(160,255,248,0.95)",  // almost white-cyan at core
        "rgba(0,210,200,0.50)",
        "rgba(0,100,160,0.10)",
        22, 0.80
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
