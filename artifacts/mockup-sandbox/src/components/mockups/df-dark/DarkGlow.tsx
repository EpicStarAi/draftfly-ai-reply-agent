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

    // ── Organic blob: bezier polygon with per-vertex animated distortion ──
    function organicBlob(
      cx: number, cy: number,
      rx: number, ry: number,
      rotation: number,
      n: number,           // num control points
      wobble: number,      // distortion amplitude 0–1
      phase: number,
      innerColor: string,
      outerColor: string,
      alpha = 1
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      // Build distorted control points
      const pts: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const dist =
          1
          + wobble * Math.sin(t * 0.6 + phase + i * 2.39)
          + wobble * 0.5 * Math.cos(t * 0.9 + phase * 1.7 + i * 3.71)
          + wobble * 0.3 * Math.sin(t * 1.3 + phase * 0.6 + i * 5.13);
        pts.push([
          Math.cos(a) * rx * dist,
          Math.sin(a) * ry * dist,
        ]);
      }

      // Smooth bezier through points
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const cp1x = p1[0] + (p2[0] - p0[0]) * 0.25;
        const cp1y = p1[1] + (p2[1] - p0[1]) * 0.25;
        const cp2x = p2[0] - (pts[(i + 2) % n][0] - p1[0]) * 0.25;
        const cp2y = p2[1] - (pts[(i + 2) % n][1] - p1[1]) * 0.25;
        if (i === 0) ctx.moveTo(p1[0], p1[1]);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
      }
      ctx.closePath();

      // Radial gradient fill (from canvas origin = blob center)
      const maxR = Math.max(rx, ry) * 1.6;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR);
      g.addColorStop(0, innerColor);
      g.addColorStop(0.5, outerColor);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.filter = "blur(18px)";
      ctx.fill();
      ctx.restore();
    }

    // ── Glowing ring: annular shape with animated wobble ──
    function glowRing(
      cx: number, cy: number,
      r: number, thickness: number,
      rotation: number,
      color: string,
      alpha = 1
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(rotation + t * 0.08);

      const n = 80;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const wobble = 1 + 0.08 * Math.sin(t * 1.1 + i * 4.2) + 0.04 * Math.cos(t * 0.7 + i * 7.5);
        const ro = (r + thickness * 0.5) * wobble;
        i === 0 ? ctx.moveTo(Math.cos(a) * ro, Math.sin(a) * ro)
                : ctx.lineTo(Math.cos(a) * ro, Math.sin(a) * ro);
      }
      for (let i = n; i >= 0; i--) {
        const a = (i / n) * Math.PI * 2;
        const wobble = 1 + 0.08 * Math.sin(t * 1.1 + i * 4.2) + 0.04 * Math.cos(t * 0.7 + i * 7.5);
        const ri = (r - thickness * 0.5) * wobble;
        ctx.lineTo(Math.cos(a) * ri, Math.sin(a) * ri);
      }
      ctx.closePath();

      const g = ctx.createRadialGradient(0, 0, r - thickness, 0, 0, r + thickness);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.4, color);
      g.addColorStop(0.6, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.filter = "blur(8px)";
      ctx.fill();
      ctx.restore();
    }

    // ── Light streak: thin rotated ellipse ──
    function streak(
      cx: number, cy: number,
      len: number, width: number,
      angle: number,
      color: string,
      alpha = 1
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(angle + t * 0.05);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
      const g = ctx.createLinearGradient(-len, 0, len, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.3, color);
      g.addColorStop(0.5, color);
      g.addColorStop(0.7, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.filter = "blur(6px)";
      ctx.fill();
      ctx.restore();
    }

    // ── Crescent: two overlapping blobs subtracted ──
    function crescent(
      cx: number, cy: number,
      r: number, offsetX: number, offsetY: number,
      rotation: number,
      color: string,
      alpha = 1
    ) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(rotation + t * 0.04);

      // Outer arc
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      // Inner cutout (even-odd fill rule creates crescent)
      ctx.arc(
        offsetX + Math.sin(t * 0.3) * r * 0.06,
        offsetY + Math.cos(t * 0.25) * r * 0.05,
        r * 0.72, 0, Math.PI * 2, true
      );
      ctx.closePath();

      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
      g.addColorStop(0, color);
      g.addColorStop(0.6, color.replace(/[\d.]+\)$/, "0.3)"));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.filter = "blur(14px)";
      ctx.fill("evenodd");
      ctx.restore();
    }

    // Smooth oscillators
    const s  = (a: number, f: number, ph = 0) => Math.sin(t * f + ph) * a;
    const c  = (a: number, f: number, ph = 0) => Math.cos(t * f + ph) * a;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.filter = "none";

      // ── Deep background pools ──
      organicBlob(
        W * 0.78 + s(W * 0.04, 0.18),  H * 0.1 + c(H * 0.04, 0.14),
        W * 0.48, W * 0.32,
        t * 0.02, 6, 0.18, 0,
        "rgba(4,14,68,0.95)", "rgba(5,20,88,0.5)", 0.9
      );
      organicBlob(
        W * 0.1 + s(W * 0.03, 0.15),  H * 0.9 + c(H * 0.05, 0.11),
        W * 0.38, W * 0.28,
        -t * 0.025, 5, 0.2, 2.1,
        "rgba(10,5,78,0.9)", "rgba(16,8,92,0.42)", 0.85
      );

      // ── Main royal-blue organic mass (large, slow) ──
      organicBlob(
        W * 0.3 + s(W * 0.09, 0.22) + c(W * 0.04, 0.51),
        H * 0.5 + c(H * 0.08, 0.19) + s(H * 0.03, 0.44),
        W * 0.44, W * 0.32,
        t * 0.015, 8, 0.28, 0.5,
        "rgba(18,88,252,0.65)", "rgba(10,55,190,0.28)", 1
      );

      // ── Secondary sweeping arm ──
      organicBlob(
        W * 0.72 + s(W * 0.08, 0.28) + c(W * 0.03, 0.62),
        H * 0.28 + c(H * 0.1,  0.24) + s(H * 0.04, 0.55),
        W * 0.35, W * 0.22,
        -t * 0.02, 7, 0.24, 1.2,
        "rgba(8,105,235,0.52)", "rgba(4,64,178,0.22)", 0.9
      );

      // ── Top curling lobe ──
      organicBlob(
        W * 0.54 + c(W * 0.07, 0.35) + s(W * 0.03, 0.8),
        H * 0.05 + s(H * 0.08, 0.3)  + c(H * 0.03, 0.68),
        W * 0.28, W * 0.18,
        t * 0.03, 6, 0.22, 2.5,
        "rgba(28,115,248,0.44)", "rgba(14,75,200,0.18)", 0.85
      );

      // ── Glowing rings ──
      glowRing(
        W * 0.42 + s(W * 0.06, 0.31),
        H * 0.46 + c(H * 0.06, 0.27),
        W * 0.22, W * 0.025,
        0, "rgba(60,160,255,0.55)", 0.7
      );
      glowRing(
        W * 0.62 + c(W * 0.05, 0.4),
        H * 0.32 + s(H * 0.07, 0.36),
        W * 0.14, W * 0.016,
        Math.PI * 0.3, "rgba(30,200,255,0.45)", 0.6
      );

      // ── Crescents ──
      crescent(
        W * 0.35 + s(W * 0.05, 0.45),
        H * 0.38 + c(H * 0.06, 0.4),
        W * 0.17, W * 0.1, H * 0.04,
        0.8, "rgba(40,140,255,0.6)", 0.75
      );
      crescent(
        W * 0.7  + c(W * 0.04, 0.52),
        H * 0.6  + s(H * 0.05, 0.47),
        W * 0.12, W * 0.07, H * 0.03,
        -0.5, "rgba(0,200,220,0.45)", 0.6
      );

      // ── Streaks ──
      streak(
        W * 0.5  + s(W * 0.12, 0.22),
        H * 0.35 + c(H * 0.08, 0.19),
        W * 0.32, W * 0.012,
        0.6 + t * 0.03,
        "rgba(80,180,255,0.5)", 0.65
      );
      streak(
        W * 0.3  + c(W * 0.1, 0.29),
        H * 0.62 + s(H * 0.07, 0.26),
        W * 0.22, W * 0.008,
        -0.4 - t * 0.02,
        "rgba(0,220,210,0.4)", 0.55
      );
      streak(
        W * 0.68 + s(W * 0.06, 0.41),
        H * 0.2  + c(H * 0.06, 0.36),
        W * 0.18, W * 0.007,
        1.1 + t * 0.025,
        "rgba(100,200,255,0.38)", 0.5
      );

      // ── Bright highlight cores ──
      organicBlob(
        W * 0.42 + s(W * 0.04, 0.65) + c(W * 0.02, 1.1),
        H * 0.44 + c(H * 0.04, 0.58) + s(H * 0.02, 0.97),
        W * 0.11, W * 0.08,
        t * 0.06, 5, 0.15, 0.8,
        "rgba(110,200,255,0.82)", "rgba(55,158,255,0.35)", 1
      );
      organicBlob(
        W * 0.66 + c(W * 0.03, 0.77) + s(W * 0.02, 1.3),
        H * 0.22 + s(H * 0.04, 0.69) + c(H * 0.02, 1.1),
        W * 0.07, W * 0.055,
        -t * 0.08, 5, 0.12, 4.2,
        "rgba(60,215,255,0.75)", "rgba(20,168,240,0.28)", 0.9
      );

      // ── Pinpoint hot core ──
      organicBlob(
        W * 0.39 + s(W * 0.02, 1.1) + c(W * 0.01, 1.8),
        H * 0.42 + c(H * 0.02, 0.95) + s(H * 0.01, 1.6),
        W * 0.042, W * 0.034,
        t * 0.1, 4, 0.1, 1.5,
        "rgba(200,238,255,0.92)", "rgba(120,200,255,0.4)", 1
      );

      t += 0.005;
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
