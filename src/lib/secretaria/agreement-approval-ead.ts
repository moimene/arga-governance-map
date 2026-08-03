export interface AgreementApprovalEadState {
  documentArchived: boolean;
}

export interface AgreementApprovalEadAction {
  kind: "OPEN_GENERATOR" | "REGISTER_DOCUMENT_ARCHIVE";
  label: string;
  canApprove: boolean;
}

/**
 * El cierre documental del expediente no exige una firma electrónica.
 * El artefacto debe estar archivado y trazado; la interposición, mensajería o
 * e-archiving de EAD Trust se gestionan como servicios probatorios separados.
 */
export function resolveAgreementApprovalEadAction(
  state: AgreementApprovalEadState,
): AgreementApprovalEadAction {
  if (state.documentArchived) {
    return {
      kind: "REGISTER_DOCUMENT_ARCHIVE",
      label: "Registrar archivo documental",
      canApprove: true,
    };
  }

  return {
    kind: "OPEN_GENERATOR",
    label: "Preparar y archivar documento",
    canApprove: false,
  };
}
