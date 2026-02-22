import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const requireEnv = (name: string): string => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
};

import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Tags } from "./collections/Tags";
import { Listings } from "./collections/Listings";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

export default buildConfig({
  admin: {
    meta: { titleSuffix: " | hohm.info" },
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, "app/(payload)/admin/importMap.ts"),
    },
    user: Users.slug,
  },
  collections: [Users, Media, Tags, Listings],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: { connectionString: requireEnv("DATABASE_URL") },
  }),
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  },
  sharp,
  secret: requireEnv("PAYLOAD_SECRET"),
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
