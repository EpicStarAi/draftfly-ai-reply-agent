import { Router, type IRouter } from "express";
import { eq, desc, gte } from "drizzle-orm";
import { db, clientsTable, campaignsTable, draftsTable, activityTable, personasTable } from "@workspace/db";
import {
  GetDashboardStatsResponse,
  ListActivityQueryParams,
  ListActivityResponse,
  GetReplyTrendsResponse,
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
  const sendFailedDrafts = allDrafts.filter((d) => d.status === "send_failed").length;
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
    sendFailedDrafts,
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

router.get("/dashboard/reply-trends", async (_req, res): Promise<void> => {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const drafts = await db
    .select({ createdAt: draftsTable.createdAt, status: draftsTable.status })
    .from(draftsTable)
    .where(gte(draftsTable.createdAt, since));

  const buckets = new Map<string, { pending: number; sent: number; edited: number; discarded: number; send_failed: number }>();

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { pending: 0, sent: 0, edited: 0, discarded: 0, send_failed: 0 });
  }

  for (const draft of drafts) {
    const key = new Date(draft.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const status = draft.status as keyof typeof bucket;
    if (status in bucket) bucket[status]++;
  }

  const result = Array.from(buckets.entries()).map(([date, counts]) => ({ date, ...counts }));
  res.json(GetReplyTrendsResponse.parse(result));
});

export default router;
