/**
 * Local disk asset GET endpoint. Mocks `@/lib/assets/server` so this slice
 * does not depend on adapter implementation.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";

import { readLocalAsset } from "@/lib/assets/server";

import { GET } from "../route";

jest.mock("@/lib/assets/server", () => ({
  readLocalAsset: jest.fn(),
}));

const readLocalAssetMock = jest.mocked(readLocalAsset);

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

function params(key: string[]): Promise<{ key: string[] }> {
  return Promise.resolve({ key });
}

async function get(path: string, key: string[]) {
  return GET(request(path), { params: params(key) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

it.each([
  { contentType: "image/jpeg", body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) },
  { contentType: "image/png", body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  { contentType: "image/webp", body: new Uint8Array([0x52, 0x49, 0x46, 0x46]) },
] as const)("serves $contentType with immutable cache headers", async ({ contentType, body }) => {
  readLocalAssetMock.mockResolvedValue({ body, contentType });

  const response = await get("/api/assets/seed/photo", ["seed", "photo"]);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe(contentType);
  expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  expect(readLocalAssetMock).toHaveBeenCalledWith("seed/photo");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(body);
});

it("rebuilds a single-segment key without introducing slashes", async () => {
  readLocalAssetMock.mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/png" });

  const response = await get("/api/assets/abc123.png", ["abc123.png"]);

  expect(response.status).toBe(200);
  expect(readLocalAssetMock).toHaveBeenCalledWith("abc123.png");
});

it("decodes percent-encoded segments before reading", async () => {
  readLocalAssetMock.mockResolvedValue({ body: new Uint8Array([1]), contentType: "image/jpeg" });

  const response = await get("/api/assets/dir/my%20file.jpg", ["dir", "my%20file.jpg"]);

  expect(response.status).toBe(200);
  expect(readLocalAssetMock).toHaveBeenCalledWith("dir/my file.jpg");
});

it("returns 404 when the asset is missing", async () => {
  readLocalAssetMock.mockResolvedValue(null);

  const response = await get("/api/assets/missing.jpg", ["missing.jpg"]);

  expect(response.status).toBe(404);
  expect((await response.arrayBuffer()).byteLength).toBe(0);
});

it("returns 404 for empty catch-all segments without calling assets", async () => {
  const response = await get("/api/assets/", []);

  expect(response.status).toBe(404);
  expect(readLocalAssetMock).not.toHaveBeenCalled();
});

it("returns 404 for malformed percent-encoding without calling assets", async () => {
  const response = await get("/api/assets/%E0%A4%A", ["%E0%A4%A"]);

  expect(response.status).toBe(404);
  expect(readLocalAssetMock).not.toHaveBeenCalled();
});

it.each([
  { name: "dot-dot segment", key: ["..", "secrets.txt"] },
  { name: "empty path segment", key: ["seed", "", "x.jpg"] },
  { name: "absolute-looking key", key: ["/etc/passwd"] },
  { name: "backslash absolute key", key: ["\\windows\\system32"] },
  { name: "null byte", key: ["seed\0x.jpg"] },
])("returns 404 for traversal-shaped key ($name) without calling assets", async ({ key }) => {
  const response = await get(`/api/assets/${key.join("/")}`, key);

  expect(response.status).toBe(404);
  expect(readLocalAssetMock).not.toHaveBeenCalled();
});

it("returns 404 when assets reports a non-allowlisted content type", async () => {
  readLocalAssetMock.mockResolvedValue({
    body: new Uint8Array([1, 2, 3]),
    contentType: "application/octet-stream",
  });

  const response = await get("/api/assets/payload.bin", ["payload.bin"]);

  expect(response.status).toBe(404);
});

it("returns 404 when the provider is non-disk (readLocalAsset returns null)", async () => {
  // UploadThing mode: local endpoint always 404s via null from the public API.
  readLocalAssetMock.mockResolvedValue(null);

  const response = await get("/api/assets/remote-key", ["remote-key"]);

  expect(response.status).toBe(404);
});

it("exposes only GET (no upload, delete, or listing handlers)", async () => {
  const mod: Record<string, unknown> = await import("../route");
  expect(typeof mod.GET).toBe("function");
  expect(mod).not.toHaveProperty("POST");
  expect(mod).not.toHaveProperty("PUT");
  expect(mod).not.toHaveProperty("DELETE");
  expect(mod).not.toHaveProperty("PATCH");
});
