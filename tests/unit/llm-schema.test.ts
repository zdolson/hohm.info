import { describe, it, expect } from "vitest";
import {
  inferenceOutputSchema,
  proposalFileSchema,
  inferenceJsonSchema,
  type InferenceOutput,
} from "@/scripts/lib/llm/schema";

describe("inferenceOutputSchema", () => {
  const validOutput: InferenceOutput = {
    existingTagSlugs: ["ranch", "brick-exterior"],
    newTagProposals: [
      {
        name: "Copper Plumbing",
        slug: "copper-plumbing",
        category: "utilities",
        description: "Copper supply lines.",
        confidence: "medium",
        rationale: "Attribute string.",
      },
    ],
    newCategoryProposals: [],
  };

  it("parses valid inference output", () => {
    expect(inferenceOutputSchema.parse(validOutput)).toEqual(validOutput);
  });

  it("rejects invalid slug in existingTagSlugs", () => {
    expect(() =>
      inferenceOutputSchema.parse({
        ...validOutput,
        existingTagSlugs: ["Invalid Slug"],
      })
    ).toThrow();
  });

  it("rejects invalid category in newTagProposals", () => {
    expect(() =>
      inferenceOutputSchema.parse({
        ...validOutput,
        newTagProposals: [
          {
            ...validOutput.newTagProposals[0],
            category: "invalid-category",
          },
        ],
      })
    ).toThrow();
  });

  it("rejects confidence not in high|medium|low", () => {
    expect(() =>
      inferenceOutputSchema.parse({
        ...validOutput,
        newTagProposals: [
          {
            ...validOutput.newTagProposals[0],
            confidence: "unknown",
          },
        ],
      })
    ).toThrow();
  });

  it("parses newCategoryProposals with reclassification list", () => {
    const withCategory = {
      ...validOutput,
      newCategoryProposals: [
        {
          name: "Plumbing",
          slug: "plumbing",
          justification: "Distinct category.",
          existingTagsToReclassify: ["copper-plumbing", "pex-plumbing"],
        },
      ],
    };
    expect(inferenceOutputSchema.parse(withCategory)).toEqual(withCategory);
  });
});

describe("inferenceJsonSchema", () => {
  it("is a non-empty object for LLM response_format", () => {
    const schema = inferenceJsonSchema as Record<string, unknown>;
    expect(typeof schema).toBe("object");
    expect(schema).not.toBeNull();
  });
});

describe("proposalFileSchema", () => {
  const validProposal = {
    listingSlug: "2115-anderson-dr-se",
    generatedAt: "2026-02-23T14:32:00.000Z",
    provider: "ollama",
    model: "llama3.2-vision:11b",
    inputFingerprint: "5f9a1f2f",
    promptVersion: "v1",
    tokenUsage: { inputTokens: 1842, outputTokens: 318 },
    photosAnalyzed: 4,
    existingTagSlugs: ["ranch", "brick-exterior"],
    newTagProposals: [],
    newCategoryProposals: [],
  };

  it("parses valid proposal file", () => {
    expect(proposalFileSchema.parse(validProposal)).toEqual(validProposal);
  });

  it("rejects invalid listingSlug", () => {
    expect(() =>
      proposalFileSchema.parse({ ...validProposal, listingSlug: "bad slug" })
    ).toThrow();
  });

  it("rejects missing required fields", () => {
    expect(() =>
      proposalFileSchema.parse({
        listingSlug: validProposal.listingSlug,
        // missing generatedAt, provider, etc.
      })
    ).toThrow();
  });
});
