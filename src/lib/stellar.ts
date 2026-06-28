import { Keypair, rpc, Networks } from "@stellar/stellar-sdk";

export const rpcServer = new rpc.Server(
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
);

export const networkPassphrase =
  process.env.STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

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
