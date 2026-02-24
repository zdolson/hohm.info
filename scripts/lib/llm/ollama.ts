import OpenAI from "openai";
import type {
  LLMConfig,
  LLMContentBlock,
  LLMMessage,
  LLMProvider,
  LLMResponse,
} from "./types.js";

const VISION_DESCRIPTION_SYSTEM =
  "Describe exterior materials, roof type, garage, yard features, and any notable architectural details visible in these photos. Be concise; output plain text only.";

function toOpenAIMessages(
  messages: LLMMessage[]
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === "string") {
      return { role: m.role, content: m.content };
    }
    const parts: OpenAI.ChatCompletionContentPart[] = [];
    for (const block of m.content) {
      if (block.type === "text") {
        parts.push({ type: "text", text: block.text });
      } else {
        const b64 = block.data.toString("base64");
        const mime = block.mimeType ?? "image/jpeg";
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${mime};base64,${b64}`,
          },
        });
      }
    }
    return { role: m.role, content: parts };
  }) as OpenAI.ChatCompletionMessageParam[];
}

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  readonly config: LLMConfig;
  readonly supportsVision: boolean;
  private client: OpenAI;

  constructor(config: LLMConfig) {
    this.config = config;
    this.supportsVision =
      config.visionModel !== undefined && config.visionModel.length > 0;
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey ?? "ollama",
    });
  }

  async chat(
    messages: LLMMessage[],
    options?: {
      jsonSchema?: Record<string, unknown>;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const { model, visionModel } = this.config;
    const hasImages = messages.some(
      (m) =>
        Array.isArray(m.content) && m.content.some((b) => b.type === "image")
    );

    if (
      hasImages &&
      visionModel !== undefined &&
      visionModel.length > 0 &&
      visionModel !== model
    ) {
      return this.twoPassChat(messages, options);
    }
    return this.singlePassChat(messages, model, options);
  }

  private async twoPassChat(
    messages: LLMMessage[],
    options?: {
      jsonSchema?: Record<string, unknown>;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const { model, visionModel } = this.config;
    const visionMsg = messages.find(
      (m) =>
        Array.isArray(m.content) && m.content.some((b) => b.type === "image")
    );
    if (visionMsg === undefined || !Array.isArray(visionMsg.content)) {
      return this.singlePassChat(messages, model, options);
    }
    const imageOnlyContent = (visionMsg.content as LLMContentBlock[]).filter(
      (b) => b.type === "image"
    );
    const visionOnly: LLMMessage[] = [
      { role: "system", content: VISION_DESCRIPTION_SYSTEM },
      { role: visionMsg.role, content: imageOnlyContent },
    ];
    const visionResp = await this.singlePassChat(
      visionOnly,
      visionModel!,
      undefined
    );
    const photoObservations = `## Photo observations\n${visionResp.content}`;
    const textMessages: LLMMessage[] = messages.map((m) => {
      if (m !== visionMsg) return m;
      const textParts = (m.content as LLMContentBlock[]).filter(
        (b) => b.type === "text"
      );
      const text = textParts
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");
      return {
        role: m.role,
        content: `${text}\n\n${photoObservations}`,
      };
    });
    return this.singlePassChat(textMessages, model, options);
  }

  private async singlePassChat(
    messages: LLMMessage[],
    model: string,
    options?: {
      jsonSchema?: Record<string, unknown>;
      maxTokens?: number;
    }
  ): Promise<LLMResponse> {
    const openAIMessages = toOpenAIMessages(messages);
    const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: openAIMessages,
      max_tokens: options?.maxTokens ?? 4096,
    };
    if (options?.jsonSchema !== undefined) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "inference",
          schema: options.jsonSchema as Record<string, unknown>,
          strict: true,
        },
      };
    }
    const completion = await this.client.chat.completions.create(body);
    const choice = completion.choices?.[0];
    const content =
      choice?.message?.content !== undefined && choice.message.content !== null
        ? String(choice.message.content)
        : "";
    const usage = completion.usage;
    return {
      content,
      model: completion.model ?? model,
      tokenUsage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
      },
    };
  }
}
