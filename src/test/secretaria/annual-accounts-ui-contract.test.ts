import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panel = readFileSync(
  resolve(process.cwd(), "src/components/secretaria/AnnualAccountsArtifactPanel.tsx"),
  "utf8",
);
const hook = readFileSync(
  resolve(process.cwd(), "src/hooks/useAnnualAccountsArtifacts.ts"),
  "utf8",
);
const stepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ReunionStepper.tsx"),
  "utf8",
);

describe("Reunión — UI del set de cuentas anuales", () => {
  it("mounts the structured panel only on the exact FORMULACION_CUENTAS agenda row", () => {
    expect(stepper).toContain("AnnualAccountsArtifactPanel");
    expect(stepper).toContain('=== "FORMULACION_CUENTAS"');
    expect(stepper).toContain('d.source_table === "agenda_items"');
    expect(stepper).toContain("agendaItemId={d.source_id}");
    expect(stepper).toContain("Documentación previa para formulación de cuentas");
    expect(stepper).toContain('m.status === "DRAFT" || m.status === "CONVOCADA"');
    expect(stepper).toContain("Esta actuación no abre la sesión");
  });

  it("selects evidence by structured component and storage version rather than filename", () => {
    expect(panel).toContain("identificador de objeto, versión y hashes; nunca el nombre del fichero");
    expect(panel).toContain("Evidence Manager");
    expect(panel).toContain("candidate.binary.storage_object_id");
    expect(panel).toContain("candidate.binary.storage_version");
    expect(panel).toContain("candidate.binary.hash_sha256");
    expect(hook).toContain('binary.artifact_role !== "ANNUAL_ACCOUNTS_COMPONENT"');
    expect(hook).toContain("content_hash_sha512");
    expect(hook).not.toMatch(/file_?name/i);
    expect(panel).toContain("objeto EAD verificado");
    expect(panel).not.toContain("· objeto {component.storage_object_id}");
  });

  it("uses the governed RPC and makes supersession explicit", () => {
    expect(panel).toContain("Crear versión sustitutiva");
    expect(panel).toContain("Aprobar para someter e inmovilizar");
    expect(hook).toContain('supabase.rpc("fn_secretaria_fix_annual_accounts_set"');
    expect(hook).toContain("p_supersedes_set_id");
  });

  it("no ofrece elevar un fichero del navegador a ejecución final", () => {
    expect(panel).toContain("Custodia final no disponible");
    expect(panel).toContain("Pendiente de renderer autoritativo");
    expect(panel).toContain("no acepta un PDF o DOCX del navegador como ejecución final");
    expect(panel).toContain("generado y registrado de forma autoritativa en servidor");
  });
});
