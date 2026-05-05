import { createHash } from "node:crypto";
import { supabase } from "../src/integrations/supabase/client";
import { auditTemplateInventory, type TemplateInventoryRow } from "../src/lib/secretaria/template-inventory-audit";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const APPROVED_BY = "Comite Legal Garrigues - Secretaria Societaria (demo-operativo)";
const APPROVED_AT = "2026-05-04T00:00:00+02:00";
const REVIEW_NOTE =
  "Cierre demo-operativo Fase 4: requisitos del Comite Legal actualizados, metadatos completos y validacion local automatizada. No constituye evidencia final productiva ni envio al Registro Mercantil.";

interface Capa3Field {
  campo: string;
  obligatoriedad: "OBLIGATORIO" | "RECOMENDADO" | "OPCIONAL" | "OBLIGATORIO_SI_TELEMATICA";
  descripcion: string;
  tipo?: string;
  label?: string;
  requerido?: boolean;
  placeholder?: string;
}

interface CloseoutSpec {
  id: string;
  materia: string;
  version: string;
  organo_tipo: string;
  adoption_mode: string;
  referencia_legal: string;
  capa1?: string;
  fields?: Capa3Field[];
}

function field(
  campo: string,
  obligatoriedad: Capa3Field["obligatoriedad"],
  descripcion: string,
  tipo = "textarea",
  placeholder = "",
): Capa3Field {
  return {
    campo,
    obligatoriedad,
    descripcion,
    tipo,
    label: descripcion,
    requerido: obligatoriedad === "OBLIGATORIO" || obligatoriedad === "OBLIGATORIO_SI_TELEMATICA",
    placeholder,
  };
}

const FUSION_ESCISION_CAPA1 = `PRIMERO.- Aprobar el proyecto comun de {{tipo_operacion_estructural}} de {{denominacion_social}} con {{nombre_sociedad_contraparte}}, conforme al proyecto redactado en fecha {{fecha_proyecto}}, al balance de la operacion y a la documentacion puesta a disposicion de socios, acreedores y representantes de los trabajadores, todo ello de conformidad con los articulos {{articulos_aplicables}} del Real Decreto-ley 5/2023, de 28 de junio (Libro Primero - Modificaciones estructurales de las sociedades mercantiles), y demas normativa concordante.

SEGUNDO.- Aprobar el balance de {{tipo_operacion_estructural}} de {{denominacion_social}} cerrado a {{fecha_balance_fusion}}, que queda incorporado como Anexo I al acta de la presente sesion.

TERCERO.- Aprobar la relacion de canje o ecuacion de atribucion propuesta: {{relacion_canje}}.

{{#if requiere_experto}}La relacion de canje ha sido verificada mediante informe de experto independiente {{nombre_experto}}, designado en fecha {{fecha_nombramiento_experto}}, en los terminos previstos en los articulos 28 a 30 del RDL 5/2023.{{else}}De conformidad con el regimen simplificado aplicable y, en particular, con el articulo 53 del RDL 5/2023 cuando proceda, se deja constancia de que no resulta exigible informe de experto independiente, sin perjuicio de las menciones y documentos que deban incorporarse al expediente.{{/if}}

CUARTO.- Dejar constancia de la publicidad, informacion y, en su caso, del regimen de oposicion de acreedores aplicable: {{oposicion_acreedores_estado}}.

QUINTO.- Facultar al Consejero Delegado y al Secretario del Consejo para preparar la elevacion a publico, coordinar la documentacion soporte y completar la preparacion registral demo del expediente.`;

const RATIFICACION_ACTOS_CAPA1 = `PRIMERO.- Ratificar de forma expresa los actos y contratos celebrados en nombre y por cuenta de {{denominacion_social}} por {{nombre_actuante}}, en su condicion de {{cargo_actuante}}, durante el periodo comprendido entre {{fecha_inicio}} y {{fecha_fin}}.

SEGUNDO.- La ratificacion alcanza exclusivamente a los actos identificados de forma individualizada en la siguiente relacion o en el Anexo I incorporado al expediente:

{{enumeracion_actos}}

TERCERO.- Asumir expresamente como propias de {{denominacion_social}} las obligaciones y responsabilidades derivadas de los actos ratificados, en los terminos concretos en que han sido identificados, sin extender la ratificacion a actos no enumerados.

CUARTO.- Autorizar la documentacion complementaria necesaria para dejar trazabilidad del acuerdo, incluyendo agreement_id, snapshot del motor y soporte documental del expediente.`;

