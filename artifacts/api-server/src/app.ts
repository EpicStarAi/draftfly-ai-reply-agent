import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

// Capture raw body for Slack signature verification — must run before express.json()
app.use((req: Request, _res: Response, next: NextFunction): void => {
  let data = "";
  req.setEncoding("utf8");
  req.on("data", (chunk: string) => { data += chunk; });
  req.on("end", () => {
    (req as unknown as { rawBody: string }).rawBody = data;
    next();
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
