import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260720139000_secretaria_server_package_and_ead_callback_identity.sql",
);
const packageProbe = read(
  "supabase/tests/secretaria_convocation_manifest_emit_rpc_probe.sql",
);
const callbackProbe = read(
  "supabase/tests/secretaria_convocation_dispatch_hardening_probe.sql",
);
const webhook = read("supabase/functions/webhook-ead-trust/index.ts");

function sqlFunction(name: string): string {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("paquete de convocatoria server-rendered", () => {
  const binding = sqlFunction("fn_communication_authoritative_binding_valid");

  it("conserva todos los gates del agregado y exige el hash actual del paquete", () => {
    expect(binding).toContain("fn_communication_authoritative_binding_valid_201320");
    expect(binding).toContain("fn_communication_census_binding_valid");
    expect(binding).toContain("fn_communication_compute_package_hash");
    expect(binding).toContain("communication_attachment.size_bytes IS DISTINCT FROM");
    expect(binding).toContain("communication_attachment.mime_type IS DISTINCT FROM");
  });

  it("acepta el final solo por manifest server-side exacto, nunca por candidato browser", () => {
    expect(binding).toContain("source_attachment.artifact_candidate_id IS NOT NULL");
    expect(binding).toContain("source_attachment.convocation_manifest_hash_sha512");
    expect(binding).toContain("manifest.manifest_hash_sha512 = encode(");
    expect(binding).toContain("manifest.manifest_json ->> 'reviewed_demo_draft_text'");
    expect(binding).toContain("reviewed_demo_draft_text_hash_sha256");
    expect(binding).toContain("manifest.data_class = 'DEMO'");
    expect(binding).toContain("manifest.legal_effect = 'DEMO_SIMULATION_NO_LEGAL_EFFECT'");
    expect(binding).not.toContain("convocation_artifact_candidates");
  });

  it("incluye un probe transaccional del paquete completo", () => {
    expect(packageProbe).toContain("v_package_attachments");
    expect(packageProbe).toContain("v_package_recipients");
    expect(packageProbe).toContain("fn_crear_censo_snapshot");
    expect(packageProbe).toContain("fn_create_communication_atomic");
    expect(packageProbe).toContain(
      "public.fn_communication_authoritative_binding_valid(v_communication_id) IS TRUE",
    );
    expect(packageProbe).toContain("source_attachment.artifact_candidate_id IS NULL");
    expect(packageProbe).toContain("source_attachment.convocation_manifest_hash_sha512 =");
    expect(packageProbe).toContain("v_manifest.manifest_json ->> 'reviewed_demo_draft_text'");
    expect(packageProbe).not.toContain("approved_convocation_text");
    expect(packageProbe).toContain("ROLLBACK;");
  });
});

describe("identidad exacta del callback EAD Notice Manager", () => {
  const callback = sqlFunction("fn_recipient_record_ead_notice_callback");

  it("impone unicidad normalizada tanto a request como a evento terminal", () => {
    expect(migration).toContain("EAD_PROVIDER_REQUEST_ID_REPAIR_REQUIRED");
    expect(migration).toContain("EAD_PROVIDER_EVENT_ID_REPAIR_REQUIRED");
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_events_ead_request_identity\s+ON public\.communication_delivery_events\(\(btrim\(proveedor_evento_id\)\)\)/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS ux_delivery_events_ead_callback_identity\s+ON public\.communication_delivery_events\(\(btrim\(proveedor_evento_id\)\)\)[\s\S]*evento IN \('DELIVERED', 'ERROR'\)/,
    );
  });

  it("resuelve una sola request WORM y vincula todos los hechos autenticados", () => {
    expect(callback).toContain("SELECT event.* INTO v_request_event");
    expect(callback).not.toContain("LIMIT 1");
    for (const field of [
      "'tenant_id'",
      "'communication_id'",
      "'recipient_id'",
      "'provider_request_id'",
      "'provider_event_id'",
      "'provider_occurred_at'",
      "'provider_delivered_at'",
      "'expected_archive_hash_sha512'",
      "'earchive_evidence_id'",
      "'earchive_hash_sha512'",
      "'provider_payload'",
    ]) {
      expect(callback).toContain(field);
    }
    expect(callback).toContain("v_callback_binding::text");
    expect(callback).toContain("'callback_binding_hash_sha256'");
  });

  it("solo considera idempotente una identidad íntegramente igual y colisiona antes del UPDATE", () => {
    const lookup = callback.indexOf("SELECT event.* INTO v_existing_event");
    const collision = callback.indexOf("EAD_PROVIDER_EVENT_ID_COLLISION");
    const update = callback.indexOf("UPDATE public.communication_recipients", collision);
    expect(lookup).toBeGreaterThanOrEqual(0);
    expect(collision).toBeGreaterThan(lookup);
    expect(update).toBeGreaterThan(collision);
    expect(callback).toContain("event.evento IN ('DELIVERED', 'ERROR')");
    expect(callback).toContain("v_existing_event.recipient_id IS DISTINCT FROM");
    expect(callback).toContain("v_existing_event.ocurrido_en IS DISTINCT FROM");
    expect(callback).toContain("IS DISTINCT FROM v_callback_binding");
    expect(callback).toContain("USING ERRCODE = '23505'");
    expect(callback).not.toContain("ON CONFLICT");
  });

  it("prueba replay exacto y colisión entre dos sources sin efectos externos", () => {
    expect(callbackProbe).toContain("ead-probe-callback-request-foreign");
    expect(callbackProbe).toContain("ead-probe-callback-event-shared");
    expect(callbackProbe).toContain("v_callback_result ->> 'already_recorded' = 'true'");
    expect(callbackProbe).toContain("EXCEPTION WHEN unique_violation");
    expect(callbackProbe).toContain("v_callback_collision_blocked");
    expect(callbackProbe).toContain("ROLLBACK;");
  });

  it("el Edge conserva HMAC, payload original y 409 ante rechazo source-bound", () => {
    expect(webhook.indexOf("verifyEAD(rawBody, req.headers)")).toBeLessThan(
      webhook.indexOf("JSON.parse(rawBody)"),
    );
    expect(webhook).toContain("p_provider_payload: payload as unknown as Record<string, unknown>");
    expect(webhook).toContain("status: 409");
    expect(webhook).not.toContain("already_recorded: true");
  });
});
