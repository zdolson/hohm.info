import { describe, it, expect } from "vitest";
import { computeInputFingerprint } from "@/scripts/lib/ai-tag-inference";
import type { InferenceInput } from "@/scripts/lib/ai-tag-inference";

describe("computeInputFingerprint", () => {
  const baseInput: InferenceInput = {
    listing: {
      slug: "test-listing",
      address: "123 Main St",
      city: "Grand Rapids",
      state: "MI",
      rawAttributes: ["Brick", "Forced Air"],
    },
    photos: [Buffer.from("fake-jpeg-1"), Buffer.from("fake-jpeg-2")],
    existingTags: [
      { slug: "ranch", name: "Ranch", category: "style" },
      {
        slug: "brick-exterior",
        name: "Brick Exterior",
        category: "exterior",
      },
    ],
  };

  it("returns a non-empty string", () => {
    const fp = computeInputFingerprint(baseInput, "ollama", "llama3.2", "v1");
    expect(typeof fp).toBe("string");
    expect(fp.length).toBeGreaterThan(0);
  });

  it("same normalized input yields same fingerprint", () => {
    const fp1 = computeInputFingerprint(baseInput, "ollama", "llama3.2", "v1");
    const fp2 = computeInputFingerprint(baseInput, "ollama", "llama3.2", "v1");
    expect(fp1).toBe(fp2);
  });

  it("different listing slug yields different fingerprint", () => {
    const fp1 = computeInputFingerprint(baseInput, "ollama", "llama3.2", "v1");
    const input2: InferenceInput = {
      ...baseInput,
      listing: { ...baseInput.listing, slug: "other-listing" },
    };
    const fp2 = computeInputFingerprint(input2, "ollama", "llama3.2", "v1");
    expect(fp1).not.toBe(fp2);
  });

  it("different rawAttributes order yields same fingerprint (normalized)", () => {
    const inputA: InferenceInput = {
      ...baseInput,
      listing: {
        ...baseInput.listing,
        rawAttributes: ["Brick", "Forced Air"],
      },
    };
    const inputB: InferenceInput = {
      ...baseInput,
      listing: {
        ...baseInput.listing,
        rawAttributes: ["Forced Air", "Brick"],
      },
    };
    const fpA = computeInputFingerprint(inputA, "ollama", "llama3.2", "v1");
    const fpB = computeInputFingerprint(inputB, "ollama", "llama3.2", "v1");
    expect(fpA).toBe(fpB);
  });

  it("different provider or promptVersion yields different fingerprint", () => {
    const fpOllama = computeInputFingerprint(baseInput, "ollama", "m", "v1");
    const fpOpenAI = computeInputFingerprint(baseInput, "openai", "m", "v1");
    const fpV2 = computeInputFingerprint(baseInput, "ollama", "m", "v2");
    expect(fpOllama).not.toBe(fpOpenAI);
    expect(fpOllama).not.toBe(fpV2);
  });
});
