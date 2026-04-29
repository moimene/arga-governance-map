export interface LegalPlaceholderMapping {
  canonical: string;
  aliases?: string[];
  description: string;
}

export interface LegalPlaceholderReplacement {
  raw: string;
  normalizedKey: string;
  canonical: string;
  aliases: string[];
}

export interface LegalTemplateNormalizationResult {
  template: string;
  replacements: LegalPlaceholderReplacement[];
  unresolvedPlaceholders: string[];
  manualPlaceholders: string[];
}

export interface LegalCodeEquivalence {
  legalCode: string;
  catalogRefs: string[];
  canonicalMaterias: string[];
  note?: string;
}

const LEGAL_PLACEHOLDER_MAP: Record<string, LegalPlaceholderMapping> = {
  ciudad: {
    canonical: "ciudad_emision",
    aliases: ["ciudad", "lugar"],
    description: "Ciudad de emision; si es reunion, usar lugar cuando aplique",
  },
  fecha_de_emision: {
    canonical: "fecha_emision",
    aliases: ["fecha_generacion"],
    description: "Fecha de emision del documento",
  },
  nombre_de_la_sociedad: {
    canonical: "denominacion_social",
    aliases: ["empresa_nombre"],
    description: "Denominacion social completa",
  },
  cif: {
    canonical: "cif",
    aliases: ["empresa_cif"],
    description: "CIF/NIF de la entidad",
  },
  domicilio_social: {
    canonical: "domicilio_social",
    aliases: ["empresa_domicilio"],
    description: "Domicilio social",
  },
  datos_registrales: {
    canonical: "registro_mercantil",
    aliases: ["empresa_registro_mercantil"],
    description: "Datos registrales",
  },
  tipo_social: {
    canonical: "forma_social",
    aliases: ["empresa_tipo_social", "tipo_social"],
    description: "SA/SL/SLU/SAU",
  },
  tipo_de_estructura_societaria: {
    canonical: "forma_social",
    aliases: ["empresa_tipo_social", "tipo_social"],
    description: "SA/SL/SLU/SAU",
  },
  ordinaria_extraordinaria: {
    canonical: "tipo_junta",
    aliases: ["tipo_junta_texto"],
    description: "Tipo de junta",
  },
  tipo_de_junta: {
    canonical: "tipo_junta",
    aliases: ["tipo_junta_texto"],
    description: "Tipo de junta",
  },
  lugar_de_celebracion: {
    canonical: "lugar",
    aliases: ["lugar_reunion", "lugar_junta"],
    description: "Lugar de reunion",
  },
  fecha_de_primera_convocatoria: {
    canonical: "fecha_primera_convocatoria",
    aliases: ["fecha_junta", "fecha"],
    description: "Fecha de primera convocatoria",
  },
  hora_de_primera_convocatoria: {
    canonical: "hora_primera_convocatoria",
    aliases: ["hora_junta", "hora_inicio"],
    description: "Hora de primera convocatoria",
  },
  fecha_de_segunda_convocatoria: {
    canonical: "fecha_segunda_convocatoria",
    description: "Fecha de segunda convocatoria",
  },
  hora_de_la_reunion: {
    canonical: "hora_inicio",
    aliases: ["hora_junta"],
    description: "Hora de reunion",
  },
  fecha_de_la_reunion: {
    canonical: "fecha",
    aliases: ["fecha_reunion", "fecha_junta"],
    description: "Fecha de reunion",
  },
  fecha_decision: {
    canonical: "fecha",
    aliases: ["fecha_decision", "fecha_cierre_expediente"],
    description: "Fecha de decision o cierre del expediente",
  },
  fecha_de_convocatoria: {
    canonical: "fecha_convocatoria",
    aliases: ["convocatoria_fecha"],
    description: "Fecha de convocatoria",
  },
  fecha_de_la_junta: {
    canonical: "fecha_junta",
    aliases: ["fecha", "fecha_reunion"],
    description: "Fecha de la junta",
  },
  hora_de_inicio: {
    canonical: "hora_inicio",
    description: "Hora de inicio",
  },
  hora_de_cierre: {
    canonical: "hora_fin",
    aliases: ["hora_cierre"],
    description: "Hora de cierre",
  },
  punto_x_del_orden_del_dia: {
    canonical: "orden_dia",
    aliases: ["puntos_orden_dia"],
    description: "Lista dinamica de puntos del orden del dia",
  },
  punto_1_del_orden_del_dia: {
    canonical: "orden_dia",
    aliases: ["puntos_orden_dia"],
    description: "Lista dinamica de puntos del orden del dia",
  },
  punto_2_del_orden_del_dia: {
    canonical: "orden_dia",
    aliases: ["puntos_orden_dia"],
    description: "Lista dinamica de puntos del orden del dia",
  },
  firma_del_organo_de_administracion: {
    canonical: "firma_organo_administracion",
    aliases: ["convocante_nombre", "cargo_convocante"],
    description: "Firmante de convocatoria",
  },
  firma_del_presidente_secretario: {
    canonical: "firma_presidente_secretario",
    aliases: ["presidente", "secretario"],
    description: "Firma de presidente/secretario",
  },
  presidente_de_la_junta_consejo: {
    canonical: "presidente",
    aliases: ["presidente_nombre"],
    description: "Presidente del organo",
  },
  presidente_de_la_junta: {
    canonical: "presidente",
    aliases: ["presidente_nombre"],
    description: "Presidente de la junta",
  },
  presidente_del_consejo: {
    canonical: "presidente",
    aliases: ["presidente_nombre"],
    description: "Presidente del consejo",
  },
  secretario_de_la_junta_consejo: {
    canonical: "secretario",
    aliases: ["secretario_nombre"],
    description: "Secretario del organo",
  },
  secretario_de_la_junta: {
    canonical: "secretario",
    aliases: ["secretario_nombre"],
    description: "Secretario de la junta",
  },
  secretario_del_consejo: {
    canonical: "secretario",
    aliases: ["secretario_nombre"],
    description: "Secretario del consejo",
  },
  porcentaje_de_capital_presente_o_representado: {
    canonical: "porcentaje_capital_presente",
    aliases: ["quorum_observado"],
    description: "Porcentaje de capital presente o representado",
  },
  porcentaje_de_capital_presente: {
    canonical: "porcentaje_capital_presente",
    aliases: ["quorum_observado"],
    description: "Porcentaje de capital presente",
  },
  relacion_de_asistentes: {
    canonical: "miembros_presentes",
    aliases: ["asistentes_lista", "lista_socios"],
    description: "Relacion de asistentes",
  },
  asistentes_consejo: {
    canonical: "miembros_presentes",
    aliases: ["asistentes_lista"],
    description: "Asistentes del consejo",
  },
  redaccion_del_acuerdo_x: {
    canonical: "acuerdos",
    aliases: ["texto_decision"],
    description: "Lista dinamica de acuerdos",
  },
  redaccion_del_acuerdo_1: {
    canonical: "acuerdos",
    aliases: ["texto_decision"],
    description: "Lista dinamica de acuerdos",
  },
  redaccion_del_acuerdo_2: {
    canonical: "acuerdos",
    aliases: ["texto_decision"],
    description: "Lista dinamica de acuerdos",
  },
  texto_de_la_decision: {
    canonical: "texto_decision",
    aliases: ["contenido_acuerdo", "propuesta_acuerdo", "propuesta_texto"],
    description: "Texto literal de la decision o acuerdo",
  },
  identidad_del_decisor: {
    canonical: "identidad_decisor",
    aliases: ["decisor", "nombre_decisor"],
    description: "Identidad del socio unico, administrador unico o decisor",
  },
  organo_social: {
    canonical: "organo_nombre",
    aliases: ["organo_convocante", "body_name"],
    description: "Nombre del organo social competente",
  },
  nueva_redaccion: {
    canonical: "nueva_redaccion",
    description: "Nueva redaccion estatutaria o contractual",
  },
  detalle_de_la_aplicacion: {
    canonical: "aplicacion_resultado",
    description: "Detalle de aplicacion del resultado",
  },
  nombre_del_certificante: {
    canonical: "nombre_certificante",
    aliases: ["secretario", "secretario_nombre"],
    description: "Nombre del certificante",
  },
  secretario_presidente: {
    canonical: "cargo_certificante",
    aliases: ["secretario_cargo", "cargo_certificante"],
    description: "Cargo del certificante",
  },
  cargo_del_certificante: {
    canonical: "cargo_certificante",
    aliases: ["secretario_cargo"],
    description: "Cargo del certificante",
  },
  transcripcion_literal_de_los_acuerdos: {
    canonical: "transcripcion_acuerdos",
    aliases: ["acuerdos", "texto_decision"],
    description: "Transcripcion literal de acuerdos certificados",
  },
};

