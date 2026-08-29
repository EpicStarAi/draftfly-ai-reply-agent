import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireOperator } from "../middleware/requireOperator";
import { operatorBillingTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

router.get("/billing/plans", async (_req, res) => {
  const stripe = await getUncachableStripeClient();

  const [products, prices] = await Promise.all([
    stripe.products.list({ active: true }),
    stripe.prices.list({ active: true, expand: ["data.product"] }),
  ]);

  const plans = products.data
    .filter((p) => p.metadata?.plan_key)
    .sort((a, b) => Number(a.metadata.order ?? 99) - Number(b.metadata.order ?? 99))
    .map((product) => {
      const productPrices = prices.data.filter(
        (p) => (p.product as string) === product.id && p.type === "recurring",
      );
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        planKey: product.metadata.plan_key,
        maxClients: product.metadata.max_clients ?? "unlimited",
        maxReplies: product.metadata.max_replies ?? "unlimited",
        prices: productPrices.map((p) => ({
          id: p.id,
          amount: p.unit_amount,
          currency: p.currency,
          interval: p.recurring?.interval,
        })),
      };
    });

  res.json({ plans });
});

router.get("/billing/subscription", requireOperator, async (_req, res) => {
  const [billing] = await db.select().from(operatorBillingTable).limit(1);

  if (!billing?.stripeSubscriptionId) {
    res.json({ subscription: null, billing: billing ?? null });
    return;
  }

  const result = await db.execute(
    sql`SELECT * FROM stripe.subscriptions WHERE id = ${billing.stripeSubscriptionId}`,
  );

  res.json({ subscription: result.rows[0] ?? null, billing });
});

router.post("/billing/checkout", requireOperator, async (req, res) => {
  const { priceId } = req.body as { priceId: string };
  if (!priceId) { res.status(400).json({ error: "priceId is required" }); return; }

  const stripe = await getUncachableStripeClient();

  let [billing] = await db.select().from(operatorBillingTable).limit(1);

  let customerId = billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { source: "draftfly-dashboard" },
    });
    const rows = await db
      .insert(operatorBillingTable)
      .values({ stripeCustomerId: customer.id })
      .returning();
    billing = rows[0];
    customerId = customer.id;
  }

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${baseUrl}/app?billing=success`,
    cancel_url: `${baseUrl}/app?billing=cancel`,
  });

  res.json({ url: session.url });
});

router.post("/billing/portal", requireOperator, async (_req, res) => {
  const [billing] = await db.select().from(operatorBillingTable).limit(1);

  if (!billing?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found. Subscribe first." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: `${baseUrl}/app`,
  });

  res.json({ url: session.url });
});

export default router;
