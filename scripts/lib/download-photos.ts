import sharp from "sharp";
import type { Payload } from "payload";

const PHOTO_SOURCE_ALLOWLIST = (
  process.env.PHOTO_SOURCE_ALLOWLIST ??
  "zillowstatic.com,photos.zillowstatic.com"
)
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const SAFE_URL_RE = /^https:\/\//i;

export interface DownloadedPhoto {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export function isTrustedPhotoUrl(url: string): boolean {
  if (!SAFE_URL_RE.test(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PHOTO_SOURCE_ALLOWLIST.some(
      (allowed) => host === allowed || host.endsWith("." + allowed)
    );
  } catch {
    return false;
  }
}

const DEFAULT_MAX_PHOTOS = 20;
const TIMEOUT_MS = 10_000;

export async function downloadPhotos(
  urls: string[],
  listingSlug: string,
  opts?: { maxPhotos?: number }
): Promise<DownloadedPhoto[]> {
  const maxPhotos = opts?.maxPhotos ?? DEFAULT_MAX_PHOTOS;
  const results: DownloadedPhoto[] = [];

  for (const url of urls) {
    if (results.length >= maxPhotos) break;
    if (!isTrustedPhotoUrl(url)) {
      console.warn(`[WARN] Skipping untrusted photo URL: ${url}`);
      continue;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        console.warn(`[WARN] Photo fetch failed ${res.status}: ${url}`);
        continue;
      }
      const raw = Buffer.from(await res.arrayBuffer());
      let resized: Buffer = raw;
      try {
        resized = await sharp(raw)
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch {
        // keep original if sharp can't process
      }
      const idx = results.length;
      results.push({
        buffer: resized,
        mimeType: "image/jpeg",
        filename: `${listingSlug}-photo-${idx}.jpg`,
      });
    } catch (err) {
      console.warn(`[WARN] Photo download failed: ${(err as Error).message}`);
    }
  }

  return results.slice(0, maxPhotos);
}

export async function uploadPhotosToMedia(
  photos: DownloadedPhoto[],
  payload: Payload,
  listingSlug: string
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const doc = await payload.create({
      collection: "media",
      data: {
        alt: `Listing photo — ${listingSlug} — ${i + 1}`,
      },
      file: {
        data: p.buffer,
        mimetype: p.mimeType,
        name: p.filename,
        size: p.buffer.length,
      },
      overrideAccess: true,
    });
    ids.push(doc.id as number);
    console.log(`[UPLOADED] ${p.filename}`);
  }
  return ids;
}
