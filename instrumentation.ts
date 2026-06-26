/**
 * Next.js instrumentation hook — runs once at server startup (Node runtime).
 * We use it to configure logtape a single time for the whole process.
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { configure, getConsoleSink } = await import("@logtape/logtape");

  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [
      {
        category: ["brota"],
        sinks: ["console"],
        lowestLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
      },
      // Silence logtape's own meta logger unless something goes wrong.
      { category: ["logtape", "meta"], sinks: ["console"], lowestLevel: "warning" },
    ],
  });
}
