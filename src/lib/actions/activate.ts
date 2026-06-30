import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { decryptSecret } from "@/lib/crypto";
import { ensureWalletForUser } from "@/lib/wallet";
import { horizonServer, networkPassphrase } from "@/lib/stellar";
import { requireEnv, optionalEnv } from "@/lib/env";
import { log } from "@/lib/log";
import type { ActionContext, ActionResult } from "@/lib/actions/types";

/**
 * Add a USDC trustline to the user's custodial account so it can RECEIVE USDC.
 * Required on mainnet (where accounts are not friendbot-funded): the user sends
 * XLM first to create the account, then runs this, then can receive USDC.
 *
 * The USDC asset is configurable (STELLAR_USDC_ISSUER / STELLAR_USDC_CODE) so it
 * matches the configured DeFindex vault's underlying asset. The trustline tx is
 * signed by the custodial key and pays its fee from the account's XLM.
 */
export async function handleActivate(ctx: ActionContext): Promise<ActionResult> {
  const wallet = await ensureWalletForUser(ctx.user.id);
  const pk = wallet.stellarPublicKey;
  const code = optionalEnv("STELLAR_USDC_CODE", "USDC");
  const issuer = requireEnv("STELLAR_USDC_ISSUER");
  log.info("activate requested", { userId: ctx.user.id, code });

  // Account must already exist on-ledger (i.e. be XLM-funded) to add a trustline.
  const account = await horizonServer.loadAccount(pk).catch(() => null);
  if (!account) {
    return {
      reply:
        `Aún no veo XLM en tu cuenta. Manda ~2 XLM a:\n${pk}\n` +
        `Luego escribe "activar" otra vez.`,
    };
  }

  const alreadyTrusts = account.balances.some(
    (b) =>
      "asset_code" in b &&
      "asset_issuer" in b &&
      b.asset_code === code &&
      b.asset_issuer === issuer,
  );
  if (alreadyTrusts) {
    return {
      reply: `Tu cuenta ya está activa para ${code} ✅. Manda tu ${code} y dime "ahorra <monto>".`,
    };
  }

  const keypair = Keypair.fromSecret(decryptSecret(wallet.encryptedSecret));
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(code, issuer) }))
    .setTimeout(60)
    .build();
  tx.sign(keypair);
  await horizonServer.submitTransaction(tx);

  log.info("usdc trustline added", { pk, code, issuer });
  return {
    reply:
      `Listo ✅ tu cuenta ya puede recibir ${code}. Manda tu ${code} a:\n${pk}\n` +
      `Luego dime "ahorra <monto>" para que empiece a rendir 🌱.`,
  };
}
