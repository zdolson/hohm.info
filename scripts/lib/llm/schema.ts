import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { tagCategoryOptions } from "@/collections/Tags";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const categoryValues = tagCategoryOptions.map((o) => o.value);

const newTagProposalSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_RE),
  category: z.enum(categoryValues as [string, ...string[]]),
  description: z.string().min(1).max(500),
  confidence: z.enum(["high", "medium", "low"]),
  rationale: z.string().min(1).max(500),
});

const newCategoryProposalSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(SLUG_RE),
  justification: z.string().min(1).max(500),
  existingTagsToReclassify: z.array(z.string().regex(SLUG_RE)),
});

export const inferenceOutputSchema = z.object({
  existingTagSlugs: z.array(z.string().regex(SLUG_RE)),
  newTagProposals: z.array(newTagProposalSchema),
  newCategoryProposals: z.array(newCategoryProposalSchema),
});

export type InferenceOutput = z.infer<typeof inferenceOutputSchema>;

export const inferenceJsonSchema = zodToJsonSchema(inferenceOutputSchema, {
  name: "InferenceOutput",
  $refStrategy: "none",
}) as Record<string, unknown>;

export const proposalFileSchema = z.object({
  listingSlug: z.string().regex(SLUG_RE),
  generatedAt: z.string(),
  provider: z.string(),
  model: z.string(),
  inputFingerprint: z.string().min(1),
  promptVersion: z.string().min(1),
  tokenUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
  }),
  photosAnalyzed: z.number().int().min(0),
  existingTagSlugs: z.array(z.string().regex(SLUG_RE)),
  newTagProposals: z.array(newTagProposalSchema),
  newCategoryProposals: z.array(newCategoryProposalSchema),
});
