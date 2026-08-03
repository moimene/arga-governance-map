import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720142000_secretaria_manifest_recipients_and_rectification_cleanup.sql",
  ),
  "utf8",
);
const edge = readFileSync(
  resolve(
    process.cwd(),
    "supabase/functions/convocation-artifact-register/index.ts",
  ),
  "utf8",
);
const stepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriasStepper.tsx"),
  "utf8",
);
const memberDispatch = readFileSync(
  resolve(
    process.cwd(),
    "src/components/secretaria/comunicaciones/PasoEnvioMiembros.tsx",
  ),
  "utf8",
);

function sqlFunction(qualifiedName: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION ${qualifiedName}(`);
  expect(start, `${qualifiedName} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("Secretaría — manifiesto con censo y limpieza de rectificación", () => {
  it("cierra todos los bloques PL/pgSQL con END;", () => {
    expect(migration).not.toMatch(/^END$/mu);
  });

  it("enriquece antes del WORM y recalcula el hash sobre el JSON final", () => {
    const enrich = sqlFunction(
      "secretaria_private.fn_convocation_manifest_enrich_recipients",
    );
    const enrichTrigger = migration.indexOf(
      "CREATE TRIGGER trg_00_convocation_manifest_enrich_recipients",
    );
    expect(enrichTrigger).toBeGreaterThan(0);
    expect(migration).toContain("BEFORE INSERT ON public.convocation_manifests");
    expect("trg_00_convocation_manifest_enrich_recipients".localeCompare(
      "trg_convocation_manifest_worm",
    )).toBeLessThan(0);
    expect(enrich).toContain("'secretaria.convocation-manifest.v2'");
    expect(enrich).toContain("'{renderer_contract_version}'");
    expect(enrich).toContain("'2026-07-20.3'::text");
    expect(enrich).toContain("'{recipient_selection}'");
    expect(enrich).toContain("'secretaria.convocation-recipient-selection.v1'");
    expect(enrich).toContain("'{recipients}'");
    expect(enrich).toContain("NEW.manifest_json::text");
    expect(enrich).toContain("'sha512'");
    expect(enrich.indexOf("NEW.manifest_json :=")).toBeLessThan(
      enrich.indexOf("NEW.manifest_hash_sha512 :="),
    );
  });

  it("deriva el snapshot temporal de asientos a fecha_1, resta exclusiones y fija identidad completa", () => {
    const enrich = sqlFunction(
      "secretaria_private.fn_convocation_manifest_enrich_recipients",
    );
    expect(enrich).toContain("v_convocatoria.fecha_1 AT TIME ZONE 'Europe/Madrid'");
    expect(enrich).toContain("SET timezone = 'Europe/Madrid'");
    expect(migration).not.toContain(
      "ALTER FUNCTION public.fn_crear_censo_snapshot(uuid, text, uuid, uuid, text)",
    );
    expect(enrich).toContain("CONVOCATION_MANIFEST_RECIPIENTS_CDA_ONLY");
    expect(enrich).toContain("FROM public.condiciones_persona membership");
    expect(enrich).toContain("membership.body_id = v_convocatoria.body_id");
    expect(enrich).toContain("membership.estado = 'VIGENTE'");
    expect(enrich).toContain("membership.estado = 'PROGRAMADO'");
    expect(enrich).toContain("membership.estado = 'CESADO'");
    expect(enrich).toContain("membership.tipo_condicion IN (");
    expect(enrich).toContain("'seat_semantics', 'PRIMARY'");
    expect(enrich).toContain("fn_secretaria_is_eligible_board_member_at");
    expect(enrich).toContain("membership.fecha_inicio <= v_effective_date");
    expect(enrich).toContain("membership.fecha_fin >= v_effective_date");
    expect(enrich).toContain("'{recipients,excluded_person_ids}'");
    expect(enrich).toContain("'person_id', source.person_id");
    expect(enrich).toContain("'condition_id', source.condition_id");
    expect(enrich).toContain("'name', source.name");
    expect(enrich).toContain("'office', source.office");
    expect(enrich).toContain("'email', source.email");
    expect(enrich).toContain("'channel', v_recipient_channel");
    expect(enrich).toContain("WHEN v_ead_requested THEN 'EAD_INTERPOSITION'");
    expect(enrich).toContain("v_email_requested");
    expect(enrich).toContain("CONVOCATION_MANIFEST_DIRECT_RECIPIENT_CHANNEL_REQUIRED");
    expect(enrich).toContain("CONVOCATION_ACCOUNTS_LATE_REGULARIZATION_REQUIRED");
    expect(enrich).toContain("CONVOCATION_ACCOUNTS_FINANCIAL_YEAR_AMBIGUOUS");
    expect(enrich).toContain("CONVOCATION_ACCOUNTS_FINANCIAL_YEAR_NOT_CLOSED");
    expect(enrich).toContain("v_accounts_proposal_normalized NOT LIKE '%extemporan%'");
    expect(enrich).toContain("v_accounts_proposal_normalized NOT LIKE '%regulariza%'");
    expect(enrich).toContain("v_accounts_proposal_normalized NOT LIKE '%sin convalidar%'");
  });

  it("resuelve la fecha del snapshot por jurisdicción sin alterar la función global", () => {
    const prepare = sqlFunction("public.fn_communication_prepare_census");
    expect(prepare).toContain("WHEN 'ES' THEN 'Europe/Madrid'");
    expect(prepare).toContain("WHEN 'PT' THEN 'Europe/Lisbon'");
    expect(prepare).toContain("WHEN 'BR' THEN 'America/Sao_Paulo'");
    expect(prepare).toContain("WHEN 'MX' THEN 'America/Mexico_City'");
    expect(prepare).toContain("v_previous_timezone := current_setting('TimeZone')");
    expect(prepare).toContain("set_config('TimeZone', v_snapshot_timezone, true)");
    expect(prepare).toContain("set_config('TimeZone', v_previous_timezone, true)");
    expect(prepare).toContain("public.fn_crear_censo_snapshot(");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.fn_communication_prepare_census(uuid)",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated, service_role");
    expect(migration).not.toContain(
      "GRANT EXECUTE ON FUNCTION public.fn_communication_prepare_census(uuid)",
    );
  });

  it("falla cerrado ante cero, duplicados, faltantes o counts de UI divergentes", () => {
    const enrich = sqlFunction(
      "secretaria_private.fn_convocation_manifest_enrich_recipients",
    );
    expect(enrich).toContain("CONVOCATION_MANIFEST_RECIPIENT_CARDINALITY_ZERO");
    expect(enrich).toContain("CONVOCATION_MANIFEST_RECIPIENT_DUPLICATE_PERSON");
    expect(enrich).toContain("CONVOCATION_MANIFEST_RECIPIENT_REQUIRED_FIELD_MISSING");
    expect(enrich).toContain("CONVOCATION_MANIFEST_EXCLUDED_RECIPIENT_NOT_IN_CENSUS");
    expect(enrich).toContain("CONVOCATION_MANIFEST_EXCLUDED_RECIPIENT_DUPLICATE");
    expect(enrich).toContain("CONVOCATION_MANIFEST_RECIPIENT_TRACE_COUNTS_REQUIRED");
    expect(enrich).toContain("CONVOCATION_MANIFEST_RECIPIENT_CENSUS_MISMATCH");
    expect(enrich).toContain("v_trace_total <> v_source_count");
    expect(enrich).toContain("v_trace_selected <> v_selected_count");
  });

  it("alinea cliente y servidor en asientos políticos PRIMARY a la fecha efectiva", () => {
    expect(stepper).toContain("POLITICAL_BOARD_RECIPIENT_ROLES");
    expect(stepper).toContain('state === "PROGRAMADO"');
    expect(stepper).toContain('state === "CESADO"');
    expect(stepper).toContain('mandate.seat_semantics ?? "PRIMARY"');
    expect(stepper).not.toContain("PRESIDENTE primero, SECRETARIO segundo");
    expect(memberDispatch).toContain("props.canonicalRecipients");
    expect(memberDispatch).toContain("recipient.conditionId");
    expect(memberDispatch).toContain("return props.canonicalRecipients.find");
  });

  it("vincula el package BORRADOR a identidad completa, canal y exclusiones del manifiesto", () => {
    const binding = sqlFunction("public.fn_communication_census_binding_valid");
    const finalized = sqlFunction(
      "public.fn_secretaria_validate_finalized_convocation_package",
    );
    expect(binding).toContain("v_manifest_json -> 'recipients'");
    expect(binding).toContain("v_manifest_json -> 'recipient_selection'");
    expect(binding).toContain("manifest_recipient ->> 'condition_id'");
    expect(binding).toContain("member ->> 'source_id'");
    expect(binding).toContain("member ->> 'seat_role'");
    expect(binding).toContain("recipient.cargo_en_organo");
    expect(binding).toContain("'{channel_semantics,recipients}'");
    expect(binding).toContain("manifest_recipient ->> 'channel'");
    expect(binding).toContain("recipient.canal_original");
    expect(binding).toContain("recipient.canal_primario");
    expect(binding).toContain("recipient.canal_fallback IS NOT NULL");
    expect(binding).toContain("recipient.destino_fallback IS NOT NULL");
    expect(binding).toContain("GROUP BY intent ->> 'person_id'");
    expect(binding).toContain("excluded_person_ids");
    expect(binding).toContain("member ->> 'effective_date'");
    expect(finalized).toContain("fn_communication_census_binding_valid(NEW.id)");
    expect(migration).toContain("BEFORE UPDATE OF package_hash_sha512");
  });

  it("cancela solo comunicaciones pendientes, preserva las entregadas y limpia reuniones futuras con binding exclusivo", () => {
    const lifecycle = sqlFunction(
      "public.fn_transition_convocatoria_lifecycle",
    );
    expect(lifecycle).toContain("communication.estado IN ('BORRADOR', 'PROGRAMADA')");
    expect(lifecycle).toContain("GET DIAGNOSTICS v_communications_cancelled = ROW_COUNT");
    expect(lifecycle).toContain("v_communications_preserved");
    expect(lifecycle).toContain("CONVOCATION_LIFECYCLE_COMMUNICATION_IN_FLIGHT");
    expect(lifecycle).toContain("recipient.estado_entrega = 'ENVIANDO'");
    expect(lifecycle).toContain("pg_advisory_xact_lock");
    expect(lifecycle).toContain("fn_meeting_linked_to_convocation");
    expect(lifecycle).toContain("agreement.parent_meeting_id = v_meeting.id");
    expect(lifecycle).not.toMatch(/agreement\.parent_meeting_id[\s\S]{0,180}agreement\.status IN/);
    expect(lifecycle).toContain("meeting.status IN ('DRAFT', 'CONVOCADA')");
    expect(lifecycle).toContain("GET DIAGNOSTICS v_meetings_cancelled = ROW_COUNT");
    expect(lifecycle).toContain("item.source_convocatoria_id = v_convocatoria.id");
    expect(lifecycle).toContain("source_convocatoria_id IS DISTINCT FROM v_convocatoria.id");
    expect(lifecycle).toContain("CONVOCATION_LIFECYCLE_MEETING_BINDING_NOT_EXCLUSIVE");
    expect(lifecycle).toContain("FROM public.agenda_items item");
    expect(lifecycle).toContain("FOR UPDATE;");
    expect(lifecycle).toContain("CONVOCATION_LIFECYCLE_MEETING_TENANT_MISMATCH");
    expect(lifecycle).toContain("CONVOCATION_LIFECYCLE_COMMUNICATION_TENANT_MISMATCH");
    expect(lifecycle).not.toMatch(/communications[\s\S]*metadata\s*=/);
  });

  it("programa con el mismo orden advisory -> root y bloquea el sandbox", () => {
    const program = sqlFunction("public.fn_program_communication");
    const advisory = program.indexOf("pg_advisory_xact_lock");
    const rootLock = program.indexOf("FOR UPDATE");
    expect(advisory).toBeGreaterThan(0);
    expect(rootLock).toBeGreaterThan(advisory);
    expect(program).toContain("sandbox communication cannot be programmed");
    expect(program).toContain("fn_communication_prepare_census");
    expect(program).toContain("fn_communication_assert_authoritative_binding");
  });

  it("serializa claim, cancelación y lifecycle sin reescribir entrega histórica", () => {
    const claim = sqlFunction(
      "public.fn_secretaria_guard_convocation_dispatch_claim",
    );
    const cancel = sqlFunction("public.fn_cancel_communication");
    expect(claim.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      claim.lastIndexOf("FOR UPDATE"),
    );
    expect(claim).toContain("CONVOCATION_DISPATCH_CLAIM_SOURCE_NOT_ACTIVE");
    expect(claim).toContain("convocatoria.estado");
    expect(claim).toContain("v_convocatoria_estado <> 'EMITIDA'");
    expect(cancel.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      cancel.indexOf("FOR UPDATE"),
    );
    expect(cancel).toContain("active dispatch lease prevents cancellation");
    const retry = sqlFunction("public.fn_retry_communication_recipient");
    expect(retry.indexOf("pg_advisory_xact_lock")).toBeLessThan(
      retry.indexOf("FOR UPDATE"),
    );
    expect(retry).toContain("CONVOCATION_RETRY_SOURCE_NOT_ACTIVE");
    expect(retry).toContain("sandbox source");
  });

  it("falla cerrado ante reunión iniciada o con acta/resoluciones", () => {
    const lifecycle = sqlFunction(
      "public.fn_transition_convocatoria_lifecycle",
    );
    expect(lifecycle).toContain("v_meeting.status IN ('EN_CURSO', 'CELEBRADA')");
    expect(lifecycle).toContain("CONVOCATION_LIFECYCLE_MEETING_ALREADY_IN_PROGRESS");
    expect(lifecycle).toContain("FROM public.minutes minute");
    expect(lifecycle).toContain("FROM public.meeting_resolutions resolution");
    expect(lifecycle).toContain("CONVOCATION_LIFECYCLE_MEETING_HAS_LEGAL_ACTS");
  });

  it("preserva autenticación, tenant, RBAC y la salida cancelable de todo sandbox DEMO", () => {
    const lifecycle = sqlFunction(
      "public.fn_transition_convocatoria_lifecycle",
    );
    const eadGuard = sqlFunction(
      "public.fn_secretaria_guard_ead_sandbox_communication",
    );
    const dispatchGuard = sqlFunction(
      "public.fn_communication_dispatch_gate",
    );
    expect(lifecycle).toContain("AUTHENTICATED_USER_REQUIRED_FOR_CONVOCATION_LIFECYCLE");
    expect(lifecycle).toContain("fn_assert_current_tenant_id()");
    expect(lifecycle).toContain("user_role.is_active IS TRUE");
    expect(lifecycle).toContain("capability.action = 'CONVOCATION_ISSUE'");
    expect(lifecycle).toContain("FOR UPDATE");
    expect(eadGuard).toContain("NEW.estado = 'CANCELADA'");
    expect(eadGuard).toContain("OLD.estado IN ('BORRADOR', 'PROGRAMADA')");
    expect(eadGuard).toContain("AND NOT v_governed_cancel");
    expect(eadGuard).toContain("'{publication,delivery_mode}' = 'SANDBOX_ONLY'");
    expect(eadGuard).toContain("'{publication,real_delivery_allowed}'");
    expect(eadGuard).toContain("CONVOCATION_COMMUNICATION_REQUIRES_CANONICAL_DEMO_SANDBOX");
    expect(eadGuard).toContain("NEW.metadata -> 'sandbox_only' IS DISTINCT FROM 'true'::jsonb");
    expect(eadGuard).toContain("CONVOCATION_DEMO_SANDBOX_METADATA_CONTRADICTION");
    expect(eadGuard).toContain("NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)");
    expect(eadGuard).toContain("v_manifest_ead_requested");
    expect(eadGuard).toContain("CONVOCATION_EAD_SERVICE_CANONICAL_METADATA_REQUIRED");
    expect(eadGuard).toContain("CONVOCATION_NON_EAD_CANNOT_ASSERT_EAD_SERVICE");
    expect(eadGuard).toContain("'provider_contract_evidence', NULL");
    expect(eadGuard).toContain("'signature_claim', false");
    expect(eadGuard).toContain("'erds_claim', false");
    expect(eadGuard).toContain("DEMO convocation communication is immutable as BORRADOR/no-dispatch");
    expect(dispatchGuard).not.toContain("v_governed_lifecycle_cancel");
    expect(dispatchGuard).toContain("OLD.estado = 'BORRADOR' AND NEW.estado IN ('PROGRAMADA','CANCELADA')");
    expect(dispatchGuard).toContain("OLD.estado = 'PROGRAMADA' AND NEW.estado IN (");
  });

  it("incluye counts en el payload WORM y por tanto en event_hash_sha512", () => {
    const worm = sqlFunction(
      "secretaria_private.fn_convocation_lifecycle_event_worm_guard",
    );
    expect(worm).toContain("secretaria.convocation-lifecycle-event.v3");
    expect(worm).toContain("'communications_cancelled', v_communications_cancelled");
    expect(worm).toContain("'communications_preserved', v_communications_preserved");
    expect(worm).toContain("'meetings_cancelled', v_meetings_cancelled");
    expect(worm).toContain("NEW.event_payload::text");
    expect(worm).toContain("NEW.event_hash_sha512 :=");
    expect(worm.indexOf("NEW.event_payload :=")).toBeLessThan(
      worm.indexOf("NEW.event_hash_sha512 :="),
    );
  });

  it("exige contrato exacto antes de cualquier reuse y rechaza binarios legacy como vigentes", () => {
    const existingLookup = edge.indexOf(
      "const { data: existingData, error: existingError }",
    );
    const reuseReturn = edge.indexOf("reused: true", existingLookup);
    const contractGate = edge.indexOf(
      "root.renderer_contract_version !== RENDERER_CONTRACT_VERSION",
    );
    const render = edge.indexOf(
      "rendered = renderConvocationDocx(canonicalManifest, storedManifestHash)",
    );
    expect(edge).toContain("RENDERER_CONTRACT_VERSION");
    expect(existingLookup).toBeGreaterThan(0);
    expect(reuseReturn).toBeGreaterThan(existingLookup);
    expect(contractGate).toBeGreaterThan(0);
    expect(contractGate).toBeLessThan(existingLookup);
    expect(render).toBeGreaterThan(reuseReturn);
  });
});
