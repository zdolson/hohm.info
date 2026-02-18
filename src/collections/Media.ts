import type { Access, CollectionConfig } from "payload";

const isAdmin: Access = ({ req }) =>
  (req.user as { role?: string } | null)?.role === "admin";

export const Media: CollectionConfig = {
  slug: "media",
  admin: { useAsTitle: "filename", defaultColumns: ["filename", "mimeType", "updatedAt"] },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    mimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ],
  },
  fields: [],
};