const LEGAL_MANUAL_PLACEHOLDER_KEYS = new Set([
  "",
  "persona_s",
  "persona",
  "miembros",
  "detalle",
  "detalles",
  "condiciones",
  "descripcion",
  "importe",
  "plazo",
  "documentos",
]);

export const LEGAL_DYNAMIC_LIST_BLOCKS: Record<string, string> = {
  orden_dia:
    "{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}{{#unless @last}}\n{{/unless}}{{/each}}",
  acuerdos:
    "{{#each acuerdos}}{{ordinal}}. {{texto}}{{#unless @last}}\n{{/unless}}{{/each}}",
  miembros_presentes:
    "{{#each miembros_presentes}}{{nombre}}{{#if cargo}} ({{cargo}}){{/if}}{{#unless @last}}\n{{/unless}}{{/each}}",
  relacion_respuestas:
    "{{#each relacion_respuestas}}{{nombre}}{{#if sentido}} - {{sentido}}{{/if}}{{#if fecha}} - {{fecha}}{{/if}}{{#if firma_qes_ref}} - QES {{firma_qes_ref}}{{/if}}{{#unless @last}}\n{{/unless}}{{/each}}",
  documentacion:
    "{{#each documentacion}}{{descripcion}}{{#unless @last}}\n{{/unless}}{{/each}}",
  comprobaciones:
    "{{#each comprobaciones}}{{descripcion}}{{#unless @last}}\n{{/unless}}{{/each}}",
};

