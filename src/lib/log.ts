import { getLogger } from "@logtape/logtape";

/**
 * App logger. logtape is configured exactly once at server startup in
 * src/instrumentation.ts (the Next.js `register()` hook). Do NOT call
 * configure() here — a second configure() would clobber that setup. Category
 * must stay under "brota" so it matches the config in instrumentation.ts.
 */
export const log = getLogger("brota");
