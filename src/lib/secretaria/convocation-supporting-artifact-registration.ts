import { supabase } from "@/integrations/supabase/client";

export interface RegisterSupportingConvocationArtifactInput {
  tenantId: string;
  convocatoriaId: string;
  agendaItemIndex?: number | null;
  fileName: string;
  storageUri: string;
  expectedHashSha256: string;
  expectedHashSha512: string;
  expectedMimeType: string;
}

export interface VerifiedSupportingConvocationArtifact {
  id: string;
  file_name: string;
  file_url: string;
  file_hash: string;
  file_hash_sha512: string;
  artifact_kind: "SUPPORTING_DOCUMENT";
  agenda_item_index: number | null;
  artifact_verified_at: string;
  artifact_verified_by_service: true;
  artifact_verified_size_bytes: number;
  artifact_verified_mime_type: string;
}

interface SupportingRegistrationResponse {
  attachment?: VerifiedSupportingConvocationArtifact;
  error?: string;
}

let liveSessionValidation: Promise<void> | null = null;
let liveSessionValidatedAt = 0;
const LIVE_SESSION_CACHE_MS = 30_000;

async function validateLiveSession(): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (sessionError || !session?.access_token) {
    throw new Error("La sesión de autenticación no está disponible. Vuelve a iniciar sesión antes de custodiar documentos.");
  }

  const { error: userError } = await supabase.auth.getUser(session.access_token);
  if (!userError) {
    liveSessionValidatedAt = Date.now();
    return;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) {
    throw new Error(
      "La sesión de autenticación ya no es válida en el servidor. Vuelve a iniciar sesión antes de custodiar documentos.",
    );
  }
  const { error: refreshedUserError } = await supabase.auth.getUser(
    refreshed.session.access_token,
  );
  if (refreshedUserError) {
    throw new Error(
      "La sesión renovada no pudo validarse en el servidor. Vuelve a iniciar sesión antes de custodiar documentos.",
    );
  }
  liveSessionValidatedAt = Date.now();
}

export function ensureLiveSupabaseSession(): Promise<void> {
  if (Date.now() - liveSessionValidatedAt < LIVE_SESSION_CACHE_MS) {
    return Promise.resolve();
  }
  if (!liveSessionValidation) {
    liveSessionValidation = validateLiveSession().finally(() => {
      liveSessionValidation = null;
    });
  }
  return liveSessionValidation;
}

async function supportingRegistrationError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error);
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.clone !== "function") return fallback;
  try {
    const body = await context.clone().json() as { error?: unknown };
    return typeof body.error === "string" && body.error.trim() ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export async function registerSupportingConvocationArtifact(
  input: RegisterSupportingConvocationArtifactInput,
): Promise<VerifiedSupportingConvocationArtifact> {
  await ensureLiveSupabaseSession();
  const { data, error } = await supabase.functions.invoke<SupportingRegistrationResponse>(
    "convocation-supporting-artifact-register",
    { body: input },
  );
  if (error) {
    throw new Error(
      `No se pudo verificar el adjunto en servidor: ${await supportingRegistrationError(error)}`,
    );
  }
  if (!data?.attachment?.id) {
    throw new Error(data?.error ?? "El servidor no devolvió un adjunto verificado");
  }
  return data.attachment;
}
