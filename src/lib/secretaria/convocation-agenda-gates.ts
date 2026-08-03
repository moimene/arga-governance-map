export interface AnnualAccountsTimelinessInput {
  sessionDate?: string | null;
  title?: string | null;
  proposal?: string | null;
}

export interface AnnualAccountsTimelinessResult {
  exerciseYear: number | null;
  deadline: string | null;
  isLate: boolean;
  regularizationConditionIncluded: boolean;
  blocking: boolean;
  message: string | null;
}

function normalizeLegalText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta el ejercicio únicamente en el título y la propuesta del punto.
 * Devuelve null si no hay año o si los dos textos contienen ejercicios
 * incompatibles: en ese caso no se inventa cuál de ellos es el correcto.
 */
export function detectAnnualAccountsExercise(
  title?: string | null,
  proposal?: string | null,
): number | null {
  const candidates = new Set<number>();
  const text = `${title ?? ""}\n${proposal ?? ""}`;
  for (const match of text.matchAll(/\b(20\d{2})\b/gu)) {
    const year = Number(match[1]);
    if (Number.isInteger(year)) candidates.add(year);
  }

  return candidates.size === 1 ? Array.from(candidates)[0] : null;
}

export function hasAnnualAccountsRegularizationCondition(proposal?: string | null) {
  const normalized = normalizeLegalText(proposal);
  if (!normalized) return false;

  const acknowledgesLateness = /\bextempor\w*/u.test(normalized);
  const acknowledgesRegularization = /\bregulariz\w*/u.test(normalized);
  const disclaimsValidation = /\bsin\s+convalidar\b/u.test(normalized);

  return acknowledgesLateness && acknowledgesRegularization && disclaimsValidation;
}

/**
 * El art. 253.1 LSC fija el plazo de formulación en los tres meses siguientes
 * al cierre. Para ejercicios naturales, el último día es el 31 de marzo del
 * año siguiente. Una sesión posterior no se presenta como formulación regular:
 * exige reconocer expresamente la extemporaneidad, su regularización y que
 * el acuerdo no pretende convalidar el incumplimiento anterior.
 */
export function evaluateAnnualAccountsTimeliness(
  input: AnnualAccountsTimelinessInput,
): AnnualAccountsTimelinessResult {
  const exerciseYear = detectAnnualAccountsExercise(input.title, input.proposal);
  const deadline = exerciseYear === null
    ? null
    : `${exerciseYear + 1}-03-31`;
  const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(input.sessionDate ?? "")
    ? input.sessionDate!
    : null;
  const sessionYear = sessionDate ? Number(sessionDate.slice(0, 4)) : null;
  const financialYearNotClosed = Boolean(
    exerciseYear !== null && sessionYear !== null && exerciseYear >= sessionYear,
  );
  const isLate = Boolean(
    deadline && sessionDate && !financialYearNotClosed && sessionDate > deadline,
  );
  const regularizationConditionIncluded = hasAnnualAccountsRegularizationCondition(
    input.proposal,
  );
  const blocking = exerciseYear === null
    || financialYearNotClosed
    || (isLate && !regularizationConditionIncluded);

  return {
    exerciseYear,
    deadline,
    isLate,
    regularizationConditionIncluded,
    blocking,
    message: exerciseYear === null
      ? "Identifica un único ejercicio 20XX en el título o la propuesta; no puede faltar ni coexistir con otro ejercicio distinto."
      : financialYearNotClosed
        ? `El ejercicio ${exerciseYear} aún no está cerrado en la fecha de sesión indicada.`
        : !isLate || deadline === null
          ? null
          : blocking
            ? `La sesión supera el 31 de marzo de ${exerciseYear + 1}, plazo ordinario de formulación del ejercicio ${exerciseYear} (art. 253.1 LSC). La propuesta debe reconocer expresamente la formulación extemporánea, su regularización y que se adopta sin convalidar el incumplimiento anterior.`
            : `Formulación extemporánea del ejercicio ${exerciseYear}: la sesión supera el 31 de marzo de ${exerciseYear + 1}. La propuesta incorpora la regularización sin convalidar el incumplimiento anterior, para revisión jurídica.`
  };
}