export const LEGAL_CODE_EQUIVALENCES: LegalCodeEquivalence[] = [
  { legalCode: "J-01", catalogRefs: ["J1", "J2"], canonicalMaterias: ["APROBACION_CUENTAS", "APLICACION_RESULTADO"] },
  { legalCode: "J-02", catalogRefs: ["J3"], canonicalMaterias: ["NOMBRAMIENTO_CESE"] },
  { legalCode: "J-03", catalogRefs: ["J4"], canonicalMaterias: ["NOMBRAMIENTO_AUDITOR"] },
  { legalCode: "J-04", catalogRefs: ["J5", "J6", "J7", "J9"], canonicalMaterias: ["MOD_ESTATUTOS", "AUMENTO_CAPITAL", "AUMENTO_CAPITAL_NO_DINERARIO", "SUPRESION_PREFERENTE"], note: "J9 solo si hay supresion de preferencia" },
  { legalCode: "J-05", catalogRefs: ["J2"], canonicalMaterias: ["APLICACION_RESULTADO"], note: "Dividendos/aplicacion de resultado" },
  { legalCode: "J-06", catalogRefs: [], canonicalMaterias: ["DELEGACION_EJECUCION"], note: "Punto transversal de delegacion de facultades de ejecucion" },
  { legalCode: "J-07", catalogRefs: ["J11", "J12", "J13", "J14", "J18"], canonicalMaterias: ["TRANSFORMACION", "FUSION", "ESCISION", "CESION_GLOBAL_ACTIVO", "DISOLUCION_LIQUIDADORES"] },
  { legalCode: "J-08", catalogRefs: ["J21"], canonicalMaterias: ["GARANTIA_PRESTAMO"], note: "Activos esenciales / art. 160.f LSC; si no supera umbral, puede quedar en Consejo/GENERAL" },
  { legalCode: "J-09", catalogRefs: ["J15"], canonicalMaterias: ["RETRIBUCION_ADMIN"] },
  { legalCode: "J-10", catalogRefs: ["CA-20", "J24"], canonicalMaterias: ["OPERACION_VINCULADA", "DISPENSAS_GENERALES"] },
  { legalCode: "CA-01", catalogRefs: ["CA-01"], canonicalMaterias: ["FORMULACION_CUENTAS"] },
  { legalCode: "CA-02", catalogRefs: ["CA-19"], canonicalMaterias: ["GENERAL"], note: "Politicas corporativas/reglamento" },
  { legalCode: "CA-03", catalogRefs: ["CA-11", "J21"], canonicalMaterias: ["PODERES_APODERADOS", "GARANTIA_PRESTAMO"], note: "Financiacion/garantias: J21 si supera umbral activo esencial; CA-11 si solo se otorgan facultades" },
  { legalCode: "CA-04", catalogRefs: ["CA-11"], canonicalMaterias: ["PODERES_APODERADOS"] },
  { legalCode: "CA-05", catalogRefs: [], canonicalMaterias: ["GENERAL"], note: "Distribucion de cargos del consejo; no reducir a nombramiento de secretario salvo que sea el unico objeto" },
  { legalCode: "CA-06", catalogRefs: [], canonicalMaterias: ["DELEGACION_EJECUCION"], note: "Punto transversal de protocolizacion" },
  { legalCode: "CA-07", catalogRefs: ["CA-16"], canonicalMaterias: ["GENERAL"], note: "Informe de administradores" },
  { legalCode: "CA-08", catalogRefs: [], canonicalMaterias: ["GENERAL"], note: "Operaciones relevantes no esenciales; no mapear automaticamente a directivos" },
  { legalCode: "CA-09", catalogRefs: [], canonicalMaterias: ["GENERAL"], note: "Comites internos; CA-19 solo si se aprueba reglamento/politica" },
  { legalCode: "CA-10", catalogRefs: [], canonicalMaterias: ["GENERAL"], note: "D&O" },
];

