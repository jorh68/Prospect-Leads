import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import type { ActivityType } from "./domain/constants";

type Client = PrismaClient | Prisma.TransactionClient;

export interface ActivityInput {
  type: ActivityType;
  /** Spanish, user-facing sentence, e.g. "Estado cambiado a Contactada" */
  message: string;
  companyId?: string | null;
  searchId?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Append an entry to the activity log. Pass `tx` inside a transaction. */
export async function logActivity(input: ActivityInput, tx: Client = db) {
  return tx.activity.create({
    data: {
      type: input.type,
      message: input.message,
      companyId: input.companyId ?? null,
      searchId: input.searchId ?? null,
      meta: input.meta,
    },
  });
}