export function hasSoleShareholderRepresentativeConditions(proposal?: string | null) {
  const normalized = normalizeLegalText(proposal);
  if (!normalized) return false;

  const isExpresslyConditional =
    /\bcondicionad\w*/u.test(normalized) ||
    /\bno\s+producira\s+efecto\b/u.test(normalized);
  const requiresPublicPower =
    /\bpoder\s+general\b/u.test(normalized) &&
    /\b(?:documento|instrumento|escritura)\s+public\w*/u.test(normalized) &&
    /\bart(?:iculo)?\.?\s*183\.?\s*1\b/u.test(normalized);
  const requiresFullCapitalEvidence =
    /(?:\b100\s*%|\bcien\s+por\s+cien\b)/u.test(normalized) &&
    /\b(?:capital|participaciones|acciones)\b/u.test(normalized) &&
    /\b(?:verific\w*|acredit\w*|prueba|evidencia)\b/u.test(normalized);
  const requiresNoCorporateAdministratorEvidence =
    /\b(?:ausencia|no\s+(?:existe|tiene|consta))\b[^.;\n]{0,90}\badministrador\w*\b[^.;\n]{0,60}\bpersona\s+juridica\b/u.test(normalized);

  return Boolean(
    isExpresslyConditional &&
    requiresPublicPower &&
    requiresFullCapitalEvidence &&
    requiresNoCorporateAdministratorEvidence
  );
}

/**
 * Genera una propuesta preparatoria y condicionada. No convierte el registro
 * DEMO del candidato en prueba de poder, capital o estructura del órgano.
 */
export function buildSoleShareholderRepresentativeProposal(input: {
  shareholderName: string;
  targetName: string;
  representativeName: string;
}) {
  const targetSentenceEnd = /[.!?]$/u.test(input.targetName.trim()) ? "" : ".";
  return [
    `Primero. Proponer, exclusivamente a efectos de preparar el expediente y sin afirmar la vigencia ni la suficiencia de ningún poder, la designación de ${input.representativeName} para representar a ${input.shareholderName} ante ${input.targetName}${targetSentenceEnd} La propuesta queda expresamente condicionada a la verificación previa y acumulativa de los requisitos siguientes.`,
    `Segundo. Antes de cualquier actuación o efecto, incorporar al expediente y verificar: (i) el poder general en documento público y su suficiencia conforme al artículo 183.1 de la Ley de Sociedades de Capital; (ii) prueba autoritativa de que ${input.shareholderName} ostenta el 100 % del capital con derecho de voto de ${input.targetName} en la fecha relevante; y (iii) prueba de la ausencia de administrador persona jurídica en ${input.targetName}, para no confundir esta representación de la socia con la representación orgánica del artículo 212 bis LSC.`,
    "Tercero. Solo después de superar las tres comprobaciones anteriores, la representante podrá asistir, intervenir y votar conforme a las instrucciones expresas del órgano competente de la sociedad representada, recibir comunicaciones y suscribir constancias que reflejen fielmente esas instrucciones.",
    "Cuarto. Requerirán instrucción previa y expresa del Consejo de Administración las modificaciones estatutarias, operaciones sobre capital, transformaciones o modificaciones estructurales, disolución, nombramiento o cese de administradores, operaciones vinculadas y cualesquiera materias reservadas por ley, estatutos o políticas del grupo.",
    "Quinto. La representante no podrá sustituir ni delegar estas facultades, salvo autorización previa y escrita del órgano competente de la sociedad representada.",
    "Sexto. La designación no producirá efecto mientras no se incorporen y validen las evidencias indicadas y, una vez cumplida esa condición, quedará sujeta a revocación expresa y a las instrucciones particulares aplicables a cada decisión.",
    "Séptimo. Facultar a la Secretaría del Consejo para recabar los documentos, documentar su validación, comunicar en su caso la designación a la filial y conservar las evidencias de recepción y custodia.",
    "Octavo. La interposición, mensajería o custodia electrónica realizada por EAD Trust se registrará separadamente y no constituye ni sustituye el poder público, el título de representación ni una firma jurídica.",
  ].join("\n\n");
}
