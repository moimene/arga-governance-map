import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PANEL = readFileSync(
  resolve(process.cwd(), "src/components/secretaria/AnnualAccountsArtifactPanel.tsx"),
  "utf8",
);
const HOOK = readFileSync(
  resolve(process.cwd(), "src/hooks/useAnnualAccountsArtifacts.ts"),
  "utf8",
);

describe("UI de ingestión EAD para cuentas anuales", () => {
  it("permite custodiar un fichero por componente y conserva el selector de evidencias", () => {
    expect(PANEL).toContain('type="file"');
    expect(PANEL).toContain("Fichero nuevo para custodia EAD");
    expect(PANEL).toContain("Custodiar con EAD Trust");
    expect(PANEL).toContain("useArchiveAnnualAccountsComponent");
    expect(PANEL).toContain("Seleccionar evidencia estructurada…");
    expect(PANEL).toContain("setSelectedIds");
  });

  it("informa en español que la custodia no es una firma", () => {
    expect(PANEL).toContain(
      "Máximo 15 MB. La custodia acredita la interposición y conservación del binario; no afirma una firma.",
    );
    expect(PANEL).toContain("custodiado y verificado por EAD Trust Evidence Manager");
    expect(PANEL).toContain("MAX_EAD_COMPONENT_BYTES");
    expect(PANEL).toContain("El fichero supera el límite de 15 MB de Evidence Manager.");
  });

  it("refresca candidatos y solo ofrece evidencia COMPLETED del punto y ejercicio exactos", () => {
    expect(HOOK).toContain("archiveAnnualAccountsComponentWithEADTrust");
    expect(HOOK).toContain('qc.invalidateQueries({ queryKey: ["secretaria"] })');
    expect(HOOK).toContain('.eq("source_object_type", "ANNUAL_ACCOUNTS_COMPONENT")');
    expect(HOOK).toContain('.eq("source_object_id", agendaItemId!)');
    expect(HOOK).toContain('verification.provider_status !== "COMPLETED"');
    expect(HOOK).toContain("source.meeting_id !== expected.meetingId");
    expect(HOOK).toContain("source.agenda_item_id !== expected.agendaItemId");
    expect(HOOK).toContain("source.fiscal_year !== expected.fiscalYear");
    expect(HOOK).not.toContain('.insert({');
  });
});
