import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, relative, sep } from "node:path";

import { type AllowedAssetMimeType, assertSafeRelativeKey, extensionForMime, getDiskRoot, readValidatedImage } from "./config";

export interface DiskLocalAsset {
  body: Uint8Array;
  contentType: string;
}

const EXT_TO_MIME: Record<string, AllowedAssetMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function mimeFromKey(key: string): AllowedAssetMimeType | null {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = key.slice(dot + 1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

/** Absolute path without path.resolve (avoids Turbopack dynamic-resolve warning). */
function toAbsolute(path: string): string {
  return normalize(isAbsolute(path) ? path : join(process.cwd(), path));
}

/**
 * Resolve `key` under the disk root. Returns null when the key is malformed
 * or would escape the root (symlink / `..` after normalize).
 */
function resolveUnderRoot(key: string): string | null {
  try {
    assertSafeRelativeKey(key);
  } catch {
    return null;
  }

  const root = toAbsolute(getDiskRoot());
  const absolute = normalize(join(root, key));
  const rel = relative(root, absolute);
  if (rel.startsWith("..") || rel === "" || isAbsolutePath(rel)) {
    return null;
  }
  // Windows-style absolute residual
  if (rel.includes(`..${sep}`) || rel.startsWith(`..${sep}`)) {
    return null;
  }
  return absolute;
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith(sep) || /^[A-Za-z]:[\\/]/.test(path);
}

/**
 * Dangerous reset targets: filesystem root, home directory, project root.
 * Safe relative, absolute, and temp directories are allowed.
 */
export function assertSafeDiskRoot(root: string): void {
  const absolute = toAbsolute(root);
  const cwd = toAbsolute(process.cwd());
  const home = normalize(homedir());

  if (absolute === sep || absolute === normalize(sep)) {
    throw new Error("ASSET_DISK_DIR cannot be the filesystem root");
  }
  // Windows drive roots like C:\
  if (/^[A-Za-z]:[\\/]?$/.test(absolute)) {
    throw new Error("ASSET_DISK_DIR cannot be a drive root");
  }
  if (absolute === home) {
    throw new Error("ASSET_DISK_DIR cannot be the home directory");
  }
  if (absolute === cwd) {
    throw new Error("ASSET_DISK_DIR cannot be the project root");
  }
}

export async function diskUpload(file: File): Promise<string> {
  const { bytes, mime } = await readValidatedImage(file);
  const ext = extensionForMime(mime);
  // Unguessable key; extension from validated MIME only.
  const key = `${randomBytes(16).toString("hex")}.${ext}`;
  const absolute = resolveUnderRoot(key);
  if (absolute === null) {
    throw new Error("Failed to place asset under disk root");
  }

  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  return key;
}

export async function diskDelete(key: string): Promise<void> {
  const absolute = resolveUnderRoot(key);
  if (absolute === null) {
    // Malformed / traversal: treat as no-op (idempotent delete of bad key).
    return;
  }

  try {
    await rm(absolute, { force: true });
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error ? Reflect.get(error, "code") : undefined;
    if (code === "ENOENT") return;
    throw error;
  }
}

export async function diskRead(key: string): Promise<DiskLocalAsset | null> {
  const absolute = resolveUnderRoot(key);
  if (absolute === null) return null;

  const contentType = mimeFromKey(key);
  if (contentType === null) return null;

  try {
    const body = await readFile(absolute);
    return { body: new Uint8Array(body), contentType };
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error ? Reflect.get(error, "code") : undefined;
    if (code === "ENOENT") return null;
    throw error;
  }
}

export function diskResolveUrl(key: string): string {
  assertSafeRelativeKey(key);
  const encoded = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/assets/${encoded}`;
}

/**
 * Deletes and recreates only the configured asset directory.
 * Missing directory is success. Dangerous roots are rejected.
 */
export async function diskReset(): Promise<void> {
  const root = getDiskRoot();
  assertSafeDiskRoot(root);

  try {
    await rm(root, { recursive: true, force: true });
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error ? Reflect.get(error, "code") : undefined;
    if (code !== "ENOENT") throw error;
  }

  await mkdir(root, { recursive: true });
}
