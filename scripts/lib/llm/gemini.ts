import { GoogleGenAI } from "@google/genai";
import type {
  LLMConfig,
  LLMContentBlock,
  LLMMessage,
  LLMProvider,
  LLMResponse,
} from "./types.js";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  readonly config: LLMConfig;
  readonly supportsVision = true;
  private client: GoogleGenAI;

  constructor(config: LLMConfig) {
    const apiKey =
      config.apiKey ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_AI_API_KEY;
    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error(
        "Gemini requires an API key. Set GEMINI_API_KEY or GOOGLE_AI_API_KEY in the environment."
      );
    }
    this.config = config;
    this.client = new GoogleGenAI({ apiKey });
  }

  async chat(
    messages: LLMMessage[],
    options?: {
      jsonSchema?: Record<string, unknown>;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    let systemInstruction: string | undefined;
    const userParts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction =
          typeof msg.content === "string"
            ? msg.content
            : (msg.content as LLMContentBlock[])
                .filter(
                  (b): b is { type: "text"; text: string } => b.type === "text"
                )
                .map((b) => b.text)
                .join("\n");
        continue;
      }
      if (msg.role !== "user") continue;

      if (typeof msg.content === "string") {
        userParts.push({ text: msg.content });
        continue;
      }
      for (const block of msg.content as LLMContentBlock[]) {
        if (block.type === "text") {
          userParts.push({ text: block.text });
        } else {
          userParts.push({
            inlineData: {
              mimeType: block.mimeType ?? "image/jpeg",
              data: block.data.toString("base64"),
            },
          });
        }
      }
    }

    const config: {
      systemInstruction?: string;
      maxOutputTokens?: number;
      responseMimeType?: string;
      responseJsonSchema?: unknown;
    } = {
      maxOutputTokens: options?.maxTokens ?? 4096,
    };
    if (systemInstruction !== undefined && systemInstruction.length > 0) {
      config.systemInstruction = systemInstruction;
    }
    if (options?.jsonSchema !== undefined) {
      config.responseMimeType = "application/json";
      config.responseJsonSchema = options.jsonSchema;
    }

    if (userParts.length === 0) {
      throw new Error(
        "Gemini chat requires at least one user message with content (text or parts)."
      );
    }

    const response = await this.client.models.generateContent({
      model: this.config.model,
      contents: [{ role: "user", parts: userParts }],
      config,
    });

    const text = response.text;
    const content = text !== undefined && text !== null ? String(text) : "";
    const usage = response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    return {
      content,
      model: response.modelVersion ?? this.config.model,
      tokenUsage: { inputTokens, outputTokens },
    };
  }
}
