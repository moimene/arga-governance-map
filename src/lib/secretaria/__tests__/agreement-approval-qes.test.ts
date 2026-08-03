import { describe, expect, it } from "vitest";
import { resolveAgreementApprovalEadAction } from "../agreement-approval-ead";

describe("cierre documental del flujo de aprobación Agreement 360", () => {
  it("no presenta navegación al generador como archivo ya realizado", () => {
    expect(
      resolveAgreementApprovalEadAction({
        documentArchived: false,
      }),
    ).toEqual({
      kind: "OPEN_GENERATOR",
      label: "Preparar y archivar documento",
      canApprove: false,
    });
  });

  it("permite cerrar el paso cuando el documento está archivado", () => {
    expect(
      resolveAgreementApprovalEadAction({
        documentArchived: true,
      }),
    ).toEqual({
      kind: "REGISTER_DOCUMENT_ARCHIVE",
      label: "Registrar archivo documental",
      canApprove: true,
    });
  });
});
