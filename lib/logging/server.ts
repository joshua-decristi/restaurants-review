import "server-only";

import { getFileSink } from "@logtape/file";
import { configureSync, getConfig, getConsoleSink, getLogger } from "@logtape/logtape";

import { serverEnv } from "@/lib/env/server";

/**
 * I've decided NOT to log in production, because it's a demo application.
 *
 * However, in a real project, I WOULD setup logging in remote envs (dev, staging, prod, etc) to be:
 * - asynchronous (for large streaming events)
 * - to a dedicated log source (CloudWatch, or even just a DB)
 */
export function initializeServerLogger() {
  // Only initialize once
  if (getConfig() !== null) return;

  // Don't log in production builds
  if (serverEnv.NODE_ENV === "production") return;

  configureSync({
    sinks: {
      terminal: getConsoleSink(),
      serverLogFile: getFileSink("server-logs.log"),
      dbLogFile: getFileSink("database-logs.log"),
      browserLogFile: getFileSink("client-logs.log"),
    },
    loggers: [
      { category: [], lowestLevel: "info", sinks: ["terminal"] },
      { category: ["server"], lowestLevel: "debug", sinks: ["serverLogFile"] },
      { category: ["client"], lowestLevel: "debug", sinks: ["browserLogFile"] },
      { category: ["database"], lowestLevel: "debug", sinks: ["dbLogFile"] },
    ],
  });
}

export const getServerLogger = () => getLogger(["server"]);
