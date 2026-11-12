import { NextRequest, NextResponse } from "next/server";
import { db, InvoiceStatus } from "@/lib/db";
import { logAgent } from "@/lib/log";
import { getInvoice } from "@/lib/paypal/invoices";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({
      where: { id },
    });

    if (!invoice || !invoice.paypalInvoiceId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const paypalInvoice = await getInvoice(invoice.paypalInvoiceId);

    const status = paypalInvoice.status.toUpperCase();
    let newStatus: InvoiceStatus = InvoiceStatus.SENT;
    if (status === "PAID") newStatus = InvoiceStatus.PAID;
    else if (status === "CANCELLED") newStatus = InvoiceStatus.CANCELLED;
    else if (status === "REFUNDED") newStatus = InvoiceStatus.REFUNDED;
    else if (status === "DRAFT") newStatus = InvoiceStatus.DRAFT;

    const updateData: { status: InvoiceStatus; paidAt?: Date; payLink?: string | null } = { status: newStatus };

    if (newStatus === InvoiceStatus.PAID && !invoice.paidAt) {
      updateData.paidAt = new Date();
    }

    const payLink = paypalInvoice.links?.find((l) => l.rel === "payer-action")?.href ?? null;
    if (payLink) updateData.payLink = payLink;

    const updated = await db.invoice.update({
      where: { id },
      data: updateData,
      include: { client: true, lineItems: true },
    });

    await logAgent("invoice_sync", "Manual sync from PayPal", { invoiceId: id, paypalStatus: status, newStatus }, "success");

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgent("invoice_sync", "Sync failed", { error: message }, "error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}