const EQUIVALENCE_BY_CODE = new Map(
  LEGAL_CODE_EQUIVALENCES.flatMap((entry) => {
    const aliases = new Set([entry.legalCode, normalizeLegalCode(entry.legalCode)]);
    return Array.from(aliases).map((alias) => [alias, entry] as const);
  }),
);

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeLegalPlaceholderKey(value: string) {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/d\.?\/d\.?a|dª|d\./g, " ")
    .replace(/[./]+/g, " ")
    .replace(/\b[0-9]+\b/g, "x")
    .replace(/\bx\b(?=\s*del\s+orden\s+del\s+dia)/g, "x")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeLegalCode(value: string) {
  const raw = stripAccents(value).trim().toUpperCase().replace(/\s+/g, "");
  const match = raw.match(/^(CA|J)-?0*([0-9]+)$/);
  if (!match) return raw;
  const prefix = match[1];
  const num = Number(match[2]);
  return prefix === "J" ? `J-${String(num).padStart(2, "0")}` : `CA-${String(num).padStart(2, "0")}`;
}

export function getLegalPlaceholderMapping(rawPlaceholder: string) {
  return LEGAL_PLACEHOLDER_MAP[normalizeLegalPlaceholderKey(rawPlaceholder)] ?? null;
}

export function legalListBlockFor(variable: string) {
  return LEGAL_DYNAMIC_LIST_BLOCKS[variable] ?? null;
}