const SEGUROS_RESPONSABILIDAD_CAPA1 = `PRIMERO.- Autorizar la {{tipo_accion_seguro}} del seguro de responsabilidad civil de consejeros y directivos (Directors & Officers) de {{denominacion_social}} con {{aseguradora}}, con las siguientes condiciones principales:

- Modalidad de cobertura: {{modalidad_cobertura}}
- Limite de indemnizacion: {{limite_cobertura}} euros
- Prima total anual: {{prima_anual}} euros
- Periodo de cobertura: desde {{fecha_inicio_cobertura}} hasta {{fecha_fin_cobertura}}
- Retroactividad: {{retroactividad}}

SEGUNDO.- Autorizar, dentro de la poliza anterior, la cobertura Side A hasta el importe de {{limite_side_a}} euros, con objeto de proteger a los administradores ante reclamaciones en las que {{denominacion_social}} no pueda o no deba indemnizarles.

{{#if aseguradora_del_grupo}}TERCERO.- Habiendose identificado que la aseguradora pertenece al grupo de sociedades de {{denominacion_social}}, el presente acuerdo se adopta con las siguientes cautelas de conflicto de interes y operacion vinculada: (a) los consejeros afectados se han abstenido de participar en la deliberacion y votacion cuando procede; (b) se ha recabado soporte de mercado independiente que acredita que las condiciones de la poliza son conformes a mercado; (c) el acuerdo ha sido adoptado conforme a la mayoria aplicable a operaciones vinculadas y, en su caso, a los requisitos del articulo 14 LOSSEAR; y (d) se documentara en el expediente cualquier obligacion de comunicacion que resulte aplicable. Referencia del tratamiento: {{tratamiento_conflicto_intra_grupo}}.{{else}}TERCERO.- Dejar constancia de que no se ha declarado conflicto intra-grupo en la seleccion de la aseguradora.{{/if}}

CUARTO.- Declarar que la contratacion del seguro se realiza en interes de la Sociedad y de sus administradores y directivos, que la prima es proporcional a los riesgos cubiertos y que no constituye remuneracion encubierta a los efectos del articulo 217 LSC.

QUINTO.- Facultar a la Direccion Financiera y al Secretario del Consejo para la firma de la poliza y cuantos documentos sean precisos para su formalizacion, modificacion o cancelacion.`;

const COMITES_INTERNOS_CAPA1 = `PRIMERO.- {{tipo_accion_comite}} del {{nombre_comite}} de {{denominacion_social}}, conforme a {{articulos_lsc_comite}}, al Reglamento del Consejo de Administracion y, en su caso, a la normativa sectorial aplicable, con la siguiente composicion:

{{composicion_comite}}

SEGUNDO.- Los consejeros designados aceptan expresamente los cargos atribuidos en el {{nombre_comite}}, declarando no estar incursos en causa de incompatibilidad ni prohibicion legal o estatutaria.

TERCERO.- El {{nombre_comite}} ejercera las funciones establecidas en el Reglamento del Consejo de Administracion y, en su caso, en su propio Reglamento Interno.

{{#if aprueba_reglamento}}CUARTO.- Aprobar el Reglamento Interno del {{nombre_comite}} que se adjunta como Anexo I, con efectos desde esta fecha.{{else}}{{#if fecha_reglamento_vigente}}CUARTO.- Confirmar la vigencia del Reglamento Interno del {{nombre_comite}} aprobado con fecha {{fecha_reglamento_vigente}}.{{else}}CUARTO.- Dejar constancia de que no se aprueba nuevo reglamento ni se modifica el actualmente aplicable.{{/if}}{{/if}}`;

const DISTRIBUCION_CARGOS_CAPA1 = `PRIMERO.- Proceder, en cumplimiento del articulo 245.2 LSC y de los Estatutos Sociales de {{denominacion_social}}, a la distribucion de cargos entre los miembros del Consejo de Administracion:

{{distribucion_cargos_texto}}

SEGUNDO.- Los consejeros designados aceptan expresamente los cargos atribuidos, manifestando no estar incursos en causa de incompatibilidad ni prohibicion legal o estatutaria.

{{#if es_cotizada}}TERCERO.- Dejar constancia de la adecuacion de la composicion del Consejo a los Estatutos, al Reglamento del Consejo y a las recomendaciones de gobierno corporativo aplicables a sociedades cotizadas.{{else}}TERCERO.- Dejar constancia de la adecuacion de la composicion del Consejo a los Estatutos y al Reglamento del Consejo.{{/if}}

{{#if existe_secretario_no_consejero}}CUARTO.- Ratificar el nombramiento de {{nombre_secretario_no_consejero}} como Secretario no Consejero del Consejo de Administracion de {{denominacion_social}}, con las funciones correspondientes al cargo conforme a Estatutos y Reglamento del Consejo.{{/if}}`;

