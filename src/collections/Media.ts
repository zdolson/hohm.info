import type { CollectionConfig } from "payload";
import { isAdmin } from "@/lib/access";

export const Media: CollectionConfig = {
  slug: "media",
  admin: { useAsTitle: "filename", defaultColumns: ["filename", "mimeType", "updatedAt"] },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: "alt", type: "text", admin: { description: "Accessibility/SEO alt text" } },
    { name: "caption", type: "text" },
  ],
  upload: {
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ],
  },
};