export function normalizeLegalTemplateText(text: string): LegalTemplateNormalizationResult {
  const replacements: LegalPlaceholderReplacement[] = [];
  const unresolvedPlaceholders: string[] = [];
  const manualPlaceholders: string[] = [];

  const template = text.replace(/\[([^\][\n]+)\]/g, (full, raw: string) => {
    const normalizedKey = normalizeLegalPlaceholderKey(raw);
    const mapping = LEGAL_PLACEHOLDER_MAP[normalizedKey];
    if (!mapping) {
      const trimmed = raw.trim();
      unresolvedPlaceholders.push(trimmed);
      if (LEGAL_MANUAL_PLACEHOLDER_KEYS.has(normalizedKey)) manualPlaceholders.push(trimmed);
      return full;
    }
    replacements.push({
      raw: raw.trim(),
      normalizedKey,
      canonical: mapping.canonical,
      aliases: mapping.aliases ?? [],
    });
    return `{{${mapping.canonical}}}`;
  });

  return { template, replacements, unresolvedPlaceholders, manualPlaceholders };
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function expandLegalVariableAliases(input: Record<string, unknown>) {
  const output = { ...input };

  for (const mapping of Object.values(LEGAL_PLACEHOLDER_MAP)) {
    const aliases = mapping.aliases ?? [];
    const candidates = [mapping.canonical, ...aliases];
    const firstValueKey = candidates.find((key) => hasValue(output[key]));
    if (!firstValueKey) continue;
    const value = output[firstValueKey];
    for (const key of candidates) {
      if (!hasValue(output[key])) output[key] = value;
    }
  }

  return output;
}

function linesFromText(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*]|\d+[.)-])\s*/, "")
        .trim()
    )
    .filter(Boolean);
}

export function expandLegalStructuredVariables(input: Record<string, unknown>) {
  const output = expandLegalVariableAliases(input);

  if (!hasValue(output.orden_dia) && hasValue(output.orden_dia_texto)) {
    output.orden_dia = linesFromText(output.orden_dia_texto).map((line, index) => ({
      ordinal: String(index + 1),
      descripcion_punto: line,
    }));
  }

  if (!hasValue(output.acuerdos) && hasValue(output.acuerdos_texto)) {
    output.acuerdos = linesFromText(output.acuerdos_texto).map((line, index) => ({
      ordinal: String(index + 1),
      texto: line,
    }));
  }

  if (!hasValue(output.miembros_presentes) && hasValue(output.miembros_presentes_texto)) {
    output.miembros_presentes = linesFromText(output.miembros_presentes_texto).map((line) => ({
      nombre: line,
    }));
  }

  if (!hasValue(output.miembros_presentes) && hasValue(output.asistentes_texto)) {
    output.miembros_presentes = linesFromText(output.asistentes_texto).map((line) => ({
      nombre: line,
    }));
  }

  if (!hasValue(output.relacion_respuestas) && hasValue(output.relacion_respuestas_texto)) {
    output.relacion_respuestas = linesFromText(output.relacion_respuestas_texto).map((line) => ({
      nombre: line,
    }));
  }

  if (!hasValue(output.documentacion) && hasValue(output.documentacion_texto)) {
    output.documentacion = linesFromText(output.documentacion_texto).map((line) => ({
      descripcion: line,
    }));
  }

  if (!hasValue(output.comprobaciones) && hasValue(output.comprobaciones_texto)) {
    output.comprobaciones = linesFromText(output.comprobaciones_texto).map((line) => ({
      descripcion: line,
    }));
  }

  return expandLegalVariableAliases(output);
}

export function resolveLegalCodeEquivalence(code: string) {
  return EQUIVALENCE_BY_CODE.get(code.trim().toUpperCase()) ?? EQUIVALENCE_BY_CODE.get(normalizeLegalCode(code)) ?? null;
}

export function findMissingLegalTemplateVariables(template: string, variables: Record<string, unknown>) {
  const expanded = expandLegalVariableAliases(variables);
  const normalized = normalizeLegalTemplateText(template);
  const listRoots: string[] = [];
  const templateForMissing = normalized.template.replace(
    /\{\{#(?:each|with)\s+([a-zA-Z_][a-zA-Z0-9_.]*)[^}]*\}\}[\s\S]*?\{\{\/(?:each|with)\}\}/g,
    (_full, root: string) => {
      listRoots.push(root);
      return `{{${root}}}`;
    },
  );
  const names = Array.from(templateForMissing.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g))
    .map((match) => match[1])
    .concat(listRoots)
    .filter((name) => !["else", "this", "if", "unless", "each", "with"].includes(name));

  return Array.from(new Set(names.filter((name) => !hasValue(expanded[name]))));
}

export function legalTemplateNormalizerCatalog() {
  return {
    placeholders: LEGAL_PLACEHOLDER_MAP,
    legalCodeEquivalences: LEGAL_CODE_EQUIVALENCES,
  };
}
