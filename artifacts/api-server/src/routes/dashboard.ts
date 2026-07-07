import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, clientsTable, campaignsTable, draftsTable, activityTable, personasTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  ListActivityQueryParams,
  ListActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [clients, campaigns, allDrafts, personas] = await Promise.all([
    db.select().from(clientsTable),
    db.select().from(campaignsTable).where(eq(campaignsTable.isActive, true)),
    db.select().from(draftsTable),
    db.select().from(personasTable),
  ]);

  const pendingDrafts = allDrafts.filter((d) => d.status === "pending").length;
  const totalDraftsSent = allDrafts.filter((d) => d.status === "sent").length;
  const totalDraftsDiscarded = allDrafts.filter((d) => d.status === "discarded").length;
  const totalDraftsEdited = allDrafts.filter((d) => d.status === "edited").length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const webhooksToday = allDrafts.filter((d) => new Date(d.createdAt) >= todayStart).length;

  const total = allDrafts.length;
  const actioned = totalDraftsSent + totalDraftsEdited;
  const successRate = total > 0 ? Math.round((actioned / total) * 100) / 100 : 0;

  res.json(GetDashboardStatsResponse.parse({
    totalClients: clients.length,
    activeCampaigns: campaigns.length,
    totalPersonas: personas.length,
    pendingDrafts,
    totalDraftsSent,
    totalDraftsDiscarded,
    totalDraftsEdited,
    webhooksToday,
    successRate,
  }));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const limit = query.data.limit ?? 20;
  const activity = await db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(limit);
  res.json(ListActivityResponse.parse(activity));
});

export default router;
