import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

function verifyWebhookSignature(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(hmacHeader)
  );
}

export async function POST(req: NextRequest) {
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const hmacHeader = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const shopifyOrderId = req.headers.get("x-shopify-order-id") ?? "";

  const rawBody = await req.text();

  // Verify signature (skip in dev if secret not set)
  if (process.env.SHOPIFY_WEBHOOK_SECRET) {
    if (!verifyWebhookSignature(rawBody, hmacHeader)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Idempotency: skip if already processed
  const alreadyProcessed = await prisma.processedWebhook.findUnique({
    where: { shopifyOrderId: `${shopifyOrderId}:${topic}` },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (topic === "orders/paid") {
      await handleOrderPaid(payload);
    } else if (topic === "orders/cancelled") {
      await handleOrderCancelled(payload);
    }
    // Other topics (orders/created, etc.) are silently acknowledged

    // Mark as processed
    await prisma.processedWebhook.create({
      data: {
        shopifyOrderId: `${shopifyOrderId}:${topic}`,
        topic,
      },
    });
  } catch (err: any) {
    console.error(`[Webhook] Error processing ${topic}:`, err.message);
    // Return 200 to prevent Shopify retry storms; log internally
    return NextResponse.json({ ok: false, error: err.message });
  }

  return NextResponse.json({ ok: true });
}

async function handleOrderPaid(payload: any) {
  const shopifyOrderId = String(payload.id);

  // Check if a Sales Record is already linked
  const existingRecord = await prisma.salesRecord.findUnique({
    where: { shopifyOrderId },
  });
  if (existingRecord) return; // Already linked, nothing to do

  // Try to match by order name / note attributes
  const orderName = payload.name as string; // e.g. "#1234"
  const orderNo = orderName?.replace("#", "");

  if (orderNo) {
    const record = await prisma.salesRecord.findFirst({
      where: { invoiceNo: orderNo, status: { in: ["quote", "deposit_paid"] } },
    });
    if (record) {
      await prisma.salesRecord.update({
        where: { id: record.id },
        data: { shopifyOrderId },
      });
    }
  }
  // If no match, webhook is logged via ProcessedWebhook; staff can link manually
}

async function handleOrderCancelled(payload: any) {
  const shopifyOrderId = String(payload.id);

  const record = await prisma.salesRecord.findUnique({
    where: { shopifyOrderId },
  });

  if (!record) return;
  if (["completed", "cancelled"].includes(record.status)) return;

  // Release reservations
  await prisma.generatedMovement.updateMany({
    where: { salesRecordId: record.id, reservedQty: { gt: 0 } },
    data: { reservedQty: 0 },
  });

  await prisma.salesRecord.update({
    where: { id: record.id },
    data: { status: "cancelled", version: { increment: 1 } },
  });
}
