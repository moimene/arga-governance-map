import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NON_ADOPTABLE_DOCUMENT_TYPES,
  isAdoptionMetadataRequired,
  requiresLegalReference,
} from "@/lib/secretaria/template-admin/metadata-policy";

const MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260718140000_secretaria_rpc_activation_metadata_guard.sql",
);

const sql = readFileSync(MIGRATION, "utf8");
const executableSql = sql.replace(/^\s*--.*$/gm, "");

/**
 * Codex adversarial P1-1 — defensa en profundidad de la activación.
 *
 * El Gate PRE vive en el cliente; sin este guard, una llamada directa a la RPC
 * `SECURITY DEFINER` podía dejar vigente una plantilla sin forma de adopción.
 * El criterio del servidor debe ser EL MISMO que el de metadata-policy.ts: si
 * divergen, el cliente y Cloud vuelven a contar cosas distintas.
 */
describe("guard de metadatos en la activación — paridad cliente/servidor", () => {
  it("el guard se aplica en el trigger, no solo en la RPC", () => {
    expect(executableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_template_state_transition",
    );
    expect(executableSql).toContain("ACTIVATION_METADATA_MISSING");
    expect(executableSql).toContain(
      "IF NEW.estado = 'ACTIVA' AND OLD.estado IS DISTINCT FROM 'ACTIVA' THEN",
    );
  });

  it("conserva los guards previos de transición gobernada y tenant inmutable", () => {
    expect(executableSql).toContain("direct template state transition forbidden; use governed RPC");
    expect(executableSql).toContain("template tenant_id is immutable");
    expect(executableSql).toContain("app.secretaria_template_state_transition");
  });

  it("los tipos no adoptables del servidor son exactamente los del cliente", () => {
    for (const tipo of NON_ADOPTABLE_DOCUMENT_TYPES) {
      expect(executableSql).toContain(`'${tipo}'`);
      expect(isAdoptionMetadataRequired(tipo)).toBe(false);
    }
  });

  it("la exención de referencia legal del servidor es la del cliente", () => {
    // Solo informes, y solo bajo soporte interno.
    for (const tipo of ["INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE", "INFORME_GESTION"]) {
      expect(executableSql).toContain(`'${tipo}'`);
      expect(requiresLegalReference({ tipo, organo_tipo: "SOPORTE_INTERNO" })).toBe(false);
      expect(requiresLegalReference({ tipo, organo_tipo: "JUNTA_GENERAL" })).toBe(true);
    }
    expect(executableSql).toContain("= 'SOPORTE_INTERNO'");
    // Y el escape universal sigue cerrado en ambos lados.
    expect(requiresLegalReference({ tipo: "MODELO_ACUERDO", organo_tipo: "SOPORTE_INTERNO" })).toBe(
      true,
    );
  });

  it("verifica el estado actual antes de imponer el guard y no modifica filas", () => {
    expect(executableSql).toContain("incumplen los metadatos mínimos");
    expect(executableSql).not.toMatch(/UPDATE\s+public\.plantillas_protegidas\s+SET/i);
    expect(executableSql).not.toMatch(/DELETE\s+FROM\s+public\.plantillas_protegidas/i);
  });

  it("la función de comprobación no queda expuesta a anon", () => {
    expect(executableSql).toContain(
      "REVOKE ALL ON FUNCTION public.fn_secretaria_template_activation_metadata_ok",
    );
  });
});
