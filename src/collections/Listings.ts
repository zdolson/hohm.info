import type { Access, CollectionConfig } from "payload";

const isAdmin: Access = ({ req }) =>
  (req.user as { role?: string } | null)?.role === "admin";

export const Listings: CollectionConfig = {
  slug: "listings",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "city", "state", "beds", "baths", "price", "updatedAt"],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true },
    { name: "address", type: "text" },
    { name: "city", type: "text" },
    { name: "state", type: "text" },
    { name: "region", type: "text" },
    { name: "yearBuilt", type: "number" },
    { name: "price", type: "number" },
    { name: "beds", type: "number" },
    { name: "baths", type: "number" },
    { name: "sqft", type: "number" },
    { name: "garageSpaces", type: "number", min: 0 },
    { name: "summary", type: "textarea" },
    { name: "sourceUrl", type: "text" },
    {
      name: "photos",
      type: "upload",
      relationTo: "media",
      hasMany: true,
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
    },
  ],
};
