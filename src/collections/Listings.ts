import type { Access, CollectionConfig } from "payload";

const isAdmin: Access = ({ req }) =>
  (req.user as { role?: string } | null)?.role === "admin";

const listingEventTypeOptions = [
  { label: "Listed for Sale", value: "listed" },
  { label: "Price Change", value: "priceChange" },
  { label: "Pending", value: "pending" },
  { label: "Back on Market", value: "active" },
  { label: "Sold", value: "sold" },
  { label: "Listed for Rent", value: "listedForRent" },
  { label: "Listing Removed", value: "listingRemoved" },
];

const propertyTypeOptions = [
  { label: "Single Family", value: "singleFamily" },
  { label: "Condo", value: "condo" },
  { label: "Townhouse", value: "townhouse" },
  { label: "Multi Family", value: "multiFamily" },
  { label: "Land", value: "land" },
  { label: "Mobile Home", value: "mobileHome" },
];

const statusOptions = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Sold", value: "sold" },
  { label: "Off Market", value: "offMarket" },
];

export const Listings: CollectionConfig = {
  slug: "listings",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "city", "state", "price", "updatedAt"],
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
    { name: "garageSpaces", type: "number", min: 0 },
    { name: "summary", type: "textarea" },
    { name: "sourceUrl", type: "text" },
    {
      type: "group",
      name: "location",
      label: "Location",
      fields: [
        { name: "zipCode", type: "text" },
        { name: "county", type: "text" },
      ],
    },
    {
      type: "group",
      name: "property",
      label: "Property",
      fields: [
        {
          name: "propertyType",
          type: "select",
          options: propertyTypeOptions,
        },
        {
          name: "status",
          type: "select",
          options: statusOptions,
        },
        { name: "stories", type: "number" },
      ],
    },
    {
      type: "group",
      name: "interior",
      label: "Interior",
      fields: [
        { name: "bedrooms", type: "number" },
        { name: "bathroomsFull", type: "number" },
        { name: "bathroomsHalf", type: "number", defaultValue: 0 },
        { name: "squareFootage", type: "number" },
        { name: "fireplaces", type: "number", defaultValue: 0 },
      ],
    },
    {
      type: "group",
      name: "lot",
      label: "Lot",
      fields: [{ name: "lotSize", type: "number" }],
    },
    {
      type: "group",
      name: "financial",
      label: "Financial",
      fields: [
        { name: "annualTaxes", type: "number" },
        { name: "taxYear", type: "number" },
      ],
    },
    {
      name: "listingEvents",
      type: "array",
      admin: { description: "Price/status history; price and status at root are denormalized for filtering." },
      fields: [
        { name: "date", type: "date", required: true },
        {
          name: "eventType",
          type: "select",
          required: true,
          options: listingEventTypeOptions,
        },
        { name: "price", type: "number" },
        { name: "source", type: "text" },
        { name: "mlsNumber", type: "text" },
      ],
    },
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
