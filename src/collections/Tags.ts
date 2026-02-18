import type { Access, CollectionConfig } from "payload";

const isAdmin: Access = ({ req }) =>
  (req.user as { role?: string } | null)?.role === "admin";

export const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "category"],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true },
    {
      name: "category",
      type: "select",
      options: [
        { label: "Materials", value: "materials" },
        { label: "Systems", value: "systems" },
        { label: "Region", value: "region" },
        { label: "Era", value: "era" },
        { label: "Hazards", value: "hazards" },
      ],
    },
    { name: "description", type: "textarea" },
    { name: "content", type: "richText" },
    {
      name: "resources",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "url", type: "text", required: true },
        {
          name: "type",
          type: "select",
          options: [
            { label: "Link", value: "link" },
            { label: "YouTube", value: "youtube" },
            { label: "Guide", value: "guide" },
            { label: "Cost", value: "cost" },
          ],
        },
      ],
    },
    {
      name: "media",
      type: "upload",
      relationTo: "media",
      hasMany: true,
    },
  ],
};
