import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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
    importMap: { baseDir: path.resolve(dirname) },
    user: Users.slug,
  },
  collections: [Users, Media, Tags, Listings],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL! },
  }),
  sharp,
  secret: process.env.PAYLOAD_SECRET!,
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
