import type { CollectionConfig } from "payload";
import { isAdmin } from "@/lib/access";
import { slug, safeUrl } from "@/lib/validate";

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
    { name: "slug", type: "text", required: true, unique: true, validate: slug },
    { name: "address", type: "text" },
    { name: "city", type: "text" },
    { name: "state", type: "text" },
    { name: "region", type: "text" },
    { name: "yearBuilt", type: "number", min: 0 },
    { name: "price", type: "number", min: 0 },
    { name: "garageSpaces", type: "number", min: 0 },
    { name: "summary", type: "textarea" },
    { name: "sourceUrl", type: "text", validate: safeUrl },
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
        { name: "stories", type: "number", min: 0 },
      ],
    },
    {
      type: "group",
      name: "interior",
      label: "Interior",
      fields: [
        { name: "bedrooms", type: "number", min: 0 },
        { name: "bathroomsFull", type: "number", min: 0 },
        { name: "bathroomsHalf", type: "number", min: 0, defaultValue: 0 },
        { name: "squareFootage", type: "number", min: 0 },
        { name: "fireplaces", type: "number", min: 0, defaultValue: 0 },
      ],
    },
    {
      type: "group",
      name: "lot",
      label: "Lot",
      fields: [{ name: "lotSize", type: "number", min: 0 }],
    },
    {
      type: "group",
      name: "financial",
      label: "Financial",
      fields: [
        { name: "annualTaxes", type: "number", min: 0 },
        { name: "taxYear", type: "number", min: 0 },
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
        { name: "price", type: "number", min: 0 },
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