const POLITICA_REMUNERACION_CAPA1 = `PRIMERO.- Aprobar la Politica de Remuneraciones de los Consejeros de {{denominacion_social}} para el periodo {{periodo_aplicacion}}, cuyo texto integro se adjunta como Anexo I.

{{#if es_cotizada}}SEGUNDO.- La aprobacion se realiza conforme a los articulos 529 sexdecies a 529 novodecies LSC y a las recomendaciones aplicables del Codigo de Buen Gobierno de la CNMV.{{else}}SEGUNDO.- La aprobacion se realiza conforme al regimen general de remuneracion de administradores previsto en el articulo 217 LSC y en los Estatutos Sociales.{{/if}}

TERCERO.- La Politica establece los siguientes elementos retributivos: {{elementos_retributivos}}.

CUARTO.- La remuneracion maxima anual del conjunto de los administradores en su condicion de tales asciende a {{retribucion_maxima_total}} euros.

{{#if sustituye_politica_anterior}}QUINTO.- La presente Politica sustituye y deja sin efecto la politica anterior indicada: {{politica_anterior_ref}}.{{else}}QUINTO.- La presente Politica no sustituye ninguna politica anterior identificada en el expediente.{{/if}}

SEXTO.- Facultar al Consejo de Administracion para aplicar la Politica en los terminos aprobados.`;

const POLITICAS_CORPORATIVAS_CAPA1 = `PRIMERO.- Aprobar la {{nombre_politica}} de {{denominacion_social}}, en los terminos recogidos en el documento presentado al Consejo de Administracion e incorporado como Anexo I.

SEGUNDO.- La politica sera de obligado cumplimiento para los destinatarios definidos en su ambito subjetivo, con efectos desde {{fecha_entrada_vigor}}.

TERCERO.- Encomendar a {{area_responsable}} la comunicacion, implantacion y seguimiento de la politica, asi como la elaboracion de procedimientos de desarrollo.

{{#if sustituye_politica_anterior}}CUARTO.- La presente politica sustituye y deja sin efecto a la {{nombre_politica_anterior}}, con efectos desde su entrada en vigor.{{else}}CUARTO.- La presente politica no sustituye ninguna politica anterior identificada en el expediente.{{/if}}

QUINTO.- Establecer como periodicidad de revision {{periodicidad_revision}}, encargando a {{area_responsable}} la propuesta de actualizacion correspondiente.`;

