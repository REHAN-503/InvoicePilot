import { NextResponse } from "next/server";
import { createDraftInvoice, sendInvoice, getInvoice } from "@/lib/paypal/invoices";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  const buyerEmail = process.env.PAYPAL_TEST_BUYER_EMAIL;
  if (!buyerEmail) {
    return NextResponse.json({ error: "Missing PAYPAL_TEST_BUYER_EMAIL" }, { status: 500 });
  }

  try {
    const invoiceId = await createDraftInvoice({
      clientName: "Test Buyer",
      clientEmail: buyerEmail,
      items: [
        { description: "Test Item", quantity: 1, unitPrice: 9.99 },
      ],
      currency: "USD",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      note: "Test invoice from InvoicePilot dev endpoint",
    });

    await sendInvoice(invoiceId);
    const invoice = await getInvoice(invoiceId);

    return NextResponse.json({ invoiceId, invoiceNumber: invoice.invoice_number, status: invoice.status, payLink: invoice.links?.find((l) => l.rel === "payer-action")?.href ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}