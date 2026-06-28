import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

let isConfigured = false;

export async function setupLogtape() {
  if (isConfigured) return;
  await configure({
    sinks: {
      console: getConsoleSink(),
    },
    loggers: [
      { category: "app", sinks: ["console"] },
      { category: "webhook", sinks: ["console"] },
      { category: "db", sinks: ["console"] },
      { category: "gemini", sinks: ["console"] },
    ],
  });
  isConfigured = true;
}

export const log = getLogger("app");
