import type { EvalSeverity, ExplainNode } from "./types";

export interface AgreementDependencyInput {
  id: string;
  materia: string;
  ejercicio?: number;
  text?: string;
  heldOffice?: string | null;
  absorbsEntityId?: string | null;
  adoptionMode?: string | null;
  actorId?: string | null;
  date?: string;
}

export interface AgreementDependencyContext {
  auditRequired?: boolean;
  auditorAppointed?: boolean;
}

export interface AgreementDependencyIssue {
  code: string;
  severity: EvalSeverity;
  agreementId?: string;
  message: string;
}

export interface AgreementDependencyResult {
  ok: boolean;
  severity: EvalSeverity;
  issues: AgreementDependencyIssue[];
  explain: ExplainNode[];
}

const INDELEGABLE_KEYWORDS = [
  "politica general",
  "formulacion de cuentas",
  "supervision",
  "facultad indelegable",
  "art. 249 bis",
];

function hasMateria(agreements: AgreementDependencyInput[], materia: string, ejercicio?: number) {
  return agreements.some((agreement) =>
    agreement.materia === materia && (ejercicio === undefined || agreement.ejercicio === ejercicio)
  );
}

function issue(
  code: string,
  severity: EvalSeverity,
  message: string,
  agreementId?: string,
): AgreementDependencyIssue {
  return { code, severity, message, agreementId };
}

export function validateAgreementDependencies(
  agreements: AgreementDependencyInput[],
  context: AgreementDependencyContext = {},
): AgreementDependencyResult {
  const issues: AgreementDependencyIssue[] = [];

  for (const agreement of agreements) {
    if (agreement.materia === "APROBACION_CUENTAS" && context.auditRequired && !context.auditorAppointed) {
      issues.push(issue(
        "accounts_approval_without_required_auditor",
        "WARNING",
        "Se intenta aprobar cuentas sin auditor nombrado pese a obligacion de auditoria.",
        agreement.id,
      ));
    }

    if (
      agreement.materia === "DISTRIBUCION_DIVIDENDOS" &&
      !hasMateria(agreements, "APROBACION_CUENTAS", agreement.ejercicio)
    ) {
      issues.push(issue(
        "dividend_distribution_without_accounts_approval",
        "BLOCKING",
        "No consta aprobacion de cuentas del mismo ejercicio antes de distribuir dividendo.",
        agreement.id,
      ));
    }

    if (agreement.materia === "CESE_CONSEJERO" && agreement.heldOffice) {
      issues.push(issue(
        "dismissal_requires_office_redistribution",
        "BLOCKING",
        `El consejero cesado ostenta cargo ${agreement.heldOffice}; debe redistribuirse el cargo.`,
        agreement.id,
      ));
    }

    if (
      agreement.materia === "AUMENTO_CAPITAL" &&
      !hasMateria(agreements, "MODIFICACION_ESTATUTOS_CAPITAL")
    ) {
      issues.push(issue(
        "capital_increase_requires_statutes_capital_article",
        "BLOCKING",
        "El aumento de capital exige modificar el articulo estatutario de capital social en la agenda.",
        agreement.id,
      ));
    }

    if (
      agreement.materia === "FUSION_ABSORCION" &&
      !hasMateria(agreements, "DISOLUCION_ABSORBIDA")
    ) {
      issues.push(issue(
        "merger_requires_absorbed_company_dissolution_gate",
        "WARNING",
        "La fusion por absorcion requiere gate documental de disolucion de la absorbida en acto vinculado.",
        agreement.id,
      ));
    }

    if (agreement.materia === "DELEGACION_FACULTADES") {
      const text = agreement.text?.toLowerCase() ?? "";
      if (INDELEGABLE_KEYWORDS.some((keyword) => text.includes(keyword))) {
        issues.push(issue(
          "delegation_contains_indelegable_powers",
          "BLOCKING",
          "El texto de delegacion incluye facultades indelegables del art. 249 bis LSC.",
          agreement.id,
        ));
      }
    }
  }

  const solidaryByMatter = new Map<string, AgreementDependencyInput[]>();
  for (const agreement of agreements.filter((item) => item.adoptionMode === "SOLIDARIO")) {
    const key = `${agreement.materia}:${agreement.date ?? ""}`;
    const rows = solidaryByMatter.get(key) ?? [];
    rows.push(agreement);
    solidaryByMatter.set(key, rows);
  }
  for (const rows of solidaryByMatter.values()) {
    const actors = new Set(rows.map((row) => row.actorId).filter(Boolean));
    const texts = new Set(rows.map((row) => row.text?.trim()).filter(Boolean));
    if (actors.size > 1 && texts.size > 1) {
      issues.push(issue(
        "solidary_admins_contradictory_actions",
        "WARNING",
        "Dos administradores solidarios actuaron contradictoriamente sobre la misma materia.",
        rows[0].id,
      ));
    }
  }

  const hasBlocking = issues.some((item) => item.severity === "BLOCKING");
  const hasWarnings = issues.some((item) => item.severity === "WARNING");
  return {
    ok: !hasBlocking,
    severity: hasBlocking ? "BLOCKING" : hasWarnings ? "WARNING" : "OK",
    issues,
    explain: issues.map((item) => ({
      regla: item.code,
      fuente: "LEY",
      resultado: item.severity,
      mensaje: item.message,
    })),
  };
}

export function validateDelegationOfPowersVote(input: {
  totalBoardMembers: number;
  votesFavor: number;
}): AgreementDependencyResult {
  const threshold = (2 * input.totalBoardMembers) / 3;
  const ok = input.votesFavor >= threshold;
  const issues = ok ? [] : [issue(
    "delegation_faculties_two_thirds_not_reached",
    "BLOCKING",
    "La delegacion permanente de facultades requiere mayoria de 2/3 del consejo.",
  )];
  return {
    ok,
    severity: ok ? "OK" : "BLOCKING",
    issues,
    explain: [{
      regla: "Delegacion de facultades 2/3",
      fuente: "LEY",
      referencia: "art. 249.2 LSC",
      umbral: threshold,
      valor: input.votesFavor,
      resultado: ok ? "OK" : "BLOCKING",
      mensaje: `${input.votesFavor}/${input.totalBoardMembers} votos favorables.`,
    }],
  };
}
