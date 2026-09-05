/**
 * UploadThing adapter contracts via the public `@/lib/assets/server` API.
 * Mocks UTApi; never calls the real service.
 *
 * @jest-environment node
 */

const uploadFiles = jest.fn();
const deleteFiles = jest.fn();

jest.mock("uploadthing/server", () => ({
  UTApi: jest.fn(() => ({ uploadFiles, deleteFiles })),
}));

const ORIGINAL_ENV = { ...process.env };

function utToken(appId = "app_demo"): string {
  return Buffer.from(JSON.stringify({ apiKey: "sk_test", appId, regions: ["sea1"] })).toString("base64");
}

async function importAssets() {
  jest.resetModules();
  // Re-apply mock after resetModules so the fresh module graph sees UTApi.
  jest.doMock("uploadthing/server", () => ({
    UTApi: jest.fn(() => ({ uploadFiles, deleteFiles })),
  }));
  return import("@/lib/assets/server");
}

function tinyJpeg(): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "photo.jpg", { type: "image/jpeg" });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ASSET_PROVIDER = "uploadthing";
  process.env.UPLOADTHING_TOKEN = utToken();
  uploadFiles.mockReset();
  deleteFiles.mockReset();
});

afterAll(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("UploadThing asset adapter", () => {
  it("uploads validated file data and returns only the provider key", async () => {
    let sent: File | undefined;
    uploadFiles.mockImplementation((file: File) => {
      sent = file;
      return Promise.resolve({
        data: {
          key: "ut_file_abc",
          ufsUrl: "https://app_demo.ufs.sh/f/ut_file_abc",
          name: "upload.jpg",
          size: 4,
          type: "image/jpeg",
        },
        error: null,
      });
    });

    const assets = await importAssets();
    const key = await assets.uploadAsset(tinyJpeg());

    expect(key).toBe("ut_file_abc");
    expect(sent).toBeInstanceOf(File);
    expect(sent?.type).toBe("image/jpeg");
    expect(sent?.name).toMatch(/\.jpg$/);
  });

  it("resolves a direct UploadThing read URL from the token appId", async () => {
    const assets = await importAssets();
    expect(assets.resolveAssetUrl("ut_file_abc")).toBe("https://app_demo.ufs.sh/f/ut_file_abc");
  });

  it("delete sends the correct key", async () => {
    deleteFiles.mockResolvedValue({ success: true, deletedCount: 1 });
    const assets = await importAssets();
    await assets.deleteAsset("ut_file_abc");
    expect(deleteFiles).toHaveBeenCalledWith("ut_file_abc");
  });

  it("maps SDK failures to stable asset-layer errors", async () => {
    uploadFiles.mockResolvedValue({
      data: null,
      error: { code: "UPLOAD_FAILED", message: "boom" },
    });
    const assets = await importAssets();
    await expect(assets.uploadAsset(tinyJpeg())).rejects.toThrow(/boom|UploadThing/);

    uploadFiles.mockRejectedValue(new Error("network down"));
    await expect(assets.uploadAsset(tinyJpeg())).rejects.toThrow(/UploadThing upload failed/);
  });

  it("requires UploadThing credentials only when that provider is selected", async () => {
    delete process.env.UPLOADTHING_TOKEN;
    process.env.ASSET_PROVIDER = "uploadthing";
    const assets = await importAssets();
    await expect(assets.uploadAsset(tinyJpeg())).rejects.toThrow(/UPLOADTHING_TOKEN/);

    // Disk mode must not require the token.
    process.env.ASSET_PROVIDER = "disk";
    process.env.ASSET_DISK_DIR = await (
      await import("node:fs/promises")
    ).mkdtemp((await import("node:path")).join((await import("node:os")).tmpdir(), "assets-ut-disk-"));
    const diskAssets = await importAssets();
    await expect(diskAssets.uploadAsset(tinyJpeg())).resolves.toMatch(/\.jpg$/);
  });

  it("rejects invalid images before calling UTApi", async () => {
    const assets = await importAssets();
    await expect(assets.uploadAsset(new File([new Uint8Array([1])], "x.txt", { type: "text/plain" }))).rejects.toThrow(/Unsupported image type/);
    expect(uploadFiles).not.toHaveBeenCalled();
  });
});
