import { describe, it, expect, afterEach } from "vitest";
import { createProvider, isLLMConfigured } from "@/scripts/lib/llm/config";

const ENV_KEYS = [
  "LLM_PROVIDER",
  "LLM_MODEL",
  "GEMINI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "LLM_API_KEY",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe("isLLMConfigured", () => {
  it("returns false when defaulting to gemini and no API key", () => {
    expect(isLLMConfigured()).toBe(false);
  });

  it("returns true when gemini and GEMINI_API_KEY is set", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    expect(isLLMConfigured()).toBe(true);
  });

  it("returns true when gemini and GOOGLE_AI_API_KEY is set (and GEMINI_API_KEY unset)", () => {
    process.env.GOOGLE_AI_API_KEY = "other-key";
    expect(isLLMConfigured()).toBe(true);
  });

  it("returns false when gemini and API key is empty string", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "";
    expect(isLLMConfigured()).toBe(false);
  });

  it("returns true when ollama and LLM_PROVIDER is set", () => {
    process.env.LLM_PROVIDER = "ollama";
    expect(isLLMConfigured()).toBe(true);
  });

  it("returns false when LLM_MODEL is set but provider defaults to gemini with no key", () => {
    process.env.LLM_MODEL = "gemini-2.5-flash";
    expect(isLLMConfigured()).toBe(false);
  });
});

describe("createProvider", () => {
  it("returns GeminiProvider when LLM_PROVIDER=gemini and GEMINI_API_KEY set", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const provider = createProvider();
    expect(provider.name).toBe("gemini");
    expect(provider.config.model).toBe("gemini-2.5-flash");
    expect(provider.supportsVision).toBe(true);
  });

  it("returns OllamaProvider when LLM_PROVIDER=ollama", () => {
    process.env.LLM_PROVIDER = "ollama";
    const provider = createProvider();
    expect(provider.name).toBe("ollama");
    expect(provider.config.model).toBe("llama3.2-vision");
  });

  it("throws when LLM_PROVIDER=gemini and no API key", () => {
    process.env.LLM_PROVIDER = "gemini";
    expect(() => createProvider()).toThrow(/API key|GEMINI_API_KEY/);
  });

  it("throws when LLM_PROVIDER=gemini and GEMINI_API_KEY is empty", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "";
    expect(() => createProvider()).toThrow(/API key|GEMINI_API_KEY/);
  });

  it("uses GOOGLE_AI_API_KEY when GEMINI_API_KEY not set", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GOOGLE_AI_API_KEY = "google-key";
    const provider = createProvider();
    expect(provider.name).toBe("gemini");
  });

  it("throws for unknown provider", () => {
    process.env.LLM_PROVIDER = "unknown";
    expect(() => createProvider()).toThrow(/Unknown LLM_PROVIDER|Valid values/);
  });

  it("throws for openai (not implemented)", () => {
    process.env.LLM_PROVIDER = "openai";
    expect(() => createProvider()).toThrow(/not yet implemented/);
  });
});

describe("GeminiProvider chat", () => {
  it("throws when messages have no user content (empty user parts)", async () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";
    const provider = createProvider();
    await expect(
      provider.chat([{ role: "system", content: "You are a bot." }])
    ).rejects.toThrow(/at least one user message with content/);
  });
});
