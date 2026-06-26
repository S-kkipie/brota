import { getLogger, type Logger } from "@logtape/logtape";

/**
 * Structured logging via logtape. Configuration happens once in
 * `instrumentation.ts` (`register()`); here we only hand out loggers.
 *
 * Usage:
 *   const log = logger("whatsapp");
 *   log.info("inbound message", { from });
 *
 * Never use console.log in committed code (see AGENTS.md).
 */
export function logger(...category: string[]): Logger {
  return getLogger(["brota", ...category]);
}
