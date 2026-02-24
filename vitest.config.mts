import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/unit/**/*.test.tsx",
      "tests/integration/**/*.test.ts",
    ],
    globals: true,
  },
  resolve: {
    alias: [
      { find: "@/scripts", replacement: path.resolve(__dirname, "./scripts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
