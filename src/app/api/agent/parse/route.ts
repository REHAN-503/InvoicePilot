import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAgent } from "@/lib/log";
import { parseInvoiceRequest, enforcePolicy } from "@/lib/ai/parseRequest";
import { ParseResultSchema } from "@/lib/ai/schemas";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const clients = await db.client.findMany({ select: { name: true, email: true } });
    const knownClients: Record<string, string> = {};
    for (const c of clients) knownClients[c.name] = c.email;

    let result = await parseInvoiceRequest(text, knownClients);

    if (result.type === "proposal") {
      result = await enforcePolicy(result.proposal);
    }

    const validated = ParseResultSchema.safeParse(result);
    if (!validated.success) {
      await logAgent("parse_invoice", "Validation failed", { text, result }, "error");
      return NextResponse.json({ type: "question", question: "Could you rephrase your request?" });
    }

    await logAgent("parse_invoice", "Parsed user request", { text, result: validated.data }, "success");

    return NextResponse.json(validated.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logAgent("parse_invoice", "Error parsing request", { error: message }, "error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}