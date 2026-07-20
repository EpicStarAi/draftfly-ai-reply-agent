import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(cors());

// Capture raw body for Slack signature verification via verify callback
// This avoids consuming the stream before express.json() can read it
app.use(express.json({
  verify: (_req: Request, _res: Response, buf: Buffer) => {
    (_req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
  },
}));
// Also capture raw body for URL-encoded requests (Slack sends interactions as
// application/x-www-form-urlencoded, so we need rawBody here too for signature verification)
app.use(express.urlencoded({
  extended: true,
  verify: (_req: Request, _res: Response, buf: Buffer) => {
    (_req as unknown as { rawBody: string }).rawBody = buf.toString("utf8");
  },
}));

app.use("/api", router);

export default app;
