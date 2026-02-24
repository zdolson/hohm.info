import fs from "fs/promises";
import path from "path";
import type { Media } from "@/payload-types";

const MEDIA_LOCAL_PATH = process.env.MEDIA_LOCAL_PATH ?? "";
const MEDIA_STORAGE_ORIGINS = (
  process.env.MEDIA_STORAGE_ORIGINS ??
  "http://127.0.0.1:3000,http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean);

function isAllowedOrigin(url: string): boolean {
  try {
    const origin = new URL(url).origin.toLowerCase();
    return MEDIA_STORAGE_ORIGINS.some((allowed) => origin === allowed);
  } catch {
    return false;
  }
}

/**
 * Read media file bytes from Payload storage: local FS (MEDIA_LOCAL_PATH + filename)
 * or remote URL (MEDIA_STORAGE_ORIGINS allowlist). Returns Buffer or null if unreadable.
 */
export async function readMediaBytes(mediaDoc: Media): Promise<Buffer | null> {
  const filename = mediaDoc.filename ?? null;
  if (filename === null || filename === "") {
    return null;
  }

  if (MEDIA_LOCAL_PATH.length > 0) {
    try {
      const mediaRoot = path.resolve(MEDIA_LOCAL_PATH);
      const filePath = path.resolve(mediaRoot, filename);
      if (!filePath.startsWith(mediaRoot + path.sep)) return null;
      const buf = await fs.readFile(filePath);
      return buf;
    } catch {
      return null;
    }
  }

  const url = mediaDoc.url ?? null;
  if (url === null || url === "") {
    return null;
  }

  let resolvedUrl = url;
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    const base = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";
    resolvedUrl =
      base.replace(/\/$/, "") + (url.startsWith("/") ? url : "/" + url);
  }

  if (!isAllowedOrigin(resolvedUrl)) {
    return null;
  }

  try {
    const res = await fetch(resolvedUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Read bytes for multiple media docs; skips failures. Returns buffers in same order as docs (null for failed).
 */
export async function readMediaBytesBatch(
  mediaDocs: Media[]
): Promise<(Buffer | null)[]> {
  return Promise.all(mediaDocs.map((doc) => readMediaBytes(doc)));
}
