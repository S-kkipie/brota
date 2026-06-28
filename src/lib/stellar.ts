import { Keypair, rpc, Networks } from "@stellar/stellar-sdk";
import crypto from 'crypto';

export const rpcServer = new rpc.Server(
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org"
);

export const networkPassphrase =
  process.env.STELLAR_NETWORK === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

const ALGORITHM = 'aes-256-gcm';

export function encryptSecret(secret: string): string {
  const keyHex = process.env.WALLET_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("WALLET_ENCRYPTION_KEY must be a 64 character hex string");
  }
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(encryptedPayload: string): string {
  const keyHex = process.env.WALLET_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("WALLET_ENCRYPTION_KEY must be a 64 character hex string");
  }
  const key = Buffer.from(keyHex, 'hex');
  
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) throw new Error("Invalid encrypted payload format");
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateWallet() {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
  };
}
