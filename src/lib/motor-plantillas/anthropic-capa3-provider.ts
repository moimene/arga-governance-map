import { supabase } from "@/integrations/supabase/client";
import type {
  Capa3DraftAssistantProviderInput,
  Capa3DraftAssistantProviderOutput,
  SuggestCapa3DraftInput,
  SuggestCapa3DraftResult,
} from "./capa3-draft-assistant";
import { suggestCapa3Draft } from "./capa3-draft-assistant";

const EDGE_FUNCTION_NAME = "anthropic-capa3-draft-assistant";
const SENSITIVE_KEY = /(api[_-]?key|token|secret|password|email|nif|cif|tax[_-]?id)/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, 1200);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return "";

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(raw, depth + 1);
  }
  return output;
}

export function sanitizeCapa3ProviderInput(
  input: Capa3DraftAssistantProviderInput,
): Capa3DraftAssistantProviderInput {
  return {
    ...input,
    currentValues: Object.fromEntries(
      Object.entries(input.currentValues).map(([key, value]) => [key, value.slice(0, 4000)]),
    ),
    baseVariables: sanitizeValue(input.baseVariables) as Record<string, unknown>,
  };
}

export async function invokeAnthropicCapa3DraftProvider(
  input: Capa3DraftAssistantProviderInput,
): Promise<Capa3DraftAssistantProviderOutput> {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
    body: sanitizeCapa3ProviderInput(input),
  });
  if (error) throw error;

  const payload = data as { values?: Record<string, unknown>; modelName?: string } | null;
  const values = Object.fromEntries(
    Object.entries(payload?.values ?? {})
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
      .map(([key, value]) => [key, (value as string).trim()]),
  );

  return {
    values,
    modelName: payload?.modelName ?? "anthropic-claude",
  };
}

export async function suggestCapa3DraftWithAnthropicFallback(
  input: SuggestCapa3DraftInput,
): Promise<SuggestCapa3DraftResult> {
  try {
    const result = await suggestCapa3Draft({
      ...input,
      provider: invokeAnthropicCapa3DraftProvider,
    });
    if (result.suggestions.length > 0) return result;
  } catch {
    // Function not deployed, missing secret, network issue, or provider validation.
    // Keep the demo flow deterministic and non-blocking.
  }

  return suggestCapa3Draft(input);
}
