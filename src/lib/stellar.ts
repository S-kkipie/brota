import { Keypair, Networks } from "@stellar/stellar-sdk";
import { STELLAR_NETWORK, STELLAR_RPC_URL, STELLAR_HORIZON_URL } from "@/lib/env";
import { encryptSecret } from "@/lib/crypto";

/**
 * Stellar config + custodial keypair helpers. TESTNET only until explicitly
 * switched (see AGENTS.md). The secret seed is encrypted before it ever
 * touches the database.
 */
export const networkPassphrase =
  STELLAR_NETWORK === "public" ? Networks.PUBLIC : Networks.TESTNET;

export const rpcUrl = STELLAR_RPC_URL;
export const horizonUrl = STELLAR_HORIZON_URL;

export interface NewWallet {
  publicKey: string;
  encryptedSecret: string;
}

/** Generate a fresh keypair and return the public key + encrypted secret. */
export function createWallet(): NewWallet {
  const kp = Keypair.random();
  return {
    publicKey: kp.publicKey(),
    encryptedSecret: encryptSecret(kp.secret()),
  };
}
