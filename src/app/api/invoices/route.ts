import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAgent } from "@/lib/log";
import { createDraftInvoice, sendInvoice, generateInvoiceNumber } from "@/lib/paypal/invoices";
import { InvoiceProposalSchema } from "@/lib/ai/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InvoiceProposalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid proposal", details: parsed.error.flatten() }, { status: 400 });
    }

    const proposal = parsed.data;

    let client = await db.client.findUnique({ where: { email: proposal.clientEmail ?? "" } });
    if (!client && proposal.clientEmail) {
      client = await db.client.create({
        data: { name: proposal.clientName, email: proposal.clientEmail, avgDaysLate: 0 },
      });
    } else if (!client) {
      client = await db.client.create({
        data: { name: proposal.clientName, email: `${proposal.clientName.toLowerCase().replace(/\s+/g, ".")}@example.com`, avgDaysLate: 0 },
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + proposal.dueInDays);

    const invoiceId = await createDraftInvoice({
      clientName: proposal.clientName,
      clientEmail: client.email,
      items: proposal.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
      currency: proposal.currency,
      dueDate: dueDate.toISOString(),
      note: proposal.note,
    });

    await sendInvoice(invoiceId);

    const invoiceNumber = generateInvoiceNumber();
    await db.invoice.create({
      data: {
        paypalInvoiceId: invoiceId,
        invoiceNumber,
        clientId: client.id,
        amount: proposal.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
        currency: proposal.currency,
        status: "SENT",
        dueDate,
        note: proposal.note,
        lineItems: {
          create: proposal.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
        },
      },
    });

    await logAgent("create_invoice", "Created and sent invoice from proposal", { invoiceId, clientId: client.id }, "success");

    return NextResponse.json({ invoiceId, invoiceNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgent("create_invoice", "Failed to create invoice", { error: message }, "error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}