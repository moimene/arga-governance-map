import { beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const expand = read(
  "supabase/migrations/20260719130000_secretaria_registry_lifecycle_v2_expand.sql",
);
const helpersLockdown = read(
  "supabase/migrations/20260719170000_secretaria_registry_helpers_lockdown.sql",
);
const lockdown = read(
  "supabase/migrations/20260719180000_secretaria_registry_lifecycle_v2_lockdown.sql",
);
const publicWriters = [
  "fn_registry_prepare_filing",
  "fn_registry_record_presentation",
  "fn_registry_record_qualification",
  "fn_registry_submit_remedy",
  "fn_registry_record_inscription",
  "fn_registry_record_publication",
];

describe("Secretaría — registry lifecycle v2", () => {
  it("modela documento base múltiple sin reinterpretar el histórico", () => {
    expect(expand).toMatch(/ADD COLUMN IF NOT EXISTS base_document_kind text/i);
    expect(expand).toContain("ESCRITURA");
    expect(expand).toContain("INSTANCIA");
    expect(expand).toContain("CERTIFICACION");
    expect(expand).toMatch(/workflow_version smallint NOT NULL DEFAULT 1/i);
    expect(expand).toMatch(
      /registry_filings_v2_status_check[\s\S]*workflow_version = 1[\s\S]*status IN \([\s\S]*'PREPARADA'[\s\S]*'PUBLICADA'/i,
    );
    expect(expand).toMatch(
      /registry_filings_v2_source_domain_check[\s\S]*'AGREEMENT'[\s\S]*'CERTIFICATION'[\s\S]*'MANDATORY_BOOK'[\s\S]*'GROUP_CAMPAIGN_POST_TASK'/i,
    );
    expect(expand).not.toMatch(/UPDATE public\.registry_filings[\s\S]*base_document_kind/i);
  });

  it("persiste eventos append-only con idempotencia y evidencia", () => {
    expect(expand).toMatch(/CREATE TABLE IF NOT EXISTS public\.registry_filing_events/i);
    expect(expand).toMatch(/UNIQUE \(filing_id, operation_id\)/i);
    expect(expand).toMatch(/UNIQUE \(filing_id, sequence_no\)/i);
    expect(expand).toContain("evidence_artifact_id");
    expect(expand).toContain("request_fingerprint");
    expect(expand).toContain("fn_registry_events_append_only_guard");
    expect(expand).toMatch(/UPDATE OR DELETE[\s\S]*fn_registry_events_append_only_guard/i);
    expect(expand).toMatch(
      /AFTER INSERT ON public\.registry_filing_events[\s\S]*fn_audit_worm/i,
    );
    expect(expand).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.fn_registry_events_append_only_guard\(\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(expand).toMatch(
      /event_type <> p_expected_event_type[\s\S]*filing_id <> p_expected_filing_id[\s\S]*request_fingerprint <> p_expected_request_fingerprint/i,
    );
  });

  it("expone writers transaccionales endurecidos y comprueba una fila", () => {
    for (const functionName of publicWriters) {
      expect(expand).toContain(functionName);
      expect(expand).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) TO authenticated, service_role`,
          "i",
        ),
      );
    }
    expect(expand).toMatch(/SECURITY DEFINER[\s\S]*SET search_path TO 'public', 'extensions'/i);
    expect(expand).toContain("fn_secretaria_assert_role_allowed");
    expect(expand).toContain("GET DIAGNOSTICS v_affected = ROW_COUNT");
    expect(expand).toMatch(/IF v_affected <> 1 THEN/i);
  });

  it("valida artefactos por entidad y nivel probatorio de cada transición", () => {
    expect(expand).toMatch(
      /fn_registry_assert_artifact\([\s\S]*p_entity_id uuid[\s\S]*artifact\.entity_id = p_entity_id/i,
    );
    expect(expand).toMatch(/NULLIF\(btrim\(v_artifact\.document_url\), ''\) IS NULL/i);
    expect(expand).toMatch(
      /v_artifact\.status NOT IN \('APPROVED', 'SIGNED', 'ARCHIVED', 'ATTACHED'\)/i,
    );
    expect(expand).toMatch(
      /NOT p_allow_demo AND v_artifact\.evidence_status = 'DEMO_OPERATIVA'/i,
    );
    expect(expand).toMatch(
      /p_require_verified[\s\S]*v_artifact\.evidence_status <> 'EVIDENCE_VERIFIED'/i,
    );
  });

  it("cierra los dominios de origen y comprueba su tenant y entidad", () => {
    expect(expand).toMatch(
      /v_source_domain NOT IN \([\s\S]*'AGREEMENT'[\s\S]*'GROUP_CAMPAIGN_POST_TASK'/i,
    );
    expect(expand).toMatch(
      /FROM public\.agreements AS agreement[\s\S]*agreement\.id = p_source_id[\s\S]*agreement\.entity_id = p_entity_id/i,
    );
    expect(expand).toMatch(
      /FROM public\.certifications AS certification[\s\S]*signature_status = 'SIGNED'[\s\S]*evidence_id IS NOT NULL/i,
    );
    expect(expand).toMatch(
      /FROM public\.mandatory_books AS book[\s\S]*book\.entity_id = p_entity_id/i,
    );
    expect(expand).toMatch(
      /book\.status = 'CERRADO'[\s\S]*EXECUTE[\s\S]*FROM public\.societary_book_closures AS closure[\s\S]*closure\.book_id = \$1[\s\S]*USING p_source_id, p_tenant_id/i,
    );
    expect(expand).toMatch(
      /FROM public\.group_campaign_post_tasks AS post_task[\s\S]*post_task\.entity_id = p_entity_id/i,
    );
  });

  it("no permite que p_filing_id convierta una fila legacy", () => {
    expect(expand).toMatch(
      /SELECT filing\.status, filing\.workflow_version[\s\S]*v_existing_workflow_version <> 2[\s\S]*v_from_status <> 'PREPARADA'/i,
    );
    expect(expand).toMatch(
      /WHERE filing\.id = p_filing_id[\s\S]*filing\.workflow_version = 2[\s\S]*filing\.status = 'PREPARADA'/i,
    );
  });

  it("no inventa códigos ni propaga efectos societarios", () => {
    expect(expand).not.toContain("RRM-58");
    expect(expand).not.toContain("RM-201");
    expect(expand).not.toMatch(/UPDATE public\.agreements/i);
  });

  it("retira DML directo sólo en la migración de cierre", () => {
    // Este pin sigue siendo TEXTO y solo dice qué ORDENA la migración. Que el
    // corte esté VIVO en Cloud lo comprueba la sonda de comportamiento de más
    // abajo, que es la que puede fallar si alguien reconcede el privilegio.
    expect(expand).not.toMatch(/REVOKE (INSERT|UPDATE|DELETE) ON public\.registry_filings/i);
    expect(lockdown).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.registry_filings FROM anon, authenticated/i,
    );
    expect(lockdown).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON public\.registry_filing_events FROM anon, authenticated/i,
    );
  });

  it("cierra las helpers internas sin anticipar el corte de DML legacy", () => {
    for (const helper of [
      "fn_registry_assert_writer",
      "fn_registry_assert_artifact",
      "fn_registry_request_fingerprint",
      "fn_registry_existing_operation",
      "fn_registry_emit_event",
    ]) {
      expect(helpersLockdown).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${helper}\\([\\s\\S]*?FROM PUBLIC, anon, authenticated`,
          "i",
        ),
      );
    }
    expect(helpersLockdown).not.toMatch(
      /REVOKE (INSERT|UPDATE|DELETE) ON public\.registry_filings/i,
    );
    for (const functionName of publicWriters) {
      expect(helpersLockdown).not.toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\(`, "i"),
      );
    }
  });
});

/**
 * El corte de DML directo, comprobado CONTRA CLOUD y no contra el texto de la
 * migración.
 *
 * POR QUÉ. El pin de arriba asierta con una regex que un fichero de migración
 * contiene un REVOKE. Eso no prueba que el REVOKE esté aplicado: una migración
 * puede no haberse ejecutado, o un `GRANT` posterior puede haberla deshecho, y
 * el gate seguiría verde. `information_schema` no está expuesto por PostgREST y
 * este proyecto no expone `execute_sql`, así que el privilegio se mide por su
 * EFECTO: con el privilegio revocado PostgREST devuelve `42501` antes de tocar
 * ninguna fila.
 *
 * NO ES DESTRUCTIVO por construcción: el filtro apunta a un id inexistente, y
 * el error de privilegio se levanta antes de evaluarlo.
 */
describe("Secretaría — registry lifecycle v2: corte de DML vivo en Cloud", () => {
  const ID_INEXISTENTE = "00000000-0000-4000-8000-00000000dead";
  let cliente: SupabaseClient;

  beforeAll(async () => {
    // `sesionDe` lanza si no autentica: sin sesión no se mide nada.
    cliente = await sesionDe("ARGA");
  }, 60_000);

  it.each(["registry_filings", "registry_filing_events"])(
    "%s — un usuario autenticado no puede escribir directamente",
    async (tabla) => {
      const update = await cliente.from(tabla).update({ tenant_id: null }).eq("id", ID_INEXISTENTE).select();
      expect(update.error?.code, `${tabla}: UPDATE directo no fue denegado por privilegio`).toBe("42501");
      expect(update.error?.message ?? "").toMatch(/permission denied/i);

      const del = await cliente.from(tabla).delete().eq("id", ID_INEXISTENTE).select();
      expect(del.error?.code, `${tabla}: DELETE directo no fue denegado por privilegio`).toBe("42501");
      expect(del.error?.message ?? "").toMatch(/permission denied/i);
    },
    30_000,
  );

  it("la lectura sí está permitida: la sonda mide privilegio, no conectividad", async () => {
    const { error } = await cliente.from("registry_filings").select("id").limit(1);
    expect(error).toBeNull();
  }, 30_000);
});
