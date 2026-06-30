import { Keypair, rpc, Horizon, Networks } from "@stellar/stellar-sdk";

export const rpcServer = new rpc.Server(
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
);

/** Classic Horizon server — used for account existence checks and trustlines. */
export const horizonServer = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org",
);

export const networkPassphrase =
  process.env.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

export const isTestnet = networkPassphrase !== Networks.PUBLIC;

/**
 * New custodial-with-limits keypair. The caller must encrypt `secret` at rest
 * with `encryptSecret` from lib/crypto.ts before persisting — never store the
 * plaintext seed.
 */
export function generateWallet() {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
  };
}
