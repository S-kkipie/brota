import { logger } from "@/lib/log";

const log = logger("defindex");

/**
 * DeFindex vault integration — THE core SCF Integration Track deliverable.
 *
 * STATUS: stub. The npm package + testnet vault address must be verified on
 * Day 1 (risk #1 in the spec) before wiring real deposit/withdraw/read. These
 * functions throw on purpose so nothing silently pretends to work.
 *
 * TODO(D1): install the real DeFindex SDK, set DEFINDEX_VAULT_ID, implement.
 */

export interface VaultPosition {
  vaultId: string;
  shares: string;
  valueUsdc: string;
}

export async function deposit(_args: {
  publicKey: string;
  encryptedSecret: string;
  amountUsdc: string;
}): Promise<{ txHash: string }> {
  log.error("DeFindex deposit not implemented");
  throw new Error("DeFindex deposit not implemented — see lib/defindex.ts TODO(D1)");
}

export async function withdraw(_args: {
  publicKey: string;
  encryptedSecret: string;
  amountUsdc: string;
}): Promise<{ txHash: string }> {
  log.error("DeFindex withdraw not implemented");
  throw new Error("DeFindex withdraw not implemented — see lib/defindex.ts TODO(D1)");
}

export async function readPosition(_publicKey: string): Promise<VaultPosition> {
  log.error("DeFindex readPosition not implemented");
  throw new Error("DeFindex readPosition not implemented — see lib/defindex.ts TODO(D1)");
}
