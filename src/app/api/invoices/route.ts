import { NextResponse } from "next/server";
import { db, InvoiceStatus } from "@/lib/db";

export async function GET() {
  const invoices = await db.invoice.findMany({
    include: { client: true, lineItems: true },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const updatedInvoices = await Promise.all(
    invoices.map(async (inv) => {
      let status: InvoiceStatus = inv.status;
      if (inv.status === InvoiceStatus.SENT && inv.dueDate < now) {
        status = InvoiceStatus.OVERDUE;
        await db.invoice.update({
          where: { id: inv.id },
          data: { status: InvoiceStatus.OVERDUE },
        });
      }
      return { ...inv, status };
    })
  );

  return NextResponse.json(updatedInvoices);
}