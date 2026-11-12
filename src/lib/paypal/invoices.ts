import { z } from "zod";
import { paypalFetch } from "./client";

const CreateDraftInputSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  items: z.array(
    z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
    })
  ).min(1),
  currency: z.string().length(3).default("USD"),
  dueDate: z.string().datetime({ offset: true }),
  note: z.string().optional(),
});

type CreateDraftInput = z.infer<typeof CreateDraftInputSchema>;

export function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${yyyymmdd}-${random}`;
}

export async function createDraftInvoice(input: CreateDraftInput): Promise<string> {
  const parsed = CreateDraftInputSchema.parse(input);
  const businessEmail = process.env.PAYPAL_BUSINESS_EMAIL;
  if (!businessEmail) throw new Error("Missing PAYPAL_BUSINESS_EMAIL");

  const invoiceNumber = generateInvoiceNumber();

  const lineItems = parsed.items.map((item) => ({
    name: item.description,
    quantity: String(item.quantity),
    unit_amount: {
      currency_code: parsed.currency,
      value: item.unitPrice.toFixed(2),
    },
  }));

  const payload = {
    detail: {
      invoice_number: invoiceNumber,
      currency_code: parsed.currency,
      note: parsed.note ?? "Thank you for your business.",
      payment_term: {
        term_type: "DATE",
        due_date: parsed.dueDate.split("T")[0],
      },
    },
    invoicer: {
      email_address: businessEmail,
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: parsed.clientEmail,
          name: parsed.clientName,
        },
      },
    ],
    items: lineItems,
  };

  const result = await paypalFetch<{ id: string }>("/v2/invoicing/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return result.id;
}

export async function sendInvoice(invoiceId: string): Promise<void> {
  await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    body: JSON.stringify({ send_to_recipient: true, send_to_invoicer: false }),
  });
}

export interface InvoiceDetails {
  id: string;
  status: string;
  invoice_number: string;
  detail: {
    invoice_date: string;
    payment_term: { term_type: string; due_date: string };
    currency_code: string;
    note?: string;
  };
  amount: { currency_code: string; value: string };
  primary_recipients: Array<{ billing_info: { email_address: string; name?: string } }>;
  items: Array<{ name: string; quantity: string; unit_amount: { currency_code: string; value: string } }>;
  links?: Array<{ rel: string; href: string; method: string }>;
}

export async function getInvoice(invoiceId: string): Promise<InvoiceDetails> {
  return paypalFetch<InvoiceDetails>(`/v2/invoicing/invoices/${invoiceId}`);
}

export async function sendReminder(invoiceId: string, note: string): Promise<void> {
  await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/remind`, {
    method: "POST",
    body: JSON.stringify({ subject: "Payment Reminder", note, send_to_invoicer: false }),
  });
}

export async function cancelInvoice(invoiceId: string, reason: string): Promise<void> {
  await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ subject: "Invoice Cancelled", note: reason, send_to_recipient: true, send_to_invoicer: false }),
  });
}