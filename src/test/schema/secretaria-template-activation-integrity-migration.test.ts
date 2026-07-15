import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260712124000_secretaria_template_activation_integrity.sql",
  ),
  "utf8",
);
const executableSql = migration.replace(/^\s*--.*$/gm, "");
const transitionRpc = migration.match(
  /CREATE OR REPLACE FUNCTION public\.fn_secretaria_transition_template_state\([\s\S]*?\n\$function\$;/,
)?.[0] ?? "";

describe("Oleada 3A — migración de integridad de activación", () => {
  it("cierra todos los bloques PL/pgSQL con sintaxis ejecutable", () => {
    expect(migration).not.toMatch(/\nEND\n\$[A-Za-z_]+\$;/);
  });

  it("archiva solo v1.0.0 y conserva v1.1.0 como canónica sin borrar ni renombrar", () => {
    expect(migration).toContain("92ee684b-8a34-4e8c-b3ca-c1827f7fa05f");
    expect(migration).toContain("52e7f727-125b-4d26-a46f-bf9a912df56e");
    expect(migration).toMatch(/v_legacy\.version IS DISTINCT FROM '1\.0\.0'/);
    expect(migration).toMatch(/v_canonical\.version IS DISTINCT FROM '1\.1\.0'/);
    expect(migration).toMatch(/SET estado = 'ARCHIVADA'[\s\S]*WHERE id = v_legacy_id/);
    expect(executableSql).not.toMatch(/DELETE\s+FROM\s+(?:public\.)?plantillas_protegidas/i);
    expect(executableSql).not.toMatch(/UPDATE\s+(?:public\.)?materia_catalog/i);
    expect(executableSql).not.toMatch(/ALTER\s+TABLE[\s\S]*RENAME/i);
  });

  it("falla ante drift, dependencias o cambios de contenido y deja changelog contemporáneo", () => {
    [
      "public.communications",
      "public.materia_template_binding",
      "public.no_session_expedientes",
      "public.no_session_resolutions",
      "public.plantilla_capa3_overrides_por_entidad",
      "public.secretaria_document_artifacts",
      "public.secretaria_document_drafts",
    ].forEach((table) => expect(migration).toContain(table));
    expect(migration).toContain("IF v_dependency_count <> 0 THEN");
    expect(migration).toContain("to_jsonb(v_legacy) - 'estado' - 'version_history'");
    expect(migration).toContain("reconstructed', false");
    expect(migration).toContain("v_was_active AND v_active_count <> 1");
  });

  it("comparte la identidad funcional canónica y trata NULL, vacío y ANY como equivalentes", () => {
    expect(migration).toContain("fn_secretaria_template_functional_key");
    expect(migration).toContain("jsonb_build_array(");
    [
      "AMPLIACION_CAPITAL",
      "MOD_ESTATUTOS",
      "NOMBRAMIENTO_CESE",
      "EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE",
      "JUNTA",
      "CONSEJO_ADMINISTRACION",
      "CONSEJO",
      "ADMIN_CONJUNTA",
      "ADMIN_SOLIDARIO",
    ].forEach((alias) => expect(migration).toContain(`WHEN '${alias}'`));
    expect(migration).toContain("NULLIF(btrim(materia_acuerdo), '')");
    expect(migration).toMatch(/CASE upper\(btrim\(COALESCE\(p_tipo_social, ''\)\)\)[\s\S]*WHEN '' THEN 'ANY'[\s\S]*WHEN 'ANY' THEN 'ANY'/);
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ux_plantillas_active_functional_identity[\s\S]*WHERE estado = 'ACTIVA'/);
  });

  it("autoriza en servidor con tenant, rol activo/no expirado y evaluación fail-closed", () => {
    expect(migration).toMatch(/JOIN public\.rbac_roles rr ON rr\.id = rur\.role_id/);
    expect(migration).toContain("rur.user_id = auth.uid()");
    expect(migration).toContain("rur.is_active = true");
    expect(migration).toContain("rur.expires_at IS NULL OR rur.expires_at > now()");
    expect(migration).toContain("rr.role_code = 'ADMIN_TENANT'");
    expect(migration).toContain("fn_current_tenant_id() IS DISTINCT FROM p_tenant_id");
    expect(migration).toContain("COALESCE(public.fn_secretaria_is_service_role(), false)");
  });

  it("hace la transición atómica, idempotente, serializada y con CAS", () => {
    expect(transitionRpc).toContain("p_operation_id uuid");
    expect(transitionRpc).toContain("p_expected_predecessor_id uuid DEFAULT NULL");
    expect(transitionRpc).not.toMatch(/p_(?:tenant|actor|autor)/i);
    expect(transitionRpc).toContain("auth.uid()");
    expect(transitionRpc).toContain("auth.jwt() ->> 'email'");
    expect(transitionRpc.match(/pg_advisory_xact_lock/g)?.length).toBe(2);
    expect(transitionRpc.match(/FOR UPDATE/g)?.length).toBeGreaterThanOrEqual(2);
    expect(transitionRpc).toMatch(/v_target\.estado IS DISTINCT FROM v_from/);
    expect(transitionRpc).toMatch(/WHERE id = p_template_id[\s\S]*AND estado = v_from/);
    expect(transitionRpc).toContain("operation_id reuse with a different request");
    expect(transitionRpc).toContain("p_fecha_aprobacion AT TIME ZONE 'UTC'");
    expect(transitionRpc).toContain("'replayed', true");
    expect(transitionRpc).toContain("ACTIVE_BINDINGS_REQUIRE_REPLACEMENT");
    expect(transitionRpc).toContain("nueva aprobación formal requerida");
    expect(transitionRpc).toMatch(/WHEN v_to = 'BORRADOR' THEN NULL/);
    expect(transitionRpc).toMatch(/approval_checklist = CASE WHEN v_to = 'BORRADOR' THEN '\[\]'::jsonb/);
    expect(transitionRpc.match(/INSERT INTO public\.plantilla_changelog/g)?.length).toBe(2);
    expect(transitionRpc).toContain("UPDATE public.materia_template_binding");
  });

  it("protege el ledger WORM, los cambios directos de estado y los bindings activos", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.secretaria_template_transition_operations");
    expect(migration).toContain("request_hash_sha256 text NOT NULL");
    expect(migration).toContain("tr_worm_template_transition_operations_update");
    expect(migration).toContain("tr_worm_template_transition_operations_delete");
    expect(migration).toMatch(/REVOKE ALL ON public\.secretaria_template_transition_operations\s+FROM PUBLIC, anon, authenticated, service_role/);
    expect(migration).toContain(
      "GRANT SELECT ON public.secretaria_template_transition_operations TO service_role",
    );
    expect(migration).not.toContain(
      "GRANT SELECT, INSERT ON public.secretaria_template_transition_operations TO service_role",
    );
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE ON public\.plantillas_protegidas/);
    expect(migration).toContain("direct template state transition forbidden");
    expect(migration).toContain("active binding requires an ACTIVA template in the same tenant");
    expect(migration).toContain("binding requires a template in the same tenant");
    expect(migration).toContain("template changelog requires a template in the same tenant");
    expect(migration).toContain("template tenant_id is immutable");
    const stateGuard = migration.match(
      /CREATE OR REPLACE FUNCTION public\.fn_secretaria_guard_template_state_transition\(\)[\s\S]*?\n\$function\$;/,
    )?.[0] ?? "";
    expect(stateGuard).not.toContain("fn_secretaria_is_service_role");
    expect(migration).toMatch(/FOR KEY SHARE;[\s\S]*active binding requires an ACTIVA template/);
  });

  it("reemplaza las policies permisivas y endurece también la RPC de bindings", () => {
    [
      "plantillas_admin_insert",
      "plantillas_admin_update",
      "plantillas_admin_delete_draft",
      "changelog_admin_insert",
      "materia_template_binding_admin_insert",
      "materia_template_binding_admin_update",
      "materia_template_binding_admin_delete",
    ].forEach((policy) => expect(migration).toContain(`CREATE POLICY ${policy}`));
    expect(migration).toMatch(/CREATE POLICY plantillas_admin_update[\s\S]*USING \([\s\S]*estado = 'BORRADOR'[\s\S]*WITH CHECK \([\s\S]*estado = 'BORRADOR'/);
    expect(migration).toContain(
      "REVOKE ALL ON public.plantillas_protegidas FROM anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "REVOKE ALL ON public.materia_template_binding FROM anon, authenticated, service_role",
    );
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_secretaria_assign_template_binding\(p_payload jsonb\)[\s\S]*fn_secretaria_assert_active_template_admin\(v_tenant_id\)/);
    expect(migration).toMatch(/p\.estado = 'ACTIVA'/);
    expect(migration).toContain("La asignación exige razón jurídica de selección.");
    expect(migration).toContain("'user_role', 'admin'");
    expect(migration).toMatch(/v_materia := COALESCE\([\s\S]*v_template\.materia_acuerdo/);
    expect(migration).toMatch(/v_doc_type := COALESCE\([\s\S]*v_template\.tipo/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.fn_secretaria_transition_template_state\([\s\S]*FROM PUBLIC, anon/);
    expect(migration).toContain("pg_get_indexdef(i.indexrelid)");
    expect(migration).toContain("i.indisvalid");
  });
});
