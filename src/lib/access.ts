import type { Access } from "payload";

export const isAdmin: Access = ({ req }) =>
  (req.user as { role?: string } | null)?.role === "admin";
