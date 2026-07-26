import "./dark.css";
import { useEffect, useRef } from "react";

type Pt = [number, number];

// Cubic bezier point
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, s: number): Pt => {
  const mt = 1 - s;
  return [
    mt*mt*mt*p0[0] + 3*mt*mt*s*p1[0] + 3*mt*s*s*p2[0] + s*s*s*p3[0],
    mt*mt*mt*p0[1] + 3*mt*mt*s*p1[1] + 3*mt*s*s*p2[1] + s*s*s*p3[1],
  ];
};

// Build ribbon outline (upper/lower edges) along a bezier spine
const buildRibbon = (
  p0: Pt, p1: Pt, p2: Pt, p3: Pt,
  maxW: number, segs = 70
): [Pt[], Pt[]] => {
  const upper: Pt[] = [], lower: Pt[] = [];
  const eps = 0.003;
  for (let i = 0; i <= segs; i++) {
    const s  = i / segs;
    const [x, y]   = bez(p0, p1, p2, p3, s);
    const [nx, ny] = bez(p0, p1, p2, p3, Math.min(s + eps, 1));
    const dx = nx - x, dy = ny - y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len;           // perpendicular
    // Bell width — taper to 0 at both ends, peak in middle
    const w = maxW * Math.pow(Math.sin(s * Math.PI), 0.7);
    upper.push([x + px * w, y + py * w]);
    lower.push([x - px * w, y - py * w]);
  }
  return [upper, lower];
};

// Trace a ribbon outline as a closed canvas path
const tracePath = (ctx: CanvasRenderingContext2D, upper: Pt[], lower: Pt[]) => {
  ctx.beginPath();
  ctx.moveTo(upper[0][0], upper[0][1]);
  for (const p of upper) ctx.lineTo(p[0], p[1]);
  for (let i = lower.length - 1; i >= 0; i--) ctx.lineTo(lower[i][0], lower[i][1]);
  ctx.closePath();
};

