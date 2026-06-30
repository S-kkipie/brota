import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { log } from "@/lib/log";

/**
 * Gemini = the NLU + coach brain. It ONLY interprets and drafts text. It never
 * holds keys or moves funds.
 */
let _client: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export const MODEL = "gemini-2.5-flash";

export const IntentSchema = z.object({
  intent: z.enum([
    "deposit",
    "withdraw",
    "balance",
    "address",
    "activate",
    "coach",
    "profile",
    "unknown",
  ]),
  amountUsdc: z.number().positive().nullable().default(null),
  reply: z.string(),
});
export type Intent = z.infer<typeof IntentSchema>;

const SYSTEM = `Eres Brota, un coach de ahorro en dólares por WhatsApp y Telegram para usuarios en Perú.
Hablas español simple y cálido. Nunca pides ni manejas llaves privadas ni cripto.
Clasifica el mensaje del usuario en una intención y responde SOLO con JSON válido:
{"intent":"deposit"|"withdraw"|"balance"|"address"|"activate"|"coach"|"profile"|"unknown","amountUsdc":number|null,"reply":string}
- "deposit": quiere ahorrar/guardar dinero que YA tiene en su cuenta. Extrae el monto en USDC si lo menciona.
- "withdraw": quiere retirar/sacar dinero de su ahorro. Extrae el monto en USDC si lo menciona.
- "balance": pregunta cuánto tiene o cómo va su rendimiento.
- "address": pide su dirección para depositar/fondear, o cómo meter plata a su cuenta.
- "activate": quiere activar/habilitar su cuenta para recibir USDC (trustline).
- "profile": pide el link de su perfil/página/web para ver sus ahorros en el navegador.
- "coach": pregunta educativa o conversación general. Responde en "reply".
- "unknown": no entiendes. Pide aclaración amable en "reply".`;

/**
 * Offline keyword classifier used when GEMINI_API_KEY is unset, so the demo
 * runs locally with zero external keys. Crude on purpose — real NLU is Gemini.
 */
function localClassify(message: string): Intent {
  const text = message.toLowerCase();
  const amountMatch = text.match(/\d+(?:[.,]\d+)?/);
  const amountUsdc = amountMatch ? Number(amountMatch[0].replace(",", ".")) : null;

  if (/perfil|p[aá]gina|web|link|enlace|dashboard|mi cuenta|ver mis ahorros/.test(text)) {
    return { intent: "profile", amountUsdc: null, reply: "" };
  }
  if (/activ|habilit|trustline/.test(text)) {
    return { intent: "activate", amountUsdc: null, reply: "" };
  }
  if (/direcci[oó]n|dep[oó]sit|fonde|cargar|recibir|d[oó]nde (te |le )?mando|mi (wallet|billetera)|address/.test(text)) {
    return { intent: "address", amountUsdc: null, reply: "" };
  }
  if (/retir|saca|sacar|withdraw|ret[ií]rame/.test(text)) {
    return { intent: "withdraw", amountUsdc, reply: "" };
  }
  if (/ahorr|guard|invert|met[eo]/.test(text)) {
    return { intent: "deposit", amountUsdc, reply: "" };
  }
  if (/saldo|cu[aá]nt|balance|tengo|rendimiento|gan/.test(text)) {
    return { intent: "balance", amountUsdc: null, reply: "" };
  }
  return {
    intent: "coach",
    amountUsdc: null,
    reply: "Soy Brota 🌱. Puedo ayudarte a ahorrar en dólares. Escribe \"ahorra 50\" o \"saldo\".",
  };
}

export async function classifyIntent(message: string): Promise<Intent> {
  if (!process.env.GEMINI_API_KEY) {
    log.warn("GEMINI_API_KEY unset — using local keyword classifier (dev only)");
    return localClassify(message);
  }

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