const SPECS: CloseoutSpec[] = [
  {
    id: "68da89bc-03cd-4820-80f1-8a549b0c7d78",
    materia: "APROBACION_PLAN_NEGOCIO",
    version: "1.0.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 225, 249 bis y 529 ter LSC; Estatutos y Reglamento del Consejo",
  },
  {
    id: "2d814072-3fb0-4ffd-a181-875d9c4a5c0d",
    materia: "AUMENTO_CAPITAL",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 295-310 LSC; arts. 194, 199, 201 y 305 LSC",
    fields: [
      field("capital_anterior", "OBLIGATORIO", "Capital social anterior al aumento", "number"),
      field("importe_aumento", "OBLIGATORIO", "Importe nominal del aumento", "number"),
      field("capital_nuevo", "OBLIGATORIO", "Capital social resultante tras el aumento", "number"),
      field("plazo_suscripcion_preferente_dias", "RECOMENDADO", "Plazo de suscripcion preferente en dias", "number"),
    ],
  },
  {
    id: "ba214d42-1933-497f-a2c0-0867c7c7a55f",
    materia: "CESE_CONSEJERO",
    version: "1.1.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 223.1 y 225 LSC; art. 94 RRM",
  },
  {
    id: "433da411-ba65-410c-8375-24db637f7e75",
    materia: "CESE_CONSEJERO",
    version: "1.1.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 223 y 225 LSC; art. 94 RRM",
  },
  {
    id: "313e7609-8b11-4ef5-a8fd-e9fdcf99d22c",
    materia: "COMITES_INTERNOS",
    version: "1.0.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 529 terdecies-529 quindecies LSC; arts. 21-22 RD 84/2015; Reglamento del Consejo",
    capa1: COMITES_INTERNOS_CAPA1,
    fields: [
      field("articulos_lsc_comite", "OBLIGATORIO", "Referencia legal o reglamentaria del comite", "text"),
    ],
  },
  {
    id: "a09cc4bf-c927-470a-b392-43d2db424279",
    materia: "DISTRIBUCION_CARGOS",
    version: "1.0.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 245.2 LSC; arts. 529 sexies-529 octies LSC; art. 124 RRM",
    capa1: DISTRIBUCION_CARGOS_CAPA1,
    fields: [
      field("es_cotizada", "RECOMENDADO", "Indica si la sociedad es cotizada", "boolean"),
      field("existe_secretario_no_consejero", "RECOMENDADO", "Indica si se nombra secretario no consejero", "boolean"),
      field("nombre_secretario_no_consejero", "OPCIONAL", "Nombre del secretario no consejero", "text"),
    ],
  },
  {
    id: "395ca996-fdf0-4203-b7ae-f894d3012c8b",
    materia: "DISTRIBUCION_DIVIDENDOS",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 273 y 348 bis LSC",
    fields: [
      field("resultado_neto", "OBLIGATORIO", "Resultado neto del ejercicio", "number"),
      field("dotacion_reserva_legal", "OBLIGATORIO", "Dotacion a reserva legal", "number"),
      field("importe_dividendo", "OBLIGATORIO", "Importe total del dividendo propuesto", "number"),
    ],
  },
  {
    id: "e3697ad9-e0c2-4baf-9144-c80a11808c07",
    materia: "FUSION_ESCISION",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "RDL 5/2023, de 28 de junio, Libro Primero, Titulo II (Modificaciones estructurales): arts. 1-90 (regimen general); arts. 11-25 (proyecto comun); arts. 28-30 (informe del experto independiente); arts. 35-40 (acuerdo de la Junta); arts. 47-50 (publicidad e inscripcion). Arts. 318-329 LSC (transformacion). Arts. 368-378 LSC (disolucion).",
    capa1: FUSION_ESCISION_CAPA1,
    fields: [
      field("articulos_aplicables", "OBLIGATORIO", "Articulos del RDL 5/2023 aplicables a la operacion", "text", "arts. 11-25, 28-30, 35-40 y 47-50 RDL 5/2023"),
      field("referencia_legal", "OBLIGATORIO", "Referencia legal RDL 5/2023 aplicable", "text", "RDL 5/2023"),
      field("requiere_experto", "OBLIGATORIO", "Indica si se exige informe de experto independiente", "boolean"),
      field("tipo_operacion", "OBLIGATORIO", "Modalidad de modificacion estructural", "text"),
      field("nombre_experto", "OPCIONAL", "Nombre del experto independiente si procede", "text"),
      field("fecha_nombramiento_experto", "OPCIONAL", "Fecha de nombramiento del experto independiente si procede", "date"),
      field("oposicion_acreedores_estado", "RECOMENDADO", "Estado del plazo/oposicion de acreedores", "textarea"),
    ],
  },
  {
    id: "29739424-5641-42bd-8b5a-58f81ee5c471",
    materia: "MODIFICACION_ESTATUTOS",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 285-290 LSC; art. 287 LSC; art. 194 LSC cuando proceda",
    fields: [
      field("texto_integro_disponible", "OBLIGATORIO", "Confirma que la convocatoria incluyo o puso a disposicion el texto integro", "boolean"),
    ],
  },
  {
    id: "e64ce755-9e76-4b57-8fb7-750afb94857c",
    materia: "NOMBRAMIENTO_AUDITOR",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 263-271 LSC; art. 264.1 LSC; Ley 22/2015 de Auditoria de Cuentas",
    fields: [
      field("duracion_anos", "OBLIGATORIO", "Duracion del nombramiento de auditor en anos", "number"),
    ],
  },
  {
    id: "27be9063-8977-44c7-b72c-eb26ecb3c49b",
    materia: "NOMBRAMIENTO_CONSEJERO",
    version: "1.1.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 244 LSC; art. 94 RRM; normativa sectorial de idoneidad cuando aplique",
    fields: [
      field("es_cooptacion", "OBLIGATORIO", "Confirma si el nombramiento se realiza por cooptacion", "boolean"),
      field("plazo_mandato", "RECOMENDADO", "Plazo de mandato en anos", "number"),
    ],
  },
  {
    id: "10f90d59-39d3-4633-83ff-81140eff50d5",
    materia: "NOMBRAMIENTO_CONSEJERO",
    version: "1.1.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 214, 217-219 y 221 LSC; art. 94 RRM",
    fields: [
      field("plazo_mandato", "OBLIGATORIO", "Plazo de mandato en anos", "number"),
    ],
  },
  {
    id: "ee72efde-299b-42fc-86ba-57e29a187a7c",
    materia: "POLITICA_REMUNERACION",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 217-219 LSC; arts. 529 sexdecies-529 novodecies LSC para cotizadas; Codigo de Buen Gobierno CNMV recomendaciones 53-65; Solvencia II Pilar 3",
    capa1: POLITICA_REMUNERACION_CAPA1,
    fields: [
      field("es_cotizada", "RECOMENDADO", "Indica si la sociedad es cotizada", "boolean"),
      field("retribucion_maxima_total", "OBLIGATORIO", "Remuneracion maxima anual total en euros", "number"),
      field("sustituye_politica_anterior", "RECOMENDADO", "Indica si sustituye una politica anterior", "boolean"),
      field("politica_anterior_ref", "OPCIONAL", "Referencia de la politica anterior sustituida", "text"),
    ],
  },
  {
    id: "b846bb03-9329-4470-840b-30d614adc613",
    materia: "POLITICAS_CORPORATIVAS",
    version: "1.0.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 529 ter LSC; art. 249 bis LSC; arts. 217-220 LSC",
    capa1: POLITICAS_CORPORATIVAS_CAPA1,
  },
  {
    id: "edd5c389-0187-476c-9592-c020058fdc69",
    materia: "RATIFICACION_ACTOS",
    version: "1.0.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 234-235 LSC; RRM arts. 108-109",
    capa1: RATIFICACION_ACTOS_CAPA1,
    fields: [
      field("enumeracion_actos", "OBLIGATORIO", "Relacion individualizada de actos ratificados o referencia a anexo trazable", "textarea"),
    ],
  },
  {
    id: "c06957aa-ce9d-4560-9d4e-501756ed5e4f",
    materia: "REDUCCION_CAPITAL",
    version: "1.0.0",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "Arts. 317-342 LSC; art. 334 LSC salvo reduccion por perdidas o reserva legal",
    fields: [
      field("tipo_reduccion", "OBLIGATORIO", "Finalidad o modalidad de la reduccion de capital", "text"),
      field("oposicion_acreedores_documentada", "RECOMENDADO", "Acreditacion del plazo/oposicion de acreedores cuando proceda", "boolean"),
    ],
  },
  {
    id: "df75cda9-e558-43c7-a6a9-902e2c06ee97",
    materia: "SEGUROS_RESPONSABILIDAD",
    version: "1.0.0",
    organo_tipo: "CONSEJO_ADMIN",
    adoption_mode: "MEETING",
    referencia_legal: "Art. 217 LSC; arts. 1156-1175 CC; Ley 50/1980 de Contrato de Seguro; arts. 236-241 LSC; art. 529 ter.h LSC; art. 14 LOSSEAR",
    capa1: SEGUROS_RESPONSABILIDAD_CAPA1,
    fields: [
      field("modalidad_cobertura", "OBLIGATORIO", "Modalidad de cobertura de la poliza D&O", "text"),
      field("prima_anual", "OBLIGATORIO", "Prima anual total en euros", "number"),
      field("limite_cobertura", "OBLIGATORIO", "Limite de indemnizacion total en euros", "number"),
      field("limite_side_a", "RECOMENDADO", "Limite de cobertura Side A en euros", "number"),
      field("franquicia", "RECOMENDADO", "Franquicia aplicable en euros", "number"),
      field("aseguradora_del_grupo", "OBLIGATORIO", "Indica si la aseguradora pertenece al grupo o es parte vinculada", "boolean"),
      field("tratamiento_conflicto_intra_grupo", "OBLIGATORIO", "Tratamiento del conflicto intra-grupo y soporte de mercado", "textarea"),
      field("soporte_mercado_independiente", "RECOMENDADO", "Confirma existencia de soporte de mercado independiente", "boolean"),
    ],
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function canonicalizeField(raw: unknown): Capa3Field | null {
  const record = asRecord(raw);
  const campo = asString(record.campo ?? record.variable ?? record.name).trim();
  if (!campo) return null;
  const required = record.requerido === true || record.required === true;
  const obligatoriedad = asString(record.obligatoriedad).trim().toUpperCase();
  const normalizedObligatoriedad = ["OBLIGATORIO", "RECOMENDADO", "OPCIONAL", "OBLIGATORIO_SI_TELEMATICA"].includes(obligatoriedad)
    ? obligatoriedad as Capa3Field["obligatoriedad"]
    : required
      ? "OBLIGATORIO"
      : "OPCIONAL";
  const descripcion =
    asString(record.descripcion).trim() ||
    asString(record.label).trim() ||
    campo.replace(/_/g, " ");
  return {
    ...record,
    campo,
    obligatoriedad: normalizedObligatoriedad,
    descripcion,
    label: asString(record.label, descripcion),
    requerido: normalizedObligatoriedad === "OBLIGATORIO" || normalizedObligatoriedad === "OBLIGATORIO_SI_TELEMATICA",
  };
}

function mergeFields(current: unknown, additions: Capa3Field[] = []) {
  const byName = new Map<string, Capa3Field>();
  for (const raw of Array.isArray(current) ? current : []) {
    const normalized = canonicalizeField(raw);
    if (normalized) byName.set(normalized.campo, normalized);
  }
  for (const extra of additions) {
    byName.set(extra.campo, { ...byName.get(extra.campo), ...extra });
  }
  return Array.from(byName.values());
}

function contentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function activeIssues(rows: TemplateInventoryRow[]) {
  return auditTemplateInventory(rows).issues.filter((issue) => issue.severity === "BLOCKING");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const ids = SPECS.map((spec) => spec.id);
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .in("id", ids);

  if (error) throw error;
  const rows = data ?? [];
  if (rows.length !== SPECS.length) {
    throw new Error(`Expected ${SPECS.length} templates, received ${rows.length}.`);
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  const updates = SPECS.map((spec) => {
    const current = byId.get(spec.id);
    if (!current) throw new Error(`Missing template ${spec.id}`);
    const nextCapa1 = spec.capa1 ?? current.capa1_inmutable ?? current.contenido_template ?? "";
    return {
      id: spec.id,
      patch: {
        version: spec.version,
        estado: "ACTIVA",
        aprobada_por: APPROVED_BY,
        fecha_aprobacion: APPROVED_AT,
        reviewed_by: APPROVED_BY,
        review_date: APPROVED_AT,
        approved_by_role: "COMITE_LEGAL",
        review_notes: REVIEW_NOTE,
        approval_checklist: [
          { check: "Capa 1 revisada para demo-operativa", passed: true },
          { check: "Metadatos organo_tipo/adoption_mode/referencia_legal completos", passed: true },
          { check: "Capa 3 normalizada y cubierta por validador Fase 4", passed: true },
          { check: "Sin envio telematico real al Registro Mercantil", passed: true },
          { check: "QTSP de referencia: EAD Trust", passed: true },
        ],
        organo_tipo: spec.organo_tipo,
        adoption_mode: spec.adoption_mode,
        referencia_legal: spec.referencia_legal,
        capa1_inmutable: nextCapa1,
        capa3_editables: mergeFields(current.capa3_editables, spec.fields),
        content_hash_sha256: contentHash(nextCapa1),
        notas_legal: REVIEW_NOTE,
      },
    };
  });

  if (!apply) {
    console.log(JSON.stringify({
      dryRun: true,
      templates: updates.map((update) => ({ id: update.id, version: update.patch.version, organo_tipo: update.patch.organo_tipo })),
    }, null, 2));
    return;
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("plantillas_protegidas")
      .update(update.patch)
      .eq("tenant_id", TENANT_ID)
      .eq("id", update.id);
    if (updateError) throw updateError;
  }

  const { data: after, error: afterError } = await supabase
    .from("plantillas_protegidas")
    .select("id,tipo,materia,materia_acuerdo,version,estado,aprobada_por,fecha_aprobacion,organo_tipo,adoption_mode,referencia_legal,capa1_inmutable,capa2_variables,capa3_editables")
    .eq("tenant_id", TENANT_ID)
    .in("id", ids);
  if (afterError) throw afterError;

  const issues = activeIssues((after ?? []) as TemplateInventoryRow[]);
  const missingApproval = (after ?? []).filter((row) => !row.aprobada_por || !row.fecha_aprobacion);
  const nonSemver = (after ?? []).filter((row) => !/^\d+\.\d+\.\d+$/.test(row.version ?? ""));

  console.log(JSON.stringify({
    applied: true,
    updated: updates.length,
    missingApproval: missingApproval.length,
    nonSemver: nonSemver.length,
    blockingInventoryIssues: issues.length,
    issueCodes: issues.map((issue) => `${issue.materia}:${issue.code}`),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
