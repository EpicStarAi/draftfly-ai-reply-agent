import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, draftsTable, campaignsTable, activityTable } from "@workspace/db";
import {
  ListDraftsQueryParams,
  ListDraftsResponse,
  ListPendingDraftsResponse,
  GetDraftParams,
  GetDraftResponse,
  ApplyDraftActionParams,
  ApplyDraftActionBody,
  ApplyDraftActionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/drafts/pending", async (_req, res): Promise<void> => {
  const drafts = await db
    .select()
    .from(draftsTable)
    .where(eq(draftsTable.status, "pending"))
    .orderBy(draftsTable.createdAt);
  res.json(ListPendingDraftsResponse.parse(drafts));
});

router.get("/drafts", async (req, res): Promise<void> => {
  const query = ListDraftsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];
  if (query.data.status) conditions.push(eq(draftsTable.status, query.data.status as "pending" | "sent" | "edited" | "discarded"));
  if (query.data.clientId != null) conditions.push(eq(draftsTable.clientId, query.data.clientId));

  const drafts = conditions.length > 0
    ? await db.select().from(draftsTable).where(and(...conditions)).orderBy(draftsTable.createdAt)
    : await db.select().from(draftsTable).orderBy(draftsTable.createdAt);

  res.json(ListDraftsResponse.parse(drafts));
});

router.get("/drafts/:id", async (req, res): Promise<void> => {
  const params = GetDraftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [draft] = await db.select().from(draftsTable).where(eq(draftsTable.id, params.data.id));
  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }
  res.json(GetDraftResponse.parse(draft));
});

router.patch("/drafts/:id/action", async (req, res): Promise<void> => {
  const params = ApplyDraftActionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ApplyDraftActionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { action, editedText } = body.data;
  const newStatus = action === "send" ? "sent" : action === "edit" ? "edited" : "discarded";

  const updateData: Record<string, unknown> = {
    status: newStatus,
    actionedAt: new Date(),
  };
  if (action === "edit" && editedText) {
    updateData.editedReplyText = editedText;
  }

  const [draft] = await db
    .update(draftsTable)
    .set(updateData)
    .where(eq(draftsTable.id, params.data.id))
    .returning();

  if (!draft) {
    res.status(404).json({ error: "Draft not found" });
    return;
  }

  // Get campaign name for activity log
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, draft.campaignId));

  const activityTypeMap = { sent: "draft_sent", edited: "draft_edited", discarded: "draft_discarded" } as const;
  await db.insert(activityTable).values({
    type: activityTypeMap[newStatus as keyof typeof activityTypeMap],
    description: `Reply to ${draft.prospectName} (${draft.prospectEmail}) ${newStatus}`,
    clientId: draft.clientId,
    campaignId: draft.campaignId,
    draftId: draft.id,
    campaignName: campaign?.name ?? null,
  });

  res.json(ApplyDraftActionResponse.parse(draft));
});

export default router;
