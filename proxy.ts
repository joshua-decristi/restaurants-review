import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/server";

/**
 * Thin transport authorization: every application route is private unless it
 * is explicitly public below. This file only checks session existence; role
 * routing is handled after login.
 */

/** Exact routes reachable without a session. */
const PUBLIC_PATHS = new Set(["/", "/login", "/api/log", "/restaurants"]);

/** Route prefixes (with their descendants) reachable without a session. */
const PUBLIC_PREFIXES = ["/api/auth", "/api/assets"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const session = await getSession(request);
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  return NextResponse.next();
}

export const config = {
  // Exclude framework assets and other non-application static requests
  // (any path with a file extension) from the default-private policy.
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