function GlowCanvas() {
  const ref    = useRef<HTMLCanvasElement>(null);
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

    // Draw one ribbon: outer diffuse glow + narrow bright core
    const ribbon = (
      p0: Pt, p1: Pt, p2: Pt, p3: Pt,
      maxW: number,
      coreColor: string,   // rgba for the bright spine
      glowColor: string,   // rgba for the outer haze
      alpha = 1,
      blurOuter = 28,
      blurCore  = 7
    ) => {
      const [upper, lower] = buildRibbon(p0, p1, p2, p3, maxW);

      // ── Outer glow (wide + heavily blurred) ──
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      ctx.filter = `blur(${blurOuter}px)`;
      tracePath(ctx, upper, lower);
      ctx.fillStyle = glowColor;
      ctx.fill();
      ctx.restore();

      // ── Mid haze (medium blur) ──
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.filter = `blur(${blurCore * 2}px)`;
      const [u2, l2] = buildRibbon(p0, p1, p2, p3, maxW * 0.55);
      tracePath(ctx, u2, l2);
      ctx.fillStyle = coreColor;
      ctx.fill();
      ctx.restore();

      // ── Bright core (narrow + sharp) ──
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.filter = `blur(${blurCore}px)`;
      const [u3, l3] = buildRibbon(p0, p1, p2, p3, maxW * 0.22);
      tracePath(ctx, u3, l3);
      ctx.fillStyle = coreColor;
      ctx.fill();
      ctx.restore();
    };

    // Smooth oscillators
    const s = (a: number, f: number, ph = 0) => Math.sin(t * f + ph) * a;
    const c = (a: number, f: number, ph = 0) => Math.cos(t * f + ph) * a;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "none";

      // ── Deep background radial (keeps the dark blue atmosphere) ──
      ctx.save();
      ctx.filter = "blur(70px)";
      ctx.globalAlpha = 0.85;
      const bg = ctx.createRadialGradient(W*0.48, H*0.38, 0, W*0.48, H*0.38, W*0.6);
      bg.addColorStop(0,   "rgba(6, 22, 100, 0.9)");
      bg.addColorStop(0.5, "rgba(3, 10,  60, 0.5)");
      bg.addColorStop(1,   "rgba(0,  0,   0, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // ── Ribbon 1 — large sweeping teal arc (slow, dominant) ──
      ribbon(
        [W*(0.05 + s(0.04, 0.14)),    H*(1.05 + c(0.03, 0.10))],
        [W*(0.55 + s(0.06, 0.18)),    H*(0.08 + c(0.05, 0.15))],
        [W*(0.38 + c(0.05, 0.22)),    H*(0.62 + s(0.04, 0.20))],
        [W*(0.92 + c(0.03, 0.16)),    H*(0.28 + s(0.05, 0.12))],
        W * 0.13,
        "rgba(0, 215, 200, 0.9)",
        "rgba(0, 100, 160, 0.55)",
        0.88, 32, 8
      );

      // ── Ribbon 2 — deep blue background sweep (wide, hazy) ──
      ribbon(
        [W*(-0.05 + c(0.03, 0.11)),   H*(0.55 + s(0.05, 0.09))],
        [W*(0.48  + s(0.07, 0.15)),   H*(0.10 + c(0.06, 0.13))],
        [W*(0.52  + c(0.05, 0.20)),   H*(0.78 + s(0.04, 0.17))],
        [W*(1.08  + s(0.03, 0.13)),   H*(0.42 + c(0.04, 0.11))],
        W * 0.20,
        "rgba(15, 80, 230, 0.75)",
        "rgba(5,  28, 120, 0.45)",
        0.72, 40, 12
      );

      // ── Ribbon 3 — cyan flame tendril (curls up, medium) ──
      ribbon(
        [W*(0.42 + s(0.03, 0.30)),    H*(1.02)],
        [W*(0.28 + c(0.06, 0.25)),    H*(0.52 + s(0.05, 0.23))],
        [W*(0.68 + s(0.05, 0.33)),    H*(0.22 + c(0.06, 0.28))],
        [W*(0.52 + c(0.04, 0.37)),    H*(-0.04)],
        W * 0.072,
        "rgba(70, 235, 225, 0.95)",
        "rgba(0, 160, 180, 0.5)",
        0.92, 22, 6
      );

      // ── Ribbon 4 — rightward teal arc ──
      ribbon(
        [W*(0.68 + c(0.04, 0.21)),    H*(1.02)],
        [W*(0.98 + s(0.03, 0.18)),    H*(0.48 + c(0.05, 0.16))],
        [W*(0.52 + c(0.05, 0.24)),    H*(0.18 + s(0.04, 0.21))],
        [W*(0.78 + s(0.04, 0.27)),    H*(-0.04)],
        W * 0.058,
        "rgba(30, 225, 215, 0.85)",
        "rgba(0, 120, 150, 0.38)",
        0.72, 20, 6
      );

      // ── Ribbon 5 — diagonal cross-sweep (bottom-right to top-left) ──
      ribbon(
        [W*(0.95 + s(0.03, 0.19)),    H*(0.85 + c(0.04, 0.16))],
        [W*(0.6  + c(0.05, 0.23)),    H*(0.55 + s(0.05, 0.20))],
        [W*(0.42 + s(0.04, 0.27)),    H*(0.28 + c(0.04, 0.24))],
        [W*(0.1  + c(0.03, 0.31)),    H*(-0.02)],
        W * 0.048,
        "rgba(0, 200, 220, 0.8)",
        "rgba(0,  80, 140, 0.35)",
        0.65, 18, 5
      );

      // ── Ribbon 6 — hot white-cyan highlight (thin, fast) ──
      ribbon(
        [W*(0.38 + c(0.02, 0.44)),    H*(0.78 + s(0.03, 0.39))],
        [W*(0.50 + s(0.04, 0.37)),    H*(0.42 + c(0.04, 0.33))],
        [W*(0.44 + c(0.03, 0.41)),    H*(0.18 + s(0.03, 0.37))],
        [W*(0.58 + s(0.02, 0.47)),    H*(0.02)],
        W * 0.026,
        "rgba(210, 255, 252, 0.98)",
        "rgba( 80, 215, 225, 0.45)",
        0.9, 12, 4
      );

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
