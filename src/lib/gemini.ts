import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { logger } from "@/lib/log";
import { requireEnv } from "@/lib/env";

const log = logger("gemini");

/**
 * Gemini = the NLU + coach brain. It ONLY interprets and drafts text. It never
 * holds keys or moves funds (see AGENTS.md security rules). Fund movement is
 * gated behind the user's PIN in the action layer.
 */
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) _client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return _client;
}

export const MODEL = "gemini-2.5-flash";

export const IntentSchema = z.object({
  /** What the user wants. */
  intent: z.enum(["deposit", "balance", "coach", "unknown"]),
  /** USDC amount when intent === "deposit", else null. */
  amountUsdc: z.number().positive().nullable().default(null),
  /** Short reply drafted by the model (Spanish). Used directly for "coach". */
  reply: z.string(),
});
export type Intent = z.infer<typeof IntentSchema>;

const SYSTEM = `Eres Brota, un coach de ahorro en dólares por WhatsApp para usuarios en Perú.
Hablas español simple y cálido. Nunca pides ni manejas llaves privadas ni cripto.
Clasifica el mensaje del usuario en una intención y responde SOLO con JSON válido:
{"intent":"deposit"|"balance"|"coach"|"unknown","amountUsdc":number|null,"reply":string}
- "deposit": quiere ahorrar/guardar dinero. Extrae el monto en USDC si lo menciona.
- "balance": pregunta cuánto tiene o cómo va su rendimiento.
- "coach": pregunta educativa o conversación general. Responde en "reply".
- "unknown": no entiendes. Pide aclaración amable en "reply".`;

/** Classify an inbound WhatsApp message into a structured intent. */
export async function classifyIntent(message: string): Promise<Intent> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: message,
    config: {
      systemInstruction: SYSTEM,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = res.text ?? "";
  try {
    return IntentSchema.parse(JSON.parse(text));
  } catch (err) {
    log.warn("failed to parse Gemini intent, falling back to unknown", {
      text,
      err: String(err),
    });
    return {
      intent: "unknown",
      amountUsdc: null,
      reply: "Disculpa, no te entendí bien. ¿Me lo explicas de otra forma?",
    };
  }
}
