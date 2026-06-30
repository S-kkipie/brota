import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pendingActions } from "@/db/schema";
import type { PendingAction } from "@/db/schema";

export type PendingStep = "AWAIT_NEW_PIN" | "CONFIRM_NEW_PIN" | "AWAIT_PIN";
export type PendingKind = "deposit" | "withdraw";

type SetPendingInput = {
  step: PendingStep;
  kind?: PendingKind;
  amountUsdc?: number | null;
  tempPinHash?: string | null;
  attempts?: number;
};

export function getPending(userId: string): Promise<PendingAction | undefined> {
  return db.query.pendingActions.findFirst({
    where: eq(pendingActions.userId, userId),
  });
}

/** Upsert the single pending row for a user (one in-flight flow at a time). */
export async function setPending(
  userId: string,
  input: SetPendingInput,
): Promise<void> {
  const values = {
    step: input.step,
    kind: input.kind ?? "deposit",
    amountUsdc: input.amountUsdc ?? null,
    tempPinHash: input.tempPinHash ?? null,
    attempts: input.attempts ?? 0,
  };
  await db
    .insert(pendingActions)
    .values({ id: `pnd_${randomUUID()}`, userId, createdAt: new Date(), ...values })
    .onConflictDoUpdate({ target: pendingActions.userId, set: values });
}

export async function clearPending(userId: string): Promise<void> {
  await db.delete(pendingActions).where(eq(pendingActions.userId, userId));
}
