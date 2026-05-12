import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actaDetalle = readFileSync(
  join(process.cwd(), "src/pages/secretaria/ActaDetalle.tsx"),
  "utf8",
);
const emitirCertificacion = readFileSync(
  join(process.cwd(), "src/components/secretaria/EmitirCertificacionButton.tsx"),
  "utf8",
);
const registryIntake = readFileSync(
  join(process.cwd(), "src/lib/secretaria/certification-registry-intake.ts"),
  "utf8",
);
const generarDocumento = readFileSync(
  join(process.cwd(), "src/pages/secretaria/GenerarDocumentoStepper.tsx"),
  "utf8",
);
const reunionHook = readFileSync(
  join(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
  "utf8",
);

describe("Secretaria certification gate regressions", () => {
  it("no emite certificaciones de acta con referencias por punto sin Acuerdo 360", () => {
    expect(actaDetalle).toMatch(/certificationPointRefs\.length > 0/);
    expect(actaDetalle).toContain("agreementIds={certificationAgreementRefs}");
    expect(actaDetalle).not.toContain("agreementIds={certificationRefs}");
    expect(emitirCertificacion).toMatch(/invalidAgreementRefs/);
  });

  it("no marca una certificacion como lista para registro si quedan referencias por punto", () => {
    expect(registryIntake).toMatch(/unresolvedPointReferences\.length === 0/);
    expect(registryIntake).toMatch(/agreementIds\.length > 0/);
  });

  it("no muestra archivado como completado sin vincular document_url al expediente", () => {
    const linkGuardIndex = generarDocumento.indexOf("linkError");
    const archivedIndex = generarDocumento.indexOf('setArchiveStatus("archived")');

    expect(generarDocumento).toMatch(/Documento archivado, pero no se pudo vincular al expediente/);
    expect(linkGuardIndex).toBeGreaterThan(0);
    expect(archivedIndex).toBeGreaterThan(linkGuardIndex);
  });

  it("genera actas con snapshot WORM de censo en lugar de NO_SNAPSHOT_HASH", () => {
    expect(reunionHook).toMatch(/fn_crear_censo_snapshot/);
    expect(reunionHook).toMatch(/p_snapshot_id: snapshotId/);
    expect(reunionHook).not.toMatch(/p_snapshot_id: null/);
  });
});
