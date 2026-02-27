import type { LLMConfig, LLMProvider } from "./types.js";
import { LLM_PROVIDERS } from "./types.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";

function getProviderName(): string {
  const raw = process.env.LLM_PROVIDER ?? "gemini";
  return String(raw).toLowerCase();
}

export function createProvider(): LLMProvider {
  const rawProvider = getProviderName();
  if (!LLM_PROVIDERS.includes(rawProvider as (typeof LLM_PROVIDERS)[number])) {
    throw new Error(
      `Unknown LLM_PROVIDER: "${rawProvider}". Valid values: ${LLM_PROVIDERS.join(", ")}`
    );
  }
  const provider = rawProvider as (typeof LLM_PROVIDERS)[number];
  const model =
    process.env.LLM_MODEL ??
    (provider === "gemini" ? "gemini-2.5-flash" : "llama3.2-vision");
  const visionModel = process.env.LLM_VISION_MODEL ?? model;
  const baseUrl = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
  const apiKey =
    provider === "gemini"
      ? (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY)
      : process.env.LLM_API_KEY;

  const config: LLMConfig = {
    provider,
    model,
    visionModel: visionModel.length > 0 ? visionModel : undefined,
    baseUrl,
    apiKey,
  };

  switch (provider) {
    case "gemini":
      return new GeminiProvider(config);
    case "ollama":
      return new OllamaProvider(config);
    case "openai":
      throw new Error(`LLM_PROVIDER "${provider}" is not yet implemented`);
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}

/** Returns true if LLM env vars are configured. Used to skip inference gracefully. */
export function isLLMConfigured(): boolean {
  const provider = getProviderName();
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
    return key !== undefined && key.length > 0;
  }
  return (
    process.env.LLM_PROVIDER !== undefined ||
    process.env.LLM_MODEL !== undefined
  );
}
