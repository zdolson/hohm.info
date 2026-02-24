import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isTrustedPhotoUrl,
  downloadPhotos,
} from "@/scripts/lib/download-photos";

describe("isTrustedPhotoUrl", () => {
  it("returns true for allowlisted Zillow domains (https)", () => {
    expect(
      isTrustedPhotoUrl("https://photos.zillowstatic.com/fp/abc.jpg")
    ).toBe(true);
    expect(isTrustedPhotoUrl("https://zillowstatic.com/some/path.jpg")).toBe(
      true
    );
  });

  it("returns false for non-https", () => {
    expect(isTrustedPhotoUrl("http://photos.zillowstatic.com/fp/abc.jpg")).toBe(
      false
    );
    expect(isTrustedPhotoUrl("ftp://evil.com/img.jpg")).toBe(false);
  });

  it("returns false for non-allowlisted host", () => {
    expect(isTrustedPhotoUrl("https://evil.com/image.jpg")).toBe(false);
    expect(isTrustedPhotoUrl("https://example.org/photo.jpg")).toBe(false);
  });
});

describe("downloadPhotos", () => {
  const fakeJpeg = Buffer.alloc(100, 0xff);

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg" }),
          arrayBuffer: () =>
            Promise.resolve(
              fakeJpeg.buffer.slice(
                fakeJpeg.byteOffset,
                fakeJpeg.byteOffset + fakeJpeg.byteLength
              )
            ),
        })
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns at most maxPhotos", async () => {
    const urls = [
      "https://photos.zillowstatic.com/1.jpg",
      "https://photos.zillowstatic.com/2.jpg",
      "https://photos.zillowstatic.com/3.jpg",
    ];
    const result = await downloadPhotos(urls, "test-listing", { maxPhotos: 2 });
    expect(result).toHaveLength(2);
  });

  it("skips untrusted URLs", async () => {
    const urls = [
      "https://evil.com/1.jpg",
      "https://photos.zillowstatic.com/2.jpg",
    ];
    const result = await downloadPhotos(urls, "test-listing");
    expect(result).toHaveLength(1);
  });

  it("returns DownloadedPhoto with buffer, mimeType, listing-scoped filename", async () => {
    const urls = ["https://photos.zillowstatic.com/ok.jpg"];
    const result = await downloadPhotos(urls, "my-listing");
    expect(result).toHaveLength(1);
    expect(Buffer.isBuffer(result[0].buffer)).toBe(true);
    expect(result[0].mimeType).toBe("image/jpeg");
    expect(result[0].filename).toBe("my-listing-photo-0.jpg");
  });
});
