import "server-only";

import { UTApi } from "uploadthing/server";
import type { UploadFileResult } from "uploadthing/types";

import { AssetProviderError, readValidatedImage, requireUploadThingCredentials } from "./config";

let cachedApi: UTApi | undefined;
let cachedToken: string | undefined;

function getUtApi(): UTApi {
  const { token } = requireUploadThingCredentials();
  if (cachedApi !== undefined && cachedToken === token) return cachedApi;
  cachedApi = new UTApi({ token });
  cachedToken = token;
  return cachedApi;
}

/** Test seam: clear the cached UTApi client between cases. */
export function resetUploadThingClientCache(): void {
  cachedApi = undefined;
  cachedToken = undefined;
}

export async function uploadThingUpload(file: File): Promise<string> {
  const { bytes, mime } = await readValidatedImage(file);
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  // Copy into a fresh ArrayBuffer so BlobPart typing accepts it under strict DOM libs.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const payload = new File([copy], `upload.${ext}`, { type: mime });

  const api = getUtApi();
  let result: UploadFileResult;
  try {
    // Explicit single-file call; UTApi overloads distinguish File vs File[].
    result = await api.uploadFiles(payload);
  } catch (error) {
    throw new AssetProviderError("UploadThing upload failed", { cause: error });
  }

  return keyFromUploadResult(result);
}

function keyFromUploadResult(result: UploadFileResult): string {
  if (result.data !== null) {
    const key = result.data.key;
    if (key.length === 0) {
      throw new AssetProviderError("UploadThing upload returned an empty key");
    }
    return key;
  }

  throw new AssetProviderError(result.error.message || "UploadThing upload returned no data");
}

export async function uploadThingDelete(key: string): Promise<void> {
  if (typeof key !== "string" || key.length === 0) return;

  const api = getUtApi();
  try {
    await api.deleteFiles(key);
  } catch (error) {
    throw new AssetProviderError("UploadThing delete failed", { cause: error });
  }
}

/**
 * Direct public UploadThing CDN URL.
 * Prefer ufs.sh subdomain form: `https://{appId}.ufs.sh/f/{key}`.
 */
export function uploadThingResolveUrl(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new AssetProviderError("Cannot resolve an empty UploadThing key");
  }
  const { appId } = requireUploadThingCredentials();
  return `https://${appId}.ufs.sh/f/${encodeURIComponent(key)}`;
}
