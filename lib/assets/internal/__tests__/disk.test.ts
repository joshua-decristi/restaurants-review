/**
 * Disk asset adapter contracts via the public `@/lib/assets/server` API.
 *
 * @jest-environment node
 */

import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGINAL_ENV = { ...process.env };

async function importAssets() {
  jest.resetModules();
  return import("@/lib/assets/server");
}

function tinyJpeg(): File {
  // Minimal JPEG SOI/EOI markers — enough for MIME/size validation.
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return new File([bytes], "photo.jpg", { type: "image/jpeg" });
}

function tinyPng(): File {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "photo.png", { type: "image/png" });
}

function tinyWebp(): File {
  const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  return new File([bytes], "photo.webp", { type: "image/webp" });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ASSET_PROVIDER = "disk";
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("disk asset adapter", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "assets-disk-"));
    process.env.ASSET_DISK_DIR = root;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("defaults missing ASSET_PROVIDER and ASSET_DISK_DIR to disk and .local-assets", async () => {
    delete process.env.ASSET_PROVIDER;
    delete process.env.ASSET_DISK_DIR;
    jest.resetModules();
    const { serverEnv } = await import("@/lib/env/server");
    expect(serverEnv.ASSET_PROVIDER).toBe("disk");
    expect(serverEnv.ASSET_DISK_DIR).toBe(".local-assets");

    const assets = await import("@/lib/assets/server");
    expect(assets.resolveAssetUrl("seed/a.jpg")).toBe("/api/assets/seed/a.jpg");
  });

  it("uploads exact bytes under a generated unguessable safe key", async () => {
    const assets = await importAssets();
    const file = tinyJpeg();
    const key = await assets.uploadAsset(file);

    expect(key).toMatch(/^[a-f0-9]{32}\.jpg$/);
    expect(key.includes("..")).toBe(false);

    const onDisk = await readFile(join(root, key));
    expect(new Uint8Array(onDisk)).toEqual(new Uint8Array(await file.arrayBuffer()));
  });

  it("accepts JPEG, PNG, and WebP", async () => {
    const assets = await importAssets();
    await expect(assets.uploadAsset(tinyJpeg())).resolves.toMatch(/\.jpg$/);
    await expect(assets.uploadAsset(tinyPng())).resolves.toMatch(/\.png$/);
    await expect(assets.uploadAsset(tinyWebp())).resolves.toMatch(/\.webp$/);
  });

  it("rejects unsupported types and files over 5 MB", async () => {
    const assets = await importAssets();

    await expect(assets.uploadAsset(new File([new Uint8Array([1])], "x.gif", { type: "image/gif" }))).rejects.toThrow(/Unsupported image type/);

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    await expect(assets.uploadAsset(oversized)).rejects.toThrow(/maximum size/);
  });

  it("resolves URLs to /api/assets/<encoded-key>", async () => {
    const assets = await importAssets();
    expect(assets.resolveAssetUrl("seed/brasserie paris.jpg")).toBe("/api/assets/seed/brasserie%20paris.jpg");
  });

  it("deletes an existing file and is idempotent for missing files", async () => {
    const assets = await importAssets();
    const key = await assets.uploadAsset(tinyJpeg());
    await expect(assets.deleteAsset(key)).resolves.toBeUndefined();
    await expect(readFile(join(root, key))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(assets.deleteAsset(key)).resolves.toBeUndefined();
  });

  it("reset deletes and recreates only the configured root; missing root is success", async () => {
    const assets = await importAssets();
    const key = await assets.uploadAsset(tinyJpeg());
    await assets.resetLocalAssets();

    expect((await stat(root)).isDirectory()).toBe(true);
    await expect(readFile(join(root, key))).rejects.toMatchObject({ code: "ENOENT" });

    await rm(root, { recursive: true, force: true });
    await expect(assets.resetLocalAssets()).resolves.toBeUndefined();
    expect((await stat(root)).isDirectory()).toBe(true);
  });

  it("UploadThing mode makes reset a no-op", async () => {
    process.env.ASSET_PROVIDER = "uploadthing";
    process.env.UPLOADTHING_TOKEN = Buffer.from(JSON.stringify({ apiKey: "ak", appId: "app_test", regions: ["sea1"] })).toString("base64");
    const marker = join(root, "should-remain.txt");
    await writeFile(marker, "keep");

    const assets = await importAssets();
    await assets.resetLocalAssets();
    await expect(readFile(marker, "utf8")).resolves.toBe("keep");
  });

  it("rejects dangerous reset targets (project root, home) and allows a safe temp directory", async () => {
    process.env.ASSET_DISK_DIR = process.cwd();
    const projectAssets = await importAssets();
    await expect(projectAssets.resetLocalAssets()).rejects.toThrow(/project root/);

    const { homedir } = await import("node:os");
    process.env.ASSET_DISK_DIR = homedir();
    const homeAssets = await importAssets();
    await expect(homeAssets.resetLocalAssets()).rejects.toThrow(/home directory/);

    process.env.ASSET_DISK_DIR = root;
    const safe = await importAssets();
    await expect(safe.resetLocalAssets()).resolves.toBeUndefined();
  });

  it("readLocalAsset returns bytes for valid keys and null for traversal/missing", async () => {
    const assets = await importAssets();
    const key = await assets.uploadAsset(tinyJpeg());
    const found = await assets.readLocalAsset(key);
    expect(found).not.toBeNull();
    expect(found?.contentType).toBe("image/jpeg");
    expect(found?.body.byteLength).toBeGreaterThan(0);

    expect(await assets.readLocalAsset("../secrets.txt")).toBeNull();
    expect(await assets.readLocalAsset("missing.jpg")).toBeNull();
  });

  it("readLocalAsset returns null when provider is uploadthing", async () => {
    process.env.ASSET_PROVIDER = "uploadthing";
    process.env.UPLOADTHING_TOKEN = Buffer.from(JSON.stringify({ apiKey: "ak", appId: "app_test", regions: ["sea1"] })).toString("base64");
    const assets = await importAssets();
    expect(await assets.readLocalAsset("any-key.jpg")).toBeNull();
  });

  it("delete ignores traversal-shaped keys without touching files outside the root", async () => {
    const outside = await mkdtemp(join(tmpdir(), "assets-outside-"));
    try {
      const victim = join(outside, "secret.txt");
      await writeFile(victim, "secret");
      const assets = await importAssets();
      await assets.deleteAsset(`../${outside.split("/").pop() ?? "x"}/secret.txt`);
      await expect(readFile(victim, "utf8")).resolves.toBe("secret");
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
