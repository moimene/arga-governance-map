// Gate del informe preceptivo del Consejo de Socios (G3 Task 7, Garrigues SLP).
// art. 39.5.b Estatutos: el Consejo de Socios informa preceptivamente a la
// Junta de Socios, antes de que ésta decida, sobre determinadas materias
// reservadas (cotejo docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md,
// sección "COTEJO CON EL TEXTO VIGENTE DE LOS ESTATUTOS").
//
// Config sembrado SOLO en governing_bodies.config.informe_preceptivo_de del
// slug garrigues-junta-socios — ARGA no tiene esa clave en ningún órgano, así
// que este gate siempre resuelve requerido:false para ARGA (cero cambio).
//
// Espejo puro de la misma lógica implementada en SQL dentro del bloque
// INFORME_PRECEPTIVO_ORGANO de fn_refresh_agreement_document_requirements
// (supabase/migrations/20260805110000_g3_informe_preceptivo_gate.sql), que es
// quien realmente materializa el requisito — este helper no escribe nada, es
// la expresión testeable del criterio de matching.

export interface InformePreceptivoEntry {
  materia: string;
  organo_informante: string;
  // fuente/referencia/firmeza (y cualquier otra clave futura) son metadatos
  // transparentes al matching: no se leen aquí, solo materia+organo_informante.
  [key: string]: unknown;
}

export interface BodyConfigWithInformePreceptivo {
  informe_preceptivo_de?: InformePreceptivoEntry[] | null;
  [key: string]: unknown;
}

export interface InformePreceptivoResult {
  requerido: boolean;
  organoInformante: string | null;
}

const NONE: InformePreceptivoResult = { requerido: false, organoInformante: null };

/**
 * `organoAdoptante` es el `body_type` del órgano que adopta el acuerdo
 * (p.ej. 'JUNTA'). Solo la Junta puede disparar este gate — un órgano
 * consultivo informa, no acuerda (badge "Consultivo — no adopta acuerdos" en
 * src/lib/organo-naturaleza.ts). Esta comprobación es defensa en profundidad:
 * hoy `informe_preceptivo_de` solo existe en el config de la Junta, pero el
 * criterio no debe depender solo de qué config le llegue.
 */
export function resolveInformePreceptivo(
  materia: string,
  organoAdoptante: string,
  config: BodyConfigWithInformePreceptivo | null | undefined,
): InformePreceptivoResult {
  if (organoAdoptante !== "JUNTA") return NONE;

  const entries = config?.informe_preceptivo_de;
  if (!Array.isArray(entries)) return NONE;

  const match = entries.find((entry) => entry?.materia === materia);
  if (!match) return NONE;

  return { requerido: true, organoInformante: match.organo_informante ?? null };
}
