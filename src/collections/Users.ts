import type { CollectionConfig } from "payload";
import { isAdmin } from "@/lib/access";

export const Users: CollectionConfig = {
  slug: "users",
  admin: { useAsTitle: "email" },
  auth: true,
  access: {
    // List requests: id is undefined → only admins can list all users.
    // Single-doc requests: admin or self.
    read: ({ req, id }) =>
      (req.user as { role?: string; id?: string } | null)?.role === "admin" ||
      (id != null && String((req.user as { id?: string } | null)?.id) === String(id)),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
      ],
    },
  ],
};
