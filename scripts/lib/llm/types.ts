export const LLM_PROVIDERS = ["ollama", "openai", "gemini"] as const;
export type LLMProviderName = (typeof LLM_PROVIDERS)[number];

export interface LLMConfig {
  provider: LLMProviderName;
  model: string;
  visionModel?: string;
  baseUrl: string;
  apiKey?: string;
}

export type LLMMessageRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string | LLMContentBlock[];
}

export type LLMContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: Buffer; mimeType: string };

export interface LLMResponse {
  content: string;
  model: string;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  readonly name: string;
  readonly config: LLMConfig;
  readonly supportsVision: boolean;
  chat(
    messages: LLMMessage[],
    options?: {
      jsonSchema?: Record<string, unknown>;
      maxTokens?: number;
    }
  ): Promise<LLMResponse>;
}
