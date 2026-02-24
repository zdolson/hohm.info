import { describe, it, expect, vi } from "vitest";
import { applyProposal } from "@/scripts/lib/apply-proposal";
import type { InferenceOutput } from "@/scripts/lib/llm/schema";

function mockPayload(overrides?: { createId?: number; createSlug?: string }) {
  return {
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({
      id: overrides?.createId ?? 99,
      slug: overrides?.createSlug ?? "new-tag",
    }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
  };
}

describe("applyProposal", () => {
  const catalogSlugToId = new Map<string, number>([
    ["ranch", 1],
    ["brick-exterior", 2],
  ]);

  const result: InferenceOutput = {
    existingTagSlugs: ["ranch", "brick-exterior"],
    newTagProposals: [
      {
        name: "New Tag",
        slug: "new-tag",
        category: "features",
        description: "A new tag.",
        confidence: "high",
        rationale: "Evidence.",
      },
    ],
    newCategoryProposals: [],
  };

  it("with dryRun does not call payload.update or create", async () => {
    const payload = mockPayload();
    await applyProposal(
      10,
      [],
      result,
      new Map(catalogSlugToId),
      payload as never,
      {
        dryRun: true,
        maxNewTags: 30,
      }
    );
    expect(payload.update).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();
  });

  it("resolves existingTagSlugs and creates new tags", async () => {
    const payload = mockPayload();
    const catalog = new Map(catalogSlugToId);
    await applyProposal(10, [1], result, catalog, payload as never, {
      dryRun: false,
      maxNewTags: 30,
    });
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "listings",
        id: 10,
        data: expect.objectContaining({
          tags: expect.arrayContaining([1, 2, 99]),
        }),
      })
    );
    expect(catalog.get("new-tag")).toBe(99);
  });

  it("enforces maxNewTags limit", async () => {
    const manyNew: InferenceOutput = {
      existingTagSlugs: [],
      newTagProposals: Array.from({ length: 5 }, (_, i) => ({
        name: `Tag ${i}`,
        slug: `tag-${i}`,
        category: "features" as const,
        description: "D",
        confidence: "high" as const,
        rationale: "R",
      })),
      newCategoryProposals: [],
    };
    let callCount = 0;
    const payload = {
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          id: 100 + callCount,
          slug: `tag-${callCount - 1}`,
        });
      }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    };
    await applyProposal(10, [], manyNew, new Map(), payload as never, {
      dryRun: false,
      maxNewTags: 2,
    });
    expect(payload.create).toHaveBeenCalledTimes(2);
  });

  it("falls back to slugify(name) when LLM slug is invalid", async () => {
    const badSlug: InferenceOutput = {
      existingTagSlugs: [],
      newTagProposals: [
        {
          name: "Good Name",
          slug: "INVALID SLUG",
          category: "features",
          description: "D",
          confidence: "high",
          rationale: "R",
        },
      ],
      newCategoryProposals: [],
    };
    const payload = mockPayload({ createId: 50, createSlug: "good-name" });
    const catalog = new Map<string, number>();
    await applyProposal(10, [], badSlug, catalog, payload as never, {
      dryRun: false,
      maxNewTags: 10,
    });
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "good-name" }),
      })
    );
    expect(catalog.get("good-name")).toBe(50);
  });
});
