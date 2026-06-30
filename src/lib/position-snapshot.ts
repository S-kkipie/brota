import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { positions } from "@/db/schema";

/**
 * Upsert the cached DeFindex position snapshot for a user/vault. Shared by the
 * deposit and withdraw flows so both refresh the fast-read dashboard value the
 * same way after an on-chain move.
 */
export async function upsertPosition(
  userId: string,
  vaultId: string,
  shares: number,
  valueUsdc: number,
): Promise<void> {
  const existing = await db.query.positions.findFirst({
    where: and(eq(positions.userId, userId), eq(positions.vaultId, vaultId)),
  });
  if (existing) {
    await db
      .update(positions)
      .set({ shares, lastValueUsdc: valueUsdc, updatedAt: new Date() })
      .where(eq(positions.id, existing.id));
    return;
  }
  await db.insert(positions).values({
    id: `pos_${randomUUID()}`,
    userId,
    vaultId,
    shares,
    lastValueUsdc: valueUsdc,
    updatedAt: new Date(),
  });
}
