import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import type { User } from "@/db/schema";
import { getPending, setPending, clearPending } from "@/lib/pending";
import { hashPin, verifyPin, isValidPin } from "@/lib/pin";
import { executeDeposit } from "@/lib/actions/deposit";
import type { ActionResult } from "@/lib/actions/types";
import { log } from "@/lib/log";

const MAX_ATTEMPTS = 3;

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

  switch (pending.step) {
    case "AWAIT_NEW_PIN": {
      if (!isValidPin(input)) {
        return { reply: "El PIN debe ser exactamente 4 dígitos. Inténtalo otra vez." };
      }
      await setPending(user.id, {
        step: "CONFIRM_NEW_PIN",
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
          { step: "AWAIT_NEW_PIN", amountUsdc },
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
        return executeDeposit({ ...user, pinHash: pending.tempPinHash }, amountUsdc);
      }
      return { reply: "Tu PIN quedó listo ✅" };
    }

    case "AWAIT_PIN": {
      if (!user.pinHash || !verifyPin(input, user.pinHash)) {
        return retryOrCancel(
          user.id,
          pending.attempts,
          { step: "AWAIT_PIN", amountUsdc },
          "PIN incorrecto. Inténtalo de nuevo.",
          "Demasiados intentos. Cancelé la operación por seguridad.",
        );
      }
      await clearPending(user.id);
      if (!amountUsdc) return { reply: "PIN correcto ✅" };
      return executeDeposit(user, amountUsdc);
    }

    default:
      await clearPending(user.id);
      return null;
  }
}

async function retryOrCancel(
  userId: string,
  attempts: number,
  retryState: { step: "AWAIT_NEW_PIN" | "AWAIT_PIN"; amountUsdc: number | null },
  retryMsg: string,
  cancelMsg: string,
): Promise<ActionResult> {
  if (attempts + 1 >= MAX_ATTEMPTS) {
    await clearPending(userId);
    return { reply: cancelMsg };
  }
  await setPending(userId, { ...retryState, attempts: attempts + 1 });
  return { reply: retryMsg };
}
