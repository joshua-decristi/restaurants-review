import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readLocalAsset } from "@/lib/assets/server";

/** Allowlisted image MIME types served by the local disk asset endpoint. */
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Rebuilds the asset key from catch-all path segments.
 * Rejects empty, malformed (bad percent-encoding), and traversal-shaped keys.
 */
function assetKeyFromSegments(segments: string[]): string | null {
  if (segments.length === 0) return null;

  let key: string;
  try {
    key = segments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return null;
  }

  if (key.length === 0) return null;
  if (key.includes("\0")) return null;
  if (key.startsWith("/") || key.startsWith("\\")) return null;
  if (key.split(/[/\\]/).some((part) => part === ".." || part === "")) return null;

  return key;
}

/**
 * GET /api/assets/[...key] — disk-only local asset reads.
 *
 * Assumptions (lib/assets public API, adapters owned elsewhere):
 * - `readLocalAsset(key)` returns `{ body, contentType }` for a valid disk file,
 *   or `null` for missing/malformed keys, traversal attempts, and non-disk providers.
 * - Content-type is already constrained to JPEG/PNG/WebP by the assets layer;
 *   this route double-checks the allowlist before responding.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ key: string[] }> }): Promise<NextResponse> {
  const { key: segments } = await context.params;
  const assetKey = assetKeyFromSegments(segments);
  if (assetKey === null) {
    return new NextResponse(null, { status: 404 });
  }

  const asset = await readLocalAsset(assetKey);
  if (asset === null || !ALLOWED_CONTENT_TYPES.has(asset.contentType)) {
    return new NextResponse(null, { status: 404 });
  }

  // Body is a fresh Uint8Array; copy into a plain ArrayBuffer for Response init.
  const body = Uint8Array.from(asset.body);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
