import path from "node:path";
import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const PgStore = connectPgSimple(session);
const app: Express = express();

// Trust Replit's reverse proxy so req.secure = true and secure cookies are set correctly
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required");
}

app.use(
  session({
    store: new PgStore({
      conString: process.env["DATABASE_URL"],
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }),
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(express.json({
  verify: (_req: Request, _res: Response, buf: Buffer) => {
    (_req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
  },
}));
app.use(express.urlencoded({
  extended: true,
  verify: (_req: Request, _res: Response, buf: Buffer) => {
    (_req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
  },
}));

app.use("/api", router);

// Single-server (VPS/Docker) deployments: on Replit each artifact is served by
// the platform router, but on a VPS the API server also serves the built
// frontends. Set STATIC_APP_DIR / STATIC_LANDING_DIR to the vite build output
// dirs to enable; unset (the Replit case) this block is a no-op.
const staticAppDir = process.env["STATIC_APP_DIR"];
const staticLandingDir = process.env["STATIC_LANDING_DIR"];

if (staticAppDir) {
  const appIndex = path.resolve(staticAppDir, "index.html");
  app.use("/app", express.static(path.resolve(staticAppDir)));
  // SPA fallback for client-side routes like /app/drafts
  app.use("/app", (_req, res) => {
    res.sendFile(appIndex);
  });
}

if (staticLandingDir) {
  const landingIndex = path.resolve(staticLandingDir, "index.html");
  app.use(express.static(path.resolve(staticLandingDir)));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(landingIndex);
  });
}

export default app;
