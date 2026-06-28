import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { DefindexSDK, SupportedNetworks } from "@defindex/sdk";
import { rpcServer, networkPassphrase, isTestnet } from "@/lib/stellar";
import { log } from "@/lib/log";

/**
 * DeFindex vault integration. Pattern (recommended by DeFindex for servers):
 * the hosted REST API (`@defindex/sdk`) BUILDS an unsigned, already-simulated
 * Soroban transaction (XDR); our custodial server SIGNS it with the user's
 * keypair and submits it via Soroban RPC. The API never holds funds or keys.
 *
 * Amounts are USDC with 7 decimals on Stellar (1 USDC = 10_000_000 stroops).
 *
 * Without DEFINDEX_API_KEY set, every call falls back to a clearly-logged mock
 * so local dev / the demo keeps working. Set the key (+ a funded testnet wallet
 * holding the vault's USDC) to exercise the real on-chain flow.
 */

const NETWORK = isTestnet ? SupportedNetworks.TESTNET : SupportedNetworks.MAINNET;
const USDC_DECIMALS = 7;
const toStroops = (usdc: number): number => Math.round(usdc * 10 ** USDC_DECIMALS);
const fromStroops = (stroops: number): number => stroops / 10 ** USDC_DECIMALS;

let cachedSdk: DefindexSDK | null = null;
function sdk(): DefindexSDK | null {
  const apiKey = process.env.DEFINDEX_API_KEY;
  if (!apiKey) return null;
  if (!cachedSdk) cachedSdk = new DefindexSDK({ apiKey, defaultNetwork: NETWORK });
  return cachedSdk;
}

export type DepositResult = { txHash: string; sharesReceived: number };
export type VaultPosition = { shares: number; valueUsdc: number };

/**
 * Sign an API-built Soroban transaction with the user's custodial key and
 * submit it. The XDR from the DeFindex API is ALREADY simulated and assembled
 * (footprint + auth baked in) — we must NOT re-simulate it, only sign + submit.
 * The custodial account is both the tx source and the contract `caller`, so a
 * plain source-account signature satisfies the vault's require_auth.
 */
async function signAndSubmit(unsignedXdr: string, kp: Keypair): Promise<string> {
  const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
  tx.sign(kp);

  const sent = await rpcServer.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new Error(`DeFindex submit failed: ${JSON.stringify(sent.errorResult)}`);
  }

  let result = await rpcServer.getTransaction(sent.hash);
  for (let i = 0; result.status === "NOT_FOUND" && i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    result = await rpcServer.getTransaction(sent.hash);
  }
  if (result.status !== "SUCCESS") {
    throw new Error(`DeFindex tx ${sent.hash} did not confirm: ${result.status}`);
  }
  return sent.hash;
}

export async function depositToVault(
  userKeypair: Keypair,
  vaultId: string,
  amountUsdc: number,
): Promise<DepositResult> {
  const client = sdk();
  if (!client) {
    log.warn("DEFINDEX_API_KEY unset — mock deposit (dev only)", { vaultId, amountUsdc });
    return { txHash: `mock_deposit_${vaultId.slice(0, 6)}`, sharesReceived: amountUsdc };
  }

  const { xdr } = await client.depositToVault(vaultId, {
    caller: userKeypair.publicKey(),
    amounts: [toStroops(amountUsdc)],
    invest: true,
    slippageBps: 50,
  });
  if (!xdr) throw new Error("DeFindex deposit returned no XDR");

  const txHash = await signAndSubmit(xdr, userKeypair);
  log.info("deposit confirmed", { txHash, vaultId, amountUsdc });

  const position = await getVaultPosition(userKeypair.publicKey(), vaultId);
  return { txHash, sharesReceived: position.shares };
}

export async function withdrawFromVault(
  userKeypair: Keypair,
  vaultId: string,
  amountUsdc: number,
): Promise<{ txHash: string }> {
  const client = sdk();
  if (!client) {
    log.warn("DEFINDEX_API_KEY unset — mock withdraw (dev only)", { vaultId, amountUsdc });
    return { txHash: `mock_withdraw_${vaultId.slice(0, 6)}` };
  }

  const { xdr } = await client.withdrawFromVault(vaultId, {
    caller: userKeypair.publicKey(),
    amounts: [toStroops(amountUsdc)],
    slippageBps: 50,
  });
  if (!xdr) throw new Error("DeFindex withdraw returned no XDR");

  const txHash = await signAndSubmit(xdr, userKeypair);
  log.info("withdraw confirmed", { txHash, vaultId, amountUsdc });
  return { txHash };
}

export async function getVaultPosition(
  userPublicKey: string,
  vaultId: string,
): Promise<VaultPosition> {
  const client = sdk();
  if (!client) {
    log.warn("DEFINDEX_API_KEY unset — mock position (dev only)", { vaultId });
    return { shares: 0, valueUsdc: 0 };
  }

  const balance = await client.getVaultBalance(vaultId, userPublicKey);
  const underlying = balance.underlyingBalance.reduce((sum, n) => sum + n, 0);
  return { shares: balance.dfTokens, valueUsdc: fromStroops(underlying) };
}
