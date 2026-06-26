import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * Source of truth for the Brota data model. After editing, run:
 *   pnpm db:generate && pnpm db:push
 */

export const txTypeEnum = pgEnum("tx_type", ["deposit", "withdraw"]);
export const txStatusEnum = pgEnum("tx_status", [
  "pending",
  "confirmed",
  "failed",
]);
export const msgDirectionEnum = pgEnum("msg_direction", ["in", "out"]);

/** A person identified by their WhatsApp number. No web login in MVP. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  whatsappNumber: varchar("whatsapp_number", { length: 32 }).notNull().unique(),
  displayName: text("display_name"),
  /** Hash of the user's PIN (never the PIN itself). Authorizes fund moves. */
  pinHash: text("pin_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Custodial-with-limits wallet (MVP). Per-user Stellar keypair; the secret is
 * AES-256-GCM encrypted at rest (see lib/crypto.ts). Roadmap: passkey wallet.
 */
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  stellarPublicKey: varchar("stellar_public_key", { length: 56 }).notNull(),
  /** Encrypted Stellar secret seed. Never store the plaintext seed. */
  encryptedSecret: text("encrypted_secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Movement log for deposits/withdrawals to the DeFindex vault. */
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  type: txTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 20, scale: 7 }).notNull(),
  asset: varchar("asset", { length: 16 }).notNull().default("USDC"),
  stellarTxHash: varchar("stellar_tx_hash", { length: 64 }),
  status: txStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Cached snapshot of a user's DeFindex vault position for fast dashboard reads. */
export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  vaultId: varchar("vault_id", { length: 56 }).notNull(),
  shares: numeric("shares", { precision: 30, scale: 7 }).notNull().default("0"),
  lastValueUsdc: numeric("last_value_usdc", { precision: 20, scale: 7 })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Conversation log — useful for debugging the demo. */
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  direction: msgDirectionEnum("direction").notNull(),
  body: text("body").notNull(),
  intent: varchar("intent", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Message = typeof messages.$inferSelect;
