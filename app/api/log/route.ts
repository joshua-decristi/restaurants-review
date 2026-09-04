"use server";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getLogger } from "@logtape/logtape";
import { z } from "zod";

import { serverEnv } from "@/lib/env/server";

const clientLogSchema = z.object({
  level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
  message: z.string().min(1).max(2_000),
});

export async function POST(request: NextRequest) {
  /** Hide endpoint outside of local development */
  if (serverEnv.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const logResult = clientLogSchema.safeParse(await request.json().catch(() => null));
  if (logResult.error) {
    return NextResponse.json({ error: "Invalid log shape" }, { status: 400 });
  }

  const logger = getLogger(["client"]);
  const { level, message } = logResult.data;

  // Log client-log on Server
  logger[level](message);
  return NextResponse.json({ success: true }, { status: 201 });
}
