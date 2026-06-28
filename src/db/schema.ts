import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

/**
 * Source of truth for the Brota data model. After editing, run:
 *   pnpm db:generate && pnpm db:push
 */

/** A person identified by their WhatsApp number. No web login in MVP. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  whatsappNumber: text("whatsapp_number").notNull().unique(),
  displayName: text("display_name"),
  /** Hash of the user's PIN (never the PIN itself). Authorizes fund moves. */
  pinHash: text("pin_hash"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/**
 * Custodial-with-limits wallet (MVP). Per-user Stellar keypair; the secret is
 * AES-256-GCM encrypted at rest (see lib/crypto.ts). Roadmap: passkey wallet.
 */
export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  stellarPublicKey: text("stellar_public_key").notNull(),
  /** Encrypted Stellar secret seed. Never store the plaintext seed. */
  encryptedSecret: text("encrypted_secret").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** Movement log for deposits/withdrawals to the DeFindex vault. */
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'deposit' | 'withdraw'
  amount: real("amount").notNull(),
  asset: text("asset").notNull().default("USDC"),
  stellarTxHash: text("stellar_tx_hash"),
  status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'failed'
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** Cached snapshot of a user's DeFindex vault position for fast dashboard reads. */
export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  vaultId: text("vault_id").notNull(),
  shares: real("shares").notNull().default(0),
  lastValueUsdc: real("last_value_usdc").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/** Conversation log — useful for debugging the demo. */
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  direction: text("direction").notNull(), // 'in' | 'out'
  body: text("body").notNull(),
  intent: text("intent"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Message = typeof messages.$inferSelect;
