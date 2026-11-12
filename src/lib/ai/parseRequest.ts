import { GoogleGenerativeAI, SchemaType, FunctionCallingMode } from "@google/generative-ai";
import { db } from "@/lib/db";
import {
  ProposeInvoiceToolSchema,
  AskQuestionToolSchema,
  type InvoiceProposal,
  type ParseResult,
} from "./schemas";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an invoice parsing agent. Extract a structured invoice proposal from the user's free-text request.

Tools:
- propose_invoice: Call when you have ALL required info (client name, at least one item with description/quantity/price, due date).
- ask_question: Call ONCE with a short clarifying question if ANY of these are missing:
  * Client email (unless you can match client name to known clients)
  * What the invoice is for (item description)
  * Amount/price
  * Due date

Rules:
- NEVER guess or invent emails, amounts, or descriptions.
- Use knownClients (name -> email) to fill email when the name matches.
- dueInDays: convert "due in 15 days", "net 30", etc. to integer days.
- currency: default USD unless specified.
- If user says "bill X $Y for Z", that's a complete request.

Known clients: {knownClients}`;

const proposeInvoiceDeclaration = {
  name: "propose_invoice",
  description: "Propose a complete invoice when all required info is available",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      type: { type: SchemaType.STRING, format: "enum", enum: ["propose_invoice"] },
      proposal: {
        type: SchemaType.OBJECT,
        properties: {
          clientName: { type: SchemaType.STRING },
          clientEmail: { type: SchemaType.STRING },
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                description: { type: SchemaType.STRING },
                quantity: { type: SchemaType.INTEGER },
                unitPrice: { type: SchemaType.NUMBER },
              },
              required: ["description", "quantity", "unitPrice"],
            },
            minItems: 1,
          },
          currency: { type: SchemaType.STRING },
          dueInDays: { type: SchemaType.INTEGER },
          note: { type: SchemaType.STRING },
        },
        required: ["clientName", "items", "dueInDays"],
      },
    },
    required: ["type", "proposal"],
  },
};

const askQuestionDeclaration = {
  name: "ask_question",
  description: "Ask a single clarifying question when info is missing",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      type: { type: SchemaType.STRING, format: "enum", enum: ["ask_question"] },
      question: { type: SchemaType.STRING },
    },
    required: ["type", "question"],
  },
};

export async function parseInvoiceRequest(
  userText: string,
  knownClients: Record<string, string>
): Promise<ParseResult> {
  const knownClientsStr = JSON.stringify(knownClients, null, 2);

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ functionDeclarations: [proposeInvoiceDeclaration, askQuestionDeclaration] as any }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  });

  async function callGemini(retry = false): Promise<ParseResult> {
    let prompt = SYSTEM_PROMPT.replace("{knownClients}", knownClientsStr) + "\n\nUser request: " + userText;

    if (retry) {
      prompt += "\n\nMy previous tool call had invalid parameters. Please try again with valid parameters matching the tool schema exactly.";
    }

    const result = await model.generateContent(prompt);
    const response = result.response;
    const functionCalls = response.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      return { type: "question", question: "Could you rephrase your request?" };
    }

    const functionCall = functionCalls[0];

    if (functionCall.name === "propose_invoice") {
      const parsed = ProposeInvoiceToolSchema.safeParse({ type: "propose_invoice", proposal: functionCall.args });
      if (!parsed.success) {
        if (!retry) return callGemini(true);
        return { type: "question", question: "Could you rephrase your request with all details?" };
      }
      return { type: "proposal", proposal: parsed.data.proposal };
    }

    if (functionCall.name === "ask_question") {
      const args = functionCall.args as { question?: string };
      const parsed = AskQuestionToolSchema.safeParse({ type: "ask_question", question: args.question ?? "" });
      if (!parsed.success) {
        if (!retry) return callGemini(true);
        return { type: "question", question: "Could you rephrase your request?" };
      }
      return { type: "question", question: parsed.data.question };
    }

    return { type: "question", question: "Could you rephrase your request?" };
  }

  return callGemini();
}

export async function enforcePolicy(proposal: InvoiceProposal): Promise<ParseResult> {
  const policy = await db.policy.findFirst();
  if (!policy) return { type: "proposal", proposal };

  const total = proposal.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (total > Number(policy.maxInvoiceAmount)) {
    return {
      type: "question",
      question: `Invoice total $${total.toFixed(2)} exceeds policy limit $${Number(policy.maxInvoiceAmount).toFixed(2)}. Confirm to proceed?`,
    };
  }
  return { type: "proposal", proposal };
}