import { supabase } from "@/integrations/supabase/client";
import { capa3ValueToText } from "@/lib/secretaria/capa3-fields";
import type {
  Capa3DraftAssistantProviderInput,
  Capa3DraftAssistantProviderOutput,
  SuggestCapa3DraftInput,
  SuggestCapa3DraftResult,
} from "./capa3-draft-assistant";
import { suggestCapa3Draft } from "./capa3-draft-assistant";
import type {
  ActaDraftPolishProviderInput,
  ActaDraftPolishProviderOutput,
  SuggestActaDraftPolishInput,
  ActaDraftPolishResult,
} from "./document-composer-harness";
import { suggestActaDraftPolish } from "./document-composer-harness";

const EDGE_FUNCTION_NAME = "openai-capa3-document-copilot";
const SENSITIVE_KEY = /(api[_-]?key|token|secret|password|email|nif|cif|tax[_-]?id)/i;

type CopilotTask = "CAPA3_FIELDS" | "ACTA_DRAFT_POLISH";

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.slice(0, 6000);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value !== "object") return "";

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 160)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(raw, depth + 1);
  }
  return output;
}

function stringValue(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseCapa3Output(value: unknown): Capa3DraftAssistantProviderOutput {
  const payload = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const rawValues = payload.values && typeof payload.values === "object" && !Array.isArray(payload.values)
    ? payload.values as Record<string, unknown>
    : {};
  const values = Object.fromEntries(
    Object.entries(rawValues)
      .filter(([, fieldValue]) => typeof fieldValue === "string" && fieldValue.trim().length > 0)
      .map(([key, fieldValue]) => [key, (fieldValue as string).trim()]),
  );

  return {
    values,
    modelName: stringValue(payload.modelName, 120) || "openai-capa3-copilot",
  };
}

function parseActaOutput(value: unknown): ActaDraftPolishProviderOutput {
  const payload = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const proposals = Array.isArray(payload.proposals)
    ? payload.proposals
      .filter((proposal): proposal is Record<string, unknown> =>
        !!proposal && typeof proposal === "object" && !Array.isArray(proposal)
      )
      .map((proposal) => ({
        target: stringValue(proposal.target, 120),
        currentText: stringValue(proposal.currentText),
        proposedText: stringValue(proposal.proposedText),
        reason: stringValue(proposal.reason, 600),
        confidence: typeof proposal.confidence === "number" ? proposal.confidence : 0.5,
        requiresHumanReview: true as const,
      }))
    : [];

  return {
    proposals: proposals as ActaDraftPolishProviderOutput["proposals"],
    summary: stringValue(payload.summary, 800),
    modelName: stringValue(payload.modelName, 120),
    promptVersion: stringValue(payload.promptVersion, 120),
  };
}

export function sanitizeOpenAiCapa3CopilotInput<T extends Record<string, unknown>>(input: T): T {
  return sanitizeValue(input) as T;
}

export function sanitizeOpenAiCapa3DraftInput(
  input: Capa3DraftAssistantProviderInput,
): Capa3DraftAssistantProviderInput {
  return {
    ...input,
    currentValues: Object.fromEntries(
      Object.entries(input.currentValues).map(([key, value]) => [key, capa3ValueToText(value).slice(0, 4000)]),
    ),
    baseVariables: sanitizeValue(input.baseVariables) as Record<string, unknown>,
  };
}

export function sanitizeOpenAiActaComposerInput(
  input: ActaDraftPolishProviderInput,
): ActaDraftPolishProviderInput {
  return {
    ...input,
    text: input.text.slice(0, 30000),
    actaLegalStructure: sanitizeValue(input.actaLegalStructure) as ActaDraftPolishProviderInput["actaLegalStructure"],
    allowedTargets: input.allowedTargets,
    maxProposals: input.maxProposals,
  };
}

async function invokeCopilot(task: CopilotTask, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_NAME, {
    body: {
      task,
      ...body,
    },
  });
  if (error) throw error;
  return data;
}

export async function invokeOpenAiCapa3DraftProvider(
  input: Capa3DraftAssistantProviderInput,
): Promise<Capa3DraftAssistantProviderOutput> {
  const data = await invokeCopilot("CAPA3_FIELDS", sanitizeOpenAiCapa3DraftInput(input) as unknown as Record<string, unknown>);
  return parseCapa3Output(data);
}

export async function invokeOpenAiActaDraftPolishProvider(
  input: ActaDraftPolishProviderInput,
): Promise<ActaDraftPolishProviderOutput> {
  const data = await invokeCopilot("ACTA_DRAFT_POLISH", sanitizeOpenAiActaComposerInput(input) as unknown as Record<string, unknown>);
  return parseActaOutput(data);
}

export async function suggestCapa3DraftWithOpenAIFallback(
  input: SuggestCapa3DraftInput,
): Promise<SuggestCapa3DraftResult> {
  try {
    return await suggestCapa3Draft({
      ...input,
      provider: invokeOpenAiCapa3DraftProvider,
    });
  } catch {
    // Function not deployed, missing secret, network issue, or provider validation.
    // Keep the editor usable and deterministic.
  }

  return suggestCapa3Draft(input);
}

export async function suggestActaDraftPolishWithCapa3CopilotFallback(
  input: SuggestActaDraftPolishInput,
): Promise<ActaDraftPolishResult> {
  try {
    return await suggestActaDraftPolish({
      ...input,
      provider: invokeOpenAiActaDraftPolishProvider,
    });
  } catch {
    // Function not deployed, missing secret, provider refusal, network issue or schema error.
    // Keep the editor usable and deterministic.
  }

  return suggestActaDraftPolish(input);
}

export const invokeOpenAiActaComposerProvider = invokeOpenAiActaDraftPolishProvider;
export const suggestActaDraftPolishWithOpenAIFallback = suggestActaDraftPolishWithCapa3CopilotFallback;
