import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260720123000_arga_cda_census_authoritative.sql",
);

const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

describe("CdA ARGA — censo y representación autoritativos", () => {
  it("mantiene ARGA Seguros como cotizada y archiva la PJ consejera sin borrar historia", () => {
    expect(executableSql).toContain("6d7ed736-f263-4531-a59d-c6ca0cd41602");
    expect(executableSql).toContain("00000000-0000-0000-0000-000000000110");
    expect(executableSql).toMatch(/SET\s+es_cotizada\s*=\s*true/i);
    expect(executableSql).toMatch(/SET[\s\S]*estado\s*=\s*'CESADO'/i);
    expect(executableSql).toContain("arga_cda_census_authoritative");
    expect(executableSql).not.toMatch(/DELETE\s+FROM\s+public\.condiciones_persona/i);
  });

  it("historifica todos los mandatos PF superiores a cuatro años y crea reelecciones sucesivas 2024-2028", () => {
    expect(executableSql).toContain("FOR v_previous IN");
    expect(executableSql).toContain("p.person_type = 'PF'");
    expect(executableSql).toContain(
      "cp.fecha_fin >= (cp.fecha_inicio + INTERVAL '4 years')::date",
    );
    expect(executableSql).toContain("DATE '2024-06-01'");
    expect(executableSql).toContain("DATE '2028-05-31'");
    expect(executableSql).toContain("DATE '2026-07-20'");
    expect(executableSql).toContain("v_case_request_date + 20");
    expect(executableSql).toContain("v_target_meeting_date");
    expect(executableSql).toContain("md5(");
    expect(executableSql).toContain("arga-cda-demo-reelection-current-2024-06-01:");
    expect(executableSql).toContain("arga-cda-demo-reelection-history:");
    expect(executableSql).toContain("WHILE v_segment_start < v_renewal_start LOOP");
    expect(executableSql).toContain("renewed_by_condition_id");
    expect(executableSql).toContain("renewal_of_condition_id");
    expect(executableSql).toContain("renewal_origin_condition_id");
    expect(executableSql).toContain("historical_record_preserved");
    expect(executableSql).toContain("'source_kind', 'DEMO_REELECTION'");
    expect(executableSql).toContain("'source_phase', 'HISTORICAL'");
    expect(executableSql).toContain("'source_phase', 'CURRENT'");
    expect(executableSql).toContain("ARGA_CDA_REELECCION_2024-06-01");
    expect(executableSql).toContain("'legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT'");
    expect(executableSql).toContain("'provenance_status', 'SYNTHETIC_DEMO_NOT_SOURCE_EVIDENCE'");
    expect(executableSql).toContain("'designation_evidence_status', 'NO_ACTA_NO_RM_EVIDENCE'");
    expect(executableSql).toContain("segment.fuente_designacion = 'BOOTSTRAP'");
    expect(executableSql).toContain("renewal.fuente_designacion = 'BOOTSTRAP'");
    expect(executableSql).toContain("segment.inscripcion_rm_referencia IS NULL");
    expect(executableSql).toContain("renewal.inscripcion_rm_referencia IS NULL");
    expect(executableSql).not.toContain(
      "IS NOT DISTINCT FROM v_previous.inscripcion_rm_referencia",
    );
    expect(executableSql).not.toContain(
      "IS NOT DISTINCT FROM v_previous.inscripcion_rm_fecha",
    );
    expect(executableSql).not.toContain("RM-DEMO-");
    expect(executableSql).toContain("ARGA_CDA_RENEWAL_INCOMPLETE");
    expect(executableSql).toContain("ARGA_CDA_RENEWAL_TERM_INVALID");
    expect(executableSql).toContain("ARGA_CDA_RENEWAL_OVERLAP");
    expect(executableSql).toContain(
      "daterange(left_period.fecha_inicio, left_period.fecha_fin, '[]')",
    );
  });

  it("ratifica exactamente 15 consejeros PF con reparto 9/5/1", () => {
    expect(executableSql).toContain("v_total_pf <> 15");
    expect(executableSql).toContain("v_independientes <> 9");
    expect(executableSql).toContain("v_ejecutivos <> 5");
    expect(executableSql).toContain("v_dominicales <> 1");
    expect(executableSql).toContain("person_type = 'PF'");
    expect(executableSql).toContain("tipo_condicion = 'SECRETARIO'");
    expect(executableSql).toContain("v_secretary_count <> 1");
    expect(executableSql).toContain("secretaria no consejera");
    expect(executableSql).toContain("'category_assignment_kind', 'DEMO_CONFIGURATION'");
    expect(executableSql).toContain(
      "'category_legal_effect', 'DEMO_SIMULATION_NO_LEGAL_EFFECT'",
    );
    expect(executableSql).toContain(
      "'category_evidence_status', 'NO_ACTA_NO_RM_EVIDENCE'",
    );
  });

  it("separa VIGENTE, PROGRAMADO y CESADO y bloquea PJ, mandatos largos y solapes", () => {
    expect(executableSql).toMatch(
      /CHECK \(estado IN \('VIGENTE', 'PROGRAMADO', 'CESADO'\)\)/i,
    );
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_listed_board_condition_guard",
    );
    expect(executableSql).toContain("NEW.tipo_condicion = ANY (v_seat_roles)");
    expect(executableSql).toContain("CONDITION_VIGENTE_OUTSIDE_PERIOD");
    expect(executableSql).toContain("NEW.fecha_inicio > CURRENT_DATE");
    expect(executableSql).toContain("CONDITION_PROGRAMMED_PERIOD_INVALID");
    expect(executableSql).toContain("NEW.estado = 'PROGRAMADO'");
    expect(executableSql).toContain("CONDITION_CEASED_PERIOD_INVALID");
    expect(executableSql).toContain("NEW.fecha_fin > CURRENT_DATE");
    expect(executableSql).toContain("INTERVAL '4 years'");
    expect(executableSql).toContain("v_person_type <> 'PF'");
    expect(executableSql).toContain("PJ no puede ocupar un asiento");
    expect(executableSql).toContain("daterange(cp.fecha_inicio, cp.fecha_fin, '[]')");
    expect(executableSql).toContain("LISTED_BOARD_SEAT_PERIOD_OVERLAP");
    expect(executableSql).toContain("se permiten mandatos sucesivos");
    expect(executableSql).toMatch(
      /BEFORE INSERT OR UPDATE ON public\.condiciones_persona/i,
    );

    const eligibilityFunction = executableSql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_secretaria_is_eligible_board_member_at[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";
    expect(eligibilityFunction).toContain("cp.estado = 'PROGRAMADO'");
    expect(eligibilityFunction).toContain("p_effective_date > CURRENT_DATE");
    expect(eligibilityFunction).toContain("cp.estado = 'CESADO'");
    expect(eligibilityFunction).toContain("cp.fecha_fin IS NOT NULL");
    expect(eligibilityFunction).toContain("p_effective_date < CURRENT_DATE");
    expect(eligibilityFunction).not.toMatch(
      /cp\.estado\s*=\s*'VIGENTE'\s+OR\s+cp\.fecha_fin\s+IS\s+NOT\s+NULL/i,
    );
  });

  it("solo admite delegación de Consejo entre dos consejeros elegibles", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_board_representation_guard",
    );
    expect(executableSql).toContain("NEW.scope <> 'CONSEJO_DELEGACION'");
    expect(executableSql).toContain("NEW.represented_person_id = NEW.representative_person_id");
    expect(executableSql).toContain("m.scheduled_start::date");
    expect(executableSql).toContain("BOARD_REPRESENTATION_MEETING_DATE_REQUIRED");
    expect(executableSql).toContain("NEW.effective_from > v_effective_date");
    expect(executableSql).toContain("NEW.effective_to < v_effective_date");
    expect(executableSql).not.toContain(
      "NEW.scope <> 'CONSEJO_DELEGACION' OR NEW.effective_to IS NOT NULL",
    );
    expect(executableSql).toMatch(
      /public\.fn_secretaria_is_eligible_board_member_at\(\s*v_body_id,\s*NEW\.represented_person_id,\s*v_effective_date\s*\)/i,
    );
    expect(executableSql).toMatch(
      /public\.fn_secretaria_is_eligible_board_member_at\(\s*v_body_id,\s*NEW\.representative_person_id,\s*v_effective_date\s*\)/i,
    );
    expect(executableSql).toMatch(
      /BEFORE INSERT OR UPDATE ON public\.representaciones/i,
    );
  });

  it("deduplica la proyección por asiento/persona y excluye Secretaría", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_refresh_parte_votante_body",
    );
    expect(executableSql).toContain("DISTINCT ON (cp.person_id)");
    expect(executableSql).toContain("cp.fecha_inicio <= CURRENT_DATE");
    expect(executableSql).toContain("cp.fecha_fin >= CURRENT_DATE");
    expect(executableSql).toContain(
      "'CONSEJERO','PRESIDENTE','VICEPRESIDENTE','CONSEJERO_COORDINADOR'",
    );
    expect(executableSql).not.toMatch(
      /cp\.tipo_condicion\s+IN\s*\([^)]*SECRETARIO[^)]*\)/i,
    );
    expect(executableSql).toContain("ux_parte_votante_current_body_person_cargo");
  });

  it("crea snapshots fechados con denominadores verificables y sin personas duplicadas", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_crear_censo_snapshot",
    );
    expect(executableSql).toContain("count(DISTINCT person_id)");
    expect(executableSql).toContain("v_projection_count <> v_distinct_person_count");
    expect(executableSql).toContain("effective_date', v_effective_date");
    expect(executableSql).toContain("snapshot_total_partes");
    expect(executableSql).toContain("snapshot_denominator_total");
    expect(executableSql).toContain("capital_total_base");
    expect(executableSql).toContain("total_partes");
  });

  it("elige la fuente del censo por órgano y reserva UNIVERSAL exclusivamente a JGA", () => {
    const snapshotFunction = executableSql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_crear_censo_snapshot[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";

    expect(snapshotFunction).toContain("v_census_source_type := 'POLITICO'");
    expect(snapshotFunction).toContain("v_census_source_type := 'ECONOMICO'");
    expect(snapshotFunction).toContain("'CDA', 'CONSEJO_ADMIN', 'CONSEJO_ADMINISTRACION'");
    expect(snapshotFunction).toContain("'JUNTA', 'JGA', 'JUNTA_GENERAL'");
    expect(snapshotFunction).toContain("p_snapshot_type NOT IN ('ECONOMICO', 'UNIVERSAL')");
    expect(snapshotFunction).toContain("CENSUS_UNIVERSAL_JGA_ONLY");
    expect(snapshotFunction).toContain(
      "UNIVERSAL no puede usar capital_holdings para órgano",
    );
    expect(snapshotFunction).toContain("IF v_census_source_type = 'POLITICO' THEN");
    expect(snapshotFunction).toContain("ELSIF v_census_source_type = 'ECONOMICO' THEN");
  });

  it("no oculta dobles fuentes de asiento y solo exceptúa accesorios explícitos", () => {
    const snapshotFunction = executableSql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_crear_censo_snapshot[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";

    expect(snapshotFunction).toContain("CENSUS_EFFECTIVE_SEAT_SOURCE_CARDINALITY");
    expect(snapshotFunction).toContain("seat_semantics");
    expect(snapshotFunction).toContain(
      "COALESCE(cp.metadata ->> 'seat_semantics', 'PRIMARY') <> 'ACCESSORY'",
    );
    expect(snapshotFunction).toMatch(
      /HAVING count\(\*\) FILTER \([\s\S]*?\) <> 1/i,
    );
    const effectiveSeats = snapshotFunction.match(
      /WITH effective_seats AS MATERIALIZED \([\s\S]*?\), enriched AS/i,
    )?.[0] ?? "";
    expect(effectiveSeats).not.toContain("DISTINCT ON");
  });

  it("deriva la fecha efectiva de cada acto y no muta parte_votante_current al crear el WORM", () => {
    const snapshotFunction = executableSql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_crear_censo_snapshot[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";

    expect(snapshotFunction).toContain("m.scheduled_start::date");
    expect(snapshotFunction).toContain("COALESCE(ns.closed_at, ns.opened_at, ns.created_at)::date");
    expect(snapshotFunction).toContain("COALESCE(ud.decision_date, ud.created_at::date)");
    expect(snapshotFunction).toContain("CENSUS_EFFECTIVE_DATE_REQUIRED");
    expect(snapshotFunction).toContain("FROM public.condiciones_persona cp");
    expect(snapshotFunction).toContain("FROM public.capital_holdings ch");
    expect(snapshotFunction).toContain("cp.fecha_inicio <= v_effective_date");
    expect(snapshotFunction).toContain("cp.estado = 'PROGRAMADO'");
    expect(snapshotFunction).toContain("cp.estado = 'CESADO'");
    expect(snapshotFunction).toContain("v_effective_date < CURRENT_DATE");
    expect(snapshotFunction).toContain("ch.effective_from <= v_effective_date");
    expect(snapshotFunction).not.toContain("PERFORM public.fn_refresh_parte_votante_body");
    expect(snapshotFunction).not.toContain("PERFORM public.fn_refresh_parte_votante_entity");
    expect(snapshotFunction).not.toContain("FROM public.parte_votante_current");
  });

  it("rechaza fuente inexistente o cruzada por sesión, tenant, entidad u órgano", () => {
    expect(executableSql).toContain("CASE p_session_kind");
    expect(executableSql).toContain("WHEN 'MEETING'");
    expect(executableSql).toContain("WHEN 'NO_SESSION'");
    expect(executableSql).toContain("WHEN 'UNIPERSONAL'");
    expect(executableSql).toContain("CENSUS_SOURCE_NOT_FOUND");
    expect(executableSql).toContain("v_source_tenant_id IS DISTINCT FROM v_tenant_id");
    expect(executableSql).toContain("v_source_entity_id IS DISTINCT FROM p_entity_id");
    expect(executableSql).toContain("v_source_body_id IS DISTINCT FROM p_body_id");
    expect(executableSql).toContain("CENSUS_SOURCE_SCOPE_MISMATCH");
  });

  it("endurece el writer por tenant/rol y exige audit_worm_id del trigger", () => {
    const snapshotFunction = executableSql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_crear_censo_snapshot[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";

    expect(snapshotFunction).toContain("SECURITY DEFINER");
    expect(snapshotFunction).toContain("SET search_path = public, extensions");
    expect(snapshotFunction).toContain("public.fn_assert_current_tenant_id()");
    expect(snapshotFunction).toContain("public.fn_secretaria_assert_role_allowed");
    expect(snapshotFunction).toContain("ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]");
    expect(snapshotFunction).toContain("RETURNING id, audit_worm_id");
    expect(snapshotFunction).toContain("CENSUS_AUDIT_WORM_REQUIRED");
    expect(executableSql).toContain("trg_censo_snapshot_worm");
    expect(executableSql).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_crear_censo_snapshot\(uuid, text, uuid, uuid, text\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(executableSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_crear_censo_snapshot\(uuid, text, uuid, uuid, text\)[\s\S]*TO authenticated, service_role/i,
    );
  });

  it("solo fn_crear_censo_snapshot puede insertar el payload WORM", () => {
    const snapshotFunction = executableSql.match(
      /CREATE OR REPLACE FUNCTION public\.fn_crear_censo_snapshot[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";
    const capabilityIndex = snapshotFunction.indexOf(
      "'secretaria.authoritative_writer'",
    );
    const insertIndex = snapshotFunction.indexOf(
      "INSERT INTO public.censo_snapshot",
    );

    expect(snapshotFunction).toContain("SECURITY DEFINER");
    expect(snapshotFunction).toContain("pg_catalog.set_config(");
    expect(snapshotFunction).toContain("'fn_crear_censo_snapshot'");
    expect(capabilityIndex).toBeGreaterThan(0);
    expect(insertIndex).toBeGreaterThan(capabilityIndex);
    expect(executableSql).toMatch(
      /WHEN 'censo_snapshot' THEN\s+TG_OP = 'INSERT' AND writer_scope = 'fn_crear_censo_snapshot'/i,
    );
    expect(executableSql).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.censo_snapshot\s+FROM PUBLIC, anon, authenticated/i,
    );
    expect(executableSql).toMatch(
      /GRANT SELECT ON TABLE public\.censo_snapshot\s+TO authenticated, service_role/i,
    );
  });

  it("cierra DML directo sin romper RPC gobernados, incluida consolidación de personas", () => {
    for (const rpc of [
      "fn_designar_cargo",
      "fn_cesar_cargo",
      "fn_consolidate_person",
      "fn_upsert_representante_admin_pj",
      "fn_upsert_representacion_puntual",
      "fn_close_representacion_puntual",
    ]) {
      expect(executableSql).toContain(`'${rpc}'`);
    }

    expect(executableSql).toContain("pg_catalog.pg_get_functiondef(writer.oid)");
    expect(executableSql).toContain("p.prosecdef IS TRUE");
    expect(executableSql).toContain("pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'");
    expect(executableSql).toContain("AUTHORITATIVE_WRITER_RPC_SET_INCOMPLETE");
    expect(executableSql).toContain("esperados=6");
    expect(executableSql).toContain("PERSON_CONSOLIDATE");
    expect(executableSql).toContain("authorization_marker");
    expect(executableSql).toContain("current_user <> 'postgres'");
    expect(executableSql).toContain("AUTHORITATIVE_WRITE_RPC_REQUIRED");
    expect(executableSql).toContain("AUTHORITATIVE_DELETE_FORBIDDEN");

    for (const table of [
      "condiciones_persona",
      "representaciones",
      "authority_evidence",
    ]) {
      expect(executableSql).toMatch(
        new RegExp(
          `BEFORE INSERT OR UPDATE OR DELETE ON public\\.${table}`,
          "i",
        ),
      );
      expect(executableSql).toMatch(
        new RegExp(
          `REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${table}\\s+FROM PUBLIC, anon, authenticated`,
          "i",
        ),
      );
      expect(executableSql).toMatch(
        new RegExp(
          `GRANT SELECT ON TABLE public\\.${table}\\s+TO authenticated, service_role`,
          "i",
        ),
      );
    }

    expect(executableSql).toMatch(
      /WHEN 'authority_evidence' THEN[\s\S]*?'fn_designar_cargo'[\s\S]*?'fn_cesar_cargo'[\s\S]*?'fn_consolidate_person'[\s\S]*?'fn_registrar_inscripcion_rm_cargo'/i,
    );
  });

  it("incorpora la inscripción RM mediante evento append-only y audit WORM", () => {
    expect(executableSql).toContain(
      "CREATE TABLE IF NOT EXISTS public.cargo_rm_registration_events",
    );
    expect(executableSql).toContain("trg_cargo_rm_registration_event_worm");
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_registrar_inscripcion_rm_cargo",
    );
    expect(executableSql).toContain("RM_REFERENCE_REQUIRED");
    expect(executableSql).toContain("RM_DATE_INVALID");
    expect(executableSql).toContain("RM_EVIDENCE_IMMUTABLE_CONFLICT");
    expect(executableSql).toContain("RM_AUDIT_WORM_REQUIRED");
    expect(executableSql).toContain("CARGO_RM_REGISTRATION_APPENDED");
    expect(executableSql).toContain("RETURNING id, hash_sha512");
    expect(executableSql).toMatch(
      /REVOKE ALL ON TABLE public\.cargo_rm_registration_events\s+FROM PUBLIC, anon, authenticated, service_role/i,
    );
    expect(executableSql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_registrar_inscripcion_rm_cargo\(uuid, uuid, text, date, text\)\s+TO authenticated, service_role/i,
    );
  });
});
