import { z } from "zod";

export const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

export const InvoiceProposalSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email().optional(),
  items: z.array(InvoiceItemSchema).min(1),
  currency: z.string().length(3).default("USD"),
  dueInDays: z.number().int().min(1).max(90),
  note: z.string().optional(),
});

export type InvoiceProposal = z.infer<typeof InvoiceProposalSchema>;
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

export const ProposeInvoiceToolSchema = z.object({
  type: z.literal("propose_invoice"),
  proposal: InvoiceProposalSchema,
});

export const AskQuestionToolSchema = z.object({
  type: z.literal("ask_question"),
  question: z.string().min(1),
});

export const ParseResultSchema = z.union([
  z.object({ type: z.literal("proposal"), proposal: InvoiceProposalSchema }),
  z.object({ type: z.literal("question"), question: z.string().min(1) }),
]);

export type ParseResult = z.infer<typeof ParseResultSchema>;
export type ProposeInvoiceTool = z.infer<typeof ProposeInvoiceToolSchema>;
export type AskQuestionTool = z.infer<typeof AskQuestionToolSchema>;