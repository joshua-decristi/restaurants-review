"use client";

import { configureSync, getConfig, getConsoleSink, getLogger, LogRecord } from "@logtape/logtape";

import { clientEnv } from "@/lib/env/client";

/**
 * Safely serialize a LogRecord's message parts (template strings interleaved with substitution values) into a single bounded string.
 */
function serializeClientLogMessage(parts: readonly unknown[]): string {
  const text = parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part === null || part === undefined) return String(part);
      try {
        return JSON.stringify(part);
      } catch {
        // Circular references & other unserializable values
        return "[unserializable]";
      }
    })
    .join("");

  return text;
}

function sendClientLogToServer(record: LogRecord) {
  fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level: record.level,
      message: serializeClientLogMessage(record.message),
    }),
  }).catch(() => {
    console.error("Unable to send client log to server");
  });
}

/**
 * I've decided NOT to log in production, because it's a demo application.
 *
 * However, in a real project, I WOULD setup logging in remote envs (dev, staging, prod, etc) to be:
 * - asynchronous (for large streaming events)
 * - to a dedicated log source (CloudWatch, or even just a DB)
 */
export function initializeClientLogger() {
  // Only initialize once
  if (getConfig() !== null) return;

  // Don't log in production builds
  if (clientEnv.NODE_ENV === "production") return;

  configureSync({
    sinks: {
      console: getConsoleSink(),
      remoteClientSink: sendClientLogToServer,
    },
    loggers: [{ category: [], lowestLevel: "debug", sinks: ["console", "remoteClientSink"] }],
  });
}

export const getClientLogger = () => getLogger(["client"]);
