// =============================================================
// F3.G3 — Edge Function: sign-evidence-url
// Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §5
// =============================================================
//
// Recibe { bundle_id } y devuelve { url, expires_at } con signed URL al
// objeto de matter-documents. Reemplaza el patrón anti-pattern
// `supabase.storage.getPublicUrl(...)` que estaba en frontend (3 sites).
//
// Authz:
//   - Requiere Bearer token de un user autenticado (no anon).
//   - Verifica que el bundle existe + RLS pasa (tenant matches).
//   - Verifica legal_hold = false.
//   - Verifica estado del bundle no es ARCHIVED-PENDIENTE-LEGAL.
//
// Storage path:
//   - Prefiere evidence_bundles.storage_path (forma nueva F3.G15).
//   - Fallback: extrae path desde document_url legacy si presente.
//
// Signed URL TTL: 300s (5 min). Refresh client-side mediante el hook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SIGNED_URL_TTL_SECONDS = 300; // 5 min
const BUCKET = "matter-documents";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function extractPathFromDocumentUrl(documentUrl: string | null): string | null {
  if (!documentUrl) return null;
  // Acepta los dos patrones de Supabase Storage URLs:
  //   /storage/v1/object/public/matter-documents/<path>
  //   /storage/v1/object/sign/matter-documents/<path>?token=...
  const match = documentUrl.match(/\/(?:public|sign)\/matter-documents\/([^?]+)/);
  return match ? match[1] : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method not allowed" });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(401, { error: "missing bearer token" });
  }

  let payload: { bundle_id?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid json body" });
  }
  const bundleId = payload.bundle_id;
  if (!bundleId || typeof bundleId !== "string") {
    return jsonResponse(400, { error: "bundle_id required" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: "edge function misconfigured" });
  }

  // 1) Cliente con JWT del caller — RLS filtra por tenant.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(401, { error: "invalid or expired token" });
  }

  // 2) Lectura del bundle (RLS aplica — F6 cerró que evidence_bundles tiene
  // RLS explícita activa). Se selecciona también `status` para que el gate
  // de §3 sea efectivo (P1 #9 del adversarial review).
  const { data: bundle, error: bundleError } = await userClient
    .from("evidence_bundles")
    .select("id, tenant_id, agreement_id, storage_path, document_url, legal_hold, source_module, status")
    .eq("id", bundleId)
    .maybeSingle();

  if (bundleError) {
    return jsonResponse(500, { error: "lookup failed", detail: bundleError.message });
  }
  if (!bundle) {
    return jsonResponse(404, { error: "bundle not found or access denied" });
  }

  // 3) Legal hold + status gate (F6 fix P1 #9 — antes la función decía que
  // bloqueaba ARCHIVED-PENDIENTE-LEGAL pero solo miraba legal_hold).
  if (bundle.legal_hold === true) {
    return jsonResponse(403, { error: "legal hold active on this bundle" });
  }
  const releasableStatuses = new Set(["OPEN", "PROMOTED", "ARCHIVED-RELEASED"]);
  if (bundle.status && !releasableStatuses.has(bundle.status)) {
    return jsonResponse(403, {
      error: "bundle status does not permit download",
      status: bundle.status,
    });
  }

  // 4) Resolver storage_path: forma nueva primero, legacy extract si no.
  let storagePath: string | null = bundle.storage_path;
  if (!storagePath) {
    storagePath = extractPathFromDocumentUrl(bundle.document_url);
  }
  if (!storagePath) {
    return jsonResponse(404, { error: "bundle has no storage_path or extractable document_url" });
  }

  // 5) Defensa contra path traversal — cubre ., %2E, case-insensitive.
  const lowered = storagePath.toLowerCase();
  if (
    storagePath.includes("..") ||
    storagePath.startsWith("/") ||
    lowered.includes("%2e%2e") ||
    lowered.includes("%2f") ||
    storagePath.includes("\\")
  ) {
    return jsonResponse(400, { error: "invalid storage_path" });
  }

  // 6) F6 fix P0 #4 — el storage_path DEBE empezar con el tenant_id del
  // bundle. Sin esto, un attacker que pueda crear un evidence_bundle con
  // storage_path apuntando a `<victim>/<...>` obtendría signed URL del
  // tenant víctima. La RLS bloquea el SELECT cross-tenant, pero el path en
  // sí no validaba que pertenece a ese tenant — bug independiente de RLS.
  if (!storagePath.startsWith(`${bundle.tenant_id}/`)) {
    return jsonResponse(403, {
      error: "storage_path does not belong to bundle tenant",
    });
  }

  // 6) Firmar via service_role (única ruta con privilegio para signed URLs).
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: signed, error: signError } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    return jsonResponse(500, {
      error: "signing failed",
      detail: signError?.message ?? "no signed URL returned",
    });
  }

  return jsonResponse(200, {
    url: signed.signedUrl,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    bundle_id: bundleId,
  });
});
