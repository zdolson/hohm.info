import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";

import { Users } from "./collections/Users";

const __filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(__filename);

export default buildConfig({
  admin: {
    meta: { titleSuffix: " | hohm.info" },
    importMap: { baseDir: path.resolve(dirname) },
    user: Users.slug,
  },
  collections: [Users],
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL! },
  }),
  secret: process.env.PAYLOAD_SECRET!,
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000",
  typescript: { outputFile: path.resolve(dirname, "payload-types.ts") },
});
