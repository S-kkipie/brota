import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import type { User } from "@/db/schema";
import { getPending, setPending, clearPending } from "@/lib/pending";
import type { PendingKind } from "@/lib/pending";
import { hashPin, verifyPin, isValidPin } from "@/lib/pin";
import { executeDeposit } from "@/lib/actions/deposit";
import { executeWithdraw } from "@/lib/actions/withdraw";
import type { ActionResult } from "@/lib/actions/types";
import { log } from "@/lib/log";

const MAX_ATTEMPTS = 3;

/**
 * Run the fund move queued behind the PIN step. `kind` comes from the DB (a
 * plain text column), so anything that is not "withdraw" defaults to deposit.
 */
function runQueuedAction(
  kind: string,
  user: User,
  amountUsdc: number,
): Promise<ActionResult> {
  return kind === "withdraw"
    ? executeWithdraw(user, amountUsdc)
    : executeDeposit(user, amountUsdc);
}

/**
 * If the user is mid-flow (e.g. entering a PIN), consume this message as the
 * awaited input and advance the state machine. Returns null when there is no
 * pending flow, so the caller falls back to normal intent classification.
 */
export async function continuePending(
  user: User,
  text: string,
): Promise<ActionResult | null> {
  const pending = await getPending(user.id);
  if (!pending) return null;

  const input = text.trim();
  const amountUsdc = pending.amountUsdc;
  const kind = pending.kind;

  switch (pending.step) {
    case "AWAIT_NEW_PIN": {
      if (!isValidPin(input)) {
        return { reply: "El PIN debe ser exactamente 4 dígitos. Inténtalo otra vez." };
      }
      await setPending(user.id, {
        step: "CONFIRM_NEW_PIN",
        kind: kind === "withdraw" ? "withdraw" : "deposit",
        amountUsdc,
        tempPinHash: hashPin(input),
      });
      return { reply: "Perfecto. Ahora confírmalo escribiéndolo una vez más." };
    }

    case "CONFIRM_NEW_PIN": {
      if (!pending.tempPinHash || !verifyPin(input, pending.tempPinHash)) {
        return retryOrCancel(
          user.id,
          pending.attempts,
          { step: "AWAIT_NEW_PIN", kind, amountUsdc },
          "No coincidió. Escríbeme tu nuevo PIN de 4 dígitos otra vez.",
          "No logramos crear tu PIN. Empecemos de nuevo cuando quieras.",
        );
      }
      await db
        .update(users)
        .set({ pinHash: pending.tempPinHash })
        .where(eq(users.id, user.id));
      await clearPending(user.id);
      log.info("pin set", { userId: user.id });

      if (amountUsdc) {
        return runQueuedAction(kind, { ...user, pinHash: pending.tempPinHash }, amountUsdc);
      }
      return { reply: "Tu PIN quedó listo ✅" };
    }

    case "AWAIT_PIN": {
      if (!user.pinHash || !verifyPin(input, user.pinHash)) {
        return retryOrCancel(
          user.id,
          pending.attempts,
          { step: "AWAIT_PIN", kind, amountUsdc },
          "PIN incorrecto. Inténtalo de nuevo.",
          "Demasiados intentos. Cancelé la operación por seguridad.",
        );
      }
      await clearPending(user.id);
      if (!amountUsdc) return { reply: "PIN correcto ✅" };
      return runQueuedAction(kind, user, amountUsdc);
    }

    default:
      await clearPending(user.id);
      return null;
  }
}

async function retryOrCancel(
  userId: string,
  attempts: number,
  retryState: {
    step: "AWAIT_NEW_PIN" | "AWAIT_PIN";
    kind: string;
    amountUsdc: number | null;
  },
  retryMsg: string,
  cancelMsg: string,
): Promise<ActionResult> {
  if (attempts + 1 >= MAX_ATTEMPTS) {
    await clearPending(userId);
    return { reply: cancelMsg };
  }
  const kind: PendingKind = retryState.kind === "withdraw" ? "withdraw" : "deposit";
  await setPending(userId, {
    step: retryState.step,
    kind,
    amountUsdc: retryState.amountUsdc,
    attempts: attempts + 1,
  });
  return { reply: retryMsg };
}
