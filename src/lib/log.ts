import { db } from "./db";
import { Prisma } from "@prisma/client";

export async function logAgent(
  action: string,
  reasoning: string,
  payload: unknown,
  status: "success" | "error" | "pending"
) {
  try {
    await db.agentLog.create({
      data: {
        action,
        reasoning,
        payload: payload as Prisma.InputJsonValue,
        status,
      },
    });
  } catch (error) {
    console.error("Failed to log agent action:", error);
  }
}