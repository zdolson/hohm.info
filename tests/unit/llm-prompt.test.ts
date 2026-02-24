import { describe, it, expect } from "vitest";
import {
  PROMPT_VERSION,
  buildSystemPrompt,
  buildUserPrompt,
} from "@/scripts/lib/llm/prompt";
import type { TagCategoryValue } from "@/collections/Tags";

describe("PROMPT_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof PROMPT_VERSION).toBe("string");
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });
});

describe("buildSystemPrompt", () => {
  const existingTags = [
    { slug: "ranch", name: "Ranch", category: "style" as TagCategoryValue },
    {
      slug: "brick-exterior",
      name: "Brick Exterior",
      category: "exterior" as TagCategoryValue,
    },
  ];

  it("includes existing tags list", () => {
    const out = buildSystemPrompt({ existingTags, maxNewTags: 30 });
    expect(out).toContain("ranch");
    expect(out).toContain("brick-exterior");
    expect(out).toContain("Ranch");
    expect(out).toContain("Brick Exterior");
  });

  it("includes maxNewTags value", () => {
    const out = buildSystemPrompt({ existingTags, maxNewTags: 10 });
    expect(out).toContain("10");
  });

  it("includes category taxonomy (style, exterior, era)", () => {
    const out = buildSystemPrompt({ existingTags, maxNewTags: 30 });
    expect(out).toContain("style");
    expect(out).toContain("exterior");
    expect(out).toContain("era");
  });
});

describe("buildUserPrompt", () => {
  const listing = {
    slug: "test-listing",
    address: "123 Main St",
    city: "Grand Rapids",
    state: "MI",
    rawAttributes: ["Brick", "Forced Air"],
  };

  it("includes listing address and location", () => {
    const out = buildUserPrompt({ listing });
    expect(out).toContain("123 Main St");
    expect(out).toContain("Grand Rapids");
    expect(out).toContain("MI");
  });

  it("includes rawAttributes", () => {
    const out = buildUserPrompt({ listing });
    expect(out).toContain("Brick");
    expect(out).toContain("Forced Air");
  });
});
