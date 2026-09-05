import "server-only";

import { getAssetProvider } from "./internal/config";
import * as disk from "./internal/disk";
import * as uploadthing from "./internal/uploadthing";

export type AssetKey = string;

export interface LocalAsset {
  body: Uint8Array;
  contentType: string;
}

export { AssetProviderError, AssetValidationError } from "./internal/config";

/**
 * Provider-neutral upload. Stores only the bare provider key for restaurants.
 * Validates JPEG/PNG/WebP and 5 MB max before writing.
 */
export async function uploadAsset(file: File): Promise<AssetKey> {
  if (getAssetProvider() === "uploadthing") {
    return uploadthing.uploadThingUpload(file);
  }
  return disk.diskUpload(file);
}

/**
 * Provider-neutral delete. Idempotent for missing keys where the provider allows it.
 */
export async function deleteAsset(key: AssetKey): Promise<void> {
  if (getAssetProvider() === "uploadthing") {
    await uploadthing.uploadThingDelete(key);
    return;
  }
  await disk.diskDelete(key);
}

/**
 * Resolve a stored key to a public URL.
 * Disk → `/api/assets/<encoded-key>`; UploadThing → direct CDN URL.
 */
export function resolveAssetUrl(key: AssetKey): string {
  if (getAssetProvider() === "uploadthing") {
    return uploadthing.uploadThingResolveUrl(key);
  }
  return disk.diskResolveUrl(key);
}

/**
 * Disk-only local read for GET /api/assets/[...key].
 * Returns null for missing/malformed keys, traversal, and non-disk providers.
 */
export async function readLocalAsset(key: AssetKey): Promise<LocalAsset | null> {
  if (getAssetProvider() !== "disk") return null;
  return disk.diskRead(key);
}

/**
 * Recreates the configured local asset root when ASSET_PROVIDER=disk.
 * No-op for UploadThing. Missing root is success. Dangerous targets rejected.
 */
export async function resetLocalAssets(): Promise<void> {
  if (getAssetProvider() !== "disk") return;
  await disk.diskReset();
}
