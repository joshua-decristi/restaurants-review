import "server-only";
import { isAbsolute, join, normalize } from "node:path";

import { serverEnv } from "@/lib/env/server";

export type AssetProvider = "disk" | "uploadthing";

/** JPEG / PNG / WebP only; matches restaurant image validation. */
export const ALLOWED_ASSET_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);

export type AllowedAssetMimeType = "image/jpeg" | "image/png" | "image/webp";

export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXTENSION: Record<AllowedAssetMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMime(mime: AllowedAssetMimeType): string {
  return MIME_TO_EXTENSION[mime];
}

export function getAssetProvider(): AssetProvider {
  return serverEnv.ASSET_PROVIDER;
}

/**
 * Absolute path to the configured disk asset root.
 * Relative ASSET_DISK_DIR values resolve against process.cwd().
 */
export function getDiskRoot(): string {
  const configured = serverEnv.ASSET_DISK_DIR;
  // join + normalize (not path.resolve) keeps absolute/temp dirs configurable
  // without a Turbopack dynamic-resolve warning.
  return normalize(isAbsolute(configured) ? configured : join(process.cwd(), configured));
}

/**
 * Decode UPLOADTHING_TOKEN when the UploadThing provider is active.
 * Token is base64 JSON: `{ apiKey, appId, regions }`.
 */
export function requireUploadThingCredentials(): { token: string; appId: string } {
  const token = serverEnv.UPLOADTHING_TOKEN;
  if (token === undefined) {
    throw new Error("UPLOADTHING_TOKEN is required when ASSET_PROVIDER=uploadthing");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64").toString("utf8")) as unknown;
  } catch {
    throw new Error("UPLOADTHING_TOKEN is not valid base64 JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("UPLOADTHING_TOKEN payload must be a JSON object");
  }

  const appId = "appId" in parsed ? parsed.appId : undefined;
  if (typeof appId !== "string" || appId.length === 0) {
    throw new Error("UPLOADTHING_TOKEN payload is missing a non-empty appId");
  }

  return { token, appId };
}

export class AssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetValidationError";
  }
}

export class AssetProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AssetProviderError";
  }
}

/**
 * Validates MIME + size and returns bytes + typed MIME.
 * Does not trust the client filename for the extension.
 */
export async function readValidatedImage(file: File): Promise<{ bytes: Uint8Array; mime: AllowedAssetMimeType }> {
  if (!(file instanceof File)) {
    throw new AssetValidationError("Expected a File");
  }

  const mime = file.type;
  if (!ALLOWED_ASSET_MIME_TYPES.has(mime as AllowedAssetMimeType)) {
    throw new AssetValidationError(`Unsupported image type: ${mime || "(empty)"}. Allowed: JPEG, PNG, WebP`);
  }

  if (file.size <= 0) {
    throw new AssetValidationError("Image file is empty");
  }

  if (file.size > MAX_ASSET_BYTES) {
    throw new AssetValidationError(`Image exceeds maximum size of ${String(MAX_ASSET_BYTES)} bytes`);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength > MAX_ASSET_BYTES) {
    throw new AssetValidationError(`Image exceeds maximum size of ${String(MAX_ASSET_BYTES)} bytes`);
  }

  return { bytes: buffer, mime: mime as AllowedAssetMimeType };
}

/**
 * Rejects empty keys, null bytes, absolute paths, and `..` / empty path segments.
 * Used by disk read/delete and the public route (route also pre-filters).
 */
export function assertSafeRelativeKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) {
    throw new AssetValidationError("Asset key is empty");
  }
  if (key.includes("\0")) {
    throw new AssetValidationError("Asset key contains a null byte");
  }
  if (key.startsWith("/") || key.startsWith("\\")) {
    throw new AssetValidationError("Asset key must be relative");
  }
  if (key.split(/[/\\]/).some((part) => part === ".." || part === "")) {
    throw new AssetValidationError("Asset key contains illegal path segments");
  }
}
