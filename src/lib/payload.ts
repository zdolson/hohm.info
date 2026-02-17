import "server-only";
import { getPayload as getPayloadInstance } from "payload";
import config from "@payload-config";

let cached: Awaited<ReturnType<typeof getPayloadInstance>> | null = null;

export async function getPayload() {
  if (cached) return cached;
  cached = await getPayloadInstance({ config });
  return cached;
}
