import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env, integrations } from "../env";

/**
 * Optional LLM layer (Anthropic). Every caller must have a rules-based
 * fallback: when ANTHROPIC_API_KEY is not set these functions return null and
 * the feature keeps working without AI, labelled generator = "rules".
 */

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!integrations.anthropic()) return null;
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 });
  return client;
}

export function isLlmAvailable(): boolean {
  return integrations.anthropic();
}

interface CommonOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

/** Free-text generation. Returns null when no API key is configured. */
export async function generateText(opts: CommonOptions): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  const response = await c.messages.create({
    model: env().ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    output_config: { effort: opts.effort ?? "medium" },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("El modelo rechazó la petición");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text || null;
}

/** Structured generation validated against a zod schema. Null without API key. */
export async function generateObject<S extends z.ZodType>(
  opts: CommonOptions & { schema: S },
): Promise<z.infer<S> | null> {
  const c = getClient();
  if (!c) return null;
  const response = await c.messages.parse({
    model: env().ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    output_config: { effort: opts.effort ?? "medium", format: zodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("El modelo rechazó la petición");
  if (response.parsed_output == null) throw new Error("La respuesta del modelo no tiene el formato esperado");
  return response.parsed_output as z.infer<S>;
}
