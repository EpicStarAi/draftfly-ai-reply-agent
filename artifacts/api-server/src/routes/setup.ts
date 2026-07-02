import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, setupItemsTable } from "@workspace/db";
import {
  ListSetupItemsResponse,
  UpdateSetupItemParams,
  UpdateSetupItemBody,
  UpdateSetupItemResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/setup", async (_req, res): Promise<void> => {
  const items = await db.select().from(setupItemsTable).orderBy(setupItemsTable.id);
  res.json(ListSetupItemsResponse.parse(items));
});

router.patch("/setup/:id", async (req, res): Promise<void> => {
  const params = UpdateSetupItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateSetupItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {
    isCompleted: body.data.isCompleted,
    completedAt: body.data.isCompleted ? new Date() : null,
  };

  const [item] = await db
    .update(setupItemsTable)
    .set(updateData)
    .where(eq(setupItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Setup item not found" });
    return;
  }
  res.json(UpdateSetupItemResponse.parse(item));
});

export default router;
