import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import personasRouter from "./personas";
import campaignsRouter from "./campaigns";
import draftsRouter from "./drafts";
import logsRouter from "./logs";
import setupRouter from "./setup";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(personasRouter);
router.use(campaignsRouter);
router.use(draftsRouter);
router.use(logsRouter);
router.use(setupRouter);
router.use(dashboardRouter);

export default router;
