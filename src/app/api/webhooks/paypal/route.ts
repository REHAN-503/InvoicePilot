import { NextRequest, NextResponse } from "next/server";
import { db, InvoiceStatus } from "@/lib/db";
import { logAgent } from "@/lib/log";
import { getAccessToken } from "@/lib/paypal/client";

async function verifyWebhookSignature(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const skipVerify = process.env.WEBHOOK_SKIP_VERIFY === "true";
  if (skipVerify) return true;

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const transmissionSig = headers.get("paypal-transmission-sig");

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !webhookId || !transmissionSig) {
    return false;
  }

  const token = await getAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL!;

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });

  const data = await response.json().catch(() => ({}));
  return data.verification_status === "SUCCESS";
}

function mapPayPalStatus(status: string): InvoiceStatus {
  switch (status.toUpperCase()) {
    case "PAID":
      return InvoiceStatus.PAID;
    case "CANCELLED":
      return InvoiceStatus.CANCELLED;
    case "REFUNDED":
      return InvoiceStatus.REFUNDED;
    case "SENT":
    case "DRAFT":
      return InvoiceStatus.SENT;
    default:
      return InvoiceStatus.SENT;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    const verified = await verifyWebhookSignature(rawBody, req.headers);
    if (!verified) {
      await logAgent("webhook_verify", "Webhook signature verification failed", { headers: Object.fromEntries(req.headers) }, "error");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type;
    const resource = event.resource;

    if (!eventType || !resource) {
      return NextResponse.json({ received: true });
    }

    const paypalInvoiceId = resource.id;
    if (!paypalInvoiceId) {
      return NextResponse.json({ received: true });
    }

    const invoice = await db.invoice.findUnique({
      where: { paypalInvoiceId },
      include: { client: true },
    });

    if (!invoice) {
      await logAgent("webhook_event", "Invoice not found for webhook", { paypalInvoiceId, eventType }, "error");
      return NextResponse.json({ received: true });
    }

    const newStatus = mapPayPalStatus(resource.status);
    const updateData: { status: InvoiceStatus; paidAt?: Date } = { status: newStatus };

    if (newStatus === InvoiceStatus.PAID && !invoice.paidAt) {
      const paidAt = new Date();
      updateData.paidAt = paidAt;

      const daysLate = Math.floor((paidAt.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLate > 0 && invoice.client) {
        const allPaidInvoices = await db.invoice.findMany({
          where: { clientId: invoice.clientId, status: InvoiceStatus.PAID },
          select: { dueDate: true, paidAt: true },
        });
        const lateDays = allPaidInvoices
          .filter((i) => i.paidAt)
          .reduce((sum, i) => sum + Math.floor((i.paidAt!.getTime() - i.dueDate.getTime()) / (1000 * 60 * 60 * 24)), 0);
        const avgDaysLate = lateDays / allPaidInvoices.length;
        await db.client.update({
          where: { id: invoice.clientId },
          data: { avgDaysLate: Math.round(avgDaysLate * 100) / 100 },
        });
      }
    }

    await db.invoice.update({
      where: { id: invoice.id },
      data: updateData,
    });

    await logAgent("webhook_event", `Processed webhook: ${eventType}`, { paypalInvoiceId, eventType, newStatus, invoiceId: invoice.id }, "success");

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgent("webhook_error", "Webhook processing failed", { error: message }, "error");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}