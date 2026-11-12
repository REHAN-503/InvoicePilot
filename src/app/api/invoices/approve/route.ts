import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAgent } from "@/lib/log";
import {
  createDraftInvoice,
  sendInvoice,
  getInvoice,
  generateInvoiceNumber,
} from "@/lib/paypal/invoices";
import { InvoiceProposalSchema } from "@/lib/ai/schemas";
import { PayPalError } from "@/lib/paypal/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InvoiceProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid proposal", details: parsed.error.flatten() }, { status: 400 });
    }

    const proposal = parsed.data;

    if (!proposal.clientEmail) {
      return NextResponse.json({ error: "Client email is required" }, { status: 400 });
    }

    let client = await db.client.findUnique({ where: { email: proposal.clientEmail } });
    if (!client) {
      client = await db.client.create({
        data: { name: proposal.clientName, email: proposal.clientEmail, avgDaysLate: 0 },
      });
    } else if (client.name !== proposal.clientName) {
      client = await db.client.update({
        where: { id: client.id },
        data: { name: proposal.clientName },
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + proposal.dueInDays);

    let invoiceId: string;
    try {
      invoiceId = await createDraftInvoice({
        clientName: proposal.clientName,
        clientEmail: client.email,
        items: proposal.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
        currency: proposal.currency,
        dueDate: dueDate.toISOString(),
        note: proposal.note,
      });

      await sendInvoice(invoiceId);

      const paypalInvoice = await getInvoice(invoiceId);
      const payLink = paypalInvoice.links?.find((l) => l.rel === "payer-action")?.href ?? null;

      const amount = proposal.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const invoiceNumber = generateInvoiceNumber();

      const savedInvoice = await db.invoice.create({
        data: {
          paypalInvoiceId: invoiceId,
          invoiceNumber,
          clientId: client.id,
          amount,
          currency: proposal.currency,
          status: "SENT",
          dueDate,
          payLink,
          note: proposal.note,
          lineItems: {
            create: proposal.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
          },
        },
        include: { lineItems: true, client: true },
      });

      await logAgent(
        "invoice_sent",
        "Created and sent invoice from approved proposal",
        { invoiceId, clientId: client.id, invoiceNumber },
        "success"
      );

      return NextResponse.json(savedInvoice);
    } catch (paypalError) {
      if (paypalError instanceof PayPalError) {
        await logAgent(
          "invoice_sent",
          "PayPal error while creating/sending invoice",
          { error: paypalError.message, status: paypalError.status, body: paypalError.body },
          "error"
        );
        return NextResponse.json(
          { error: `PayPal error: ${paypalError.message}` },
          { status: paypalError.status || 500 }
        );
      }
      throw paypalError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgent("invoice_sent", "Failed to approve invoice", { error: message }, "error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}