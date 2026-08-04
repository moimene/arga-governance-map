#!/usr/bin/env bun
/**
 * Seed G3 Task 3 — Rule packs núcleo del tenant Garrigues (motor SLP).
 *
 * Espejo idempotente, service-role, de la migración
 * `supabase/migrations/20260804070000_g3_garrigues_rule_packs.sql` — mismo
 * contenido de payload, pensado para poder re-sembrar sin pasar por una
 * migración completa (p. ej. tras un reset de entorno de desarrollo). El
 * canal normal de aplicación en Cloud sigue siendo la migración; este script
 * es la vía alternativa/idempotente, no un sustituto.
 *
 * Antes de este seed el tenant Garrigues (`00000000-…0002`) tenía CERO rule
 * packs propios: los 59 existentes en Cloud son de ARGA (`…0001`) y no se
 * heredan entre tenants (RLS `rule_packs_tenant_isolation`:
 * `tenant_id = fn_current_tenant_id()`).
 *
 * 4 packs núcleo, ids namespaced `GARR_*` (rule_packs.id es TEXT PRIMARY KEY
 * GLOBAL — sin namespacing colisionaría con los ids de ARGA):
 *   - GARR_DECISION_ADMIN_UNICO  — decisión genérica del administrador único
 *     de una filial SLP (adopción UNIPERSONAL_ADMIN).
 *   - GARR_JUNTA_SOCIOS          — acuerdos de la Junta de Socios de la
 *     matriz, con el overlay de citas FIRMES Ley 2/2007 aprobado por el
 *     Comité Legal el 2026-08-04 (docs/legal/2026-08-04-decisiones-comite-
 *     legal-slp-garrigues.md, Decisión 2).
 *   - GARR_SOCIO_UNICO_FILIAL    — decisiones del socio único de sociedades
 *     filiales (adopción UNIPERSONAL_SOCIO).
 *   - GARR_CONSEJO_EAD           — Consejo de Administración colegiado de EAD
 *     Trust (el único órgano colegiado real del perímetro Garrigues).
 *
 * Uso: bun run scripts/seed-garrigues-rule-packs.ts [--commit]
 * Dry-run por defecto (solo imprime lo que haría). --commit ejecuta contra
 * Cloud. Requiere una service-role key en el entorno.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");
const VERSION = "1.0.0";

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);

// --- Contenido de los 4 payloads (espejo exacto de la migración SQL) -------
// Nota SISTEMA vs LEY: cuando "no aplica mayoría/quórum/convocatoria" es un
// hecho estructural de una decisión unipersonal (GARR_DECISION_ADMIN_UNICO,
// GARR_SOCIO_UNICO_FILIAL) se usa fuente 'SISTEMA' para no forzar una cita
// LSC de apoyo que no aporta nada al hecho en sí. Cuando SÍ hay una norma
// concreta que sostiene el campo (art. 210/15 LSC para la base de la
// atribución unipersonal; el overlay Ley 2/2007 completo para la Junta de
// Socios) se usa fuente 'LEY' con su referencia exacta a nivel de artículo
// (nunca apartado en NINGÚN string visible — ni `referencia` ni `redaccion`
// — Comité Legal 2026-08-04; el desglose por apartado, cuando aporta algo,
// vive solo en comentarios de código fuente como este, tras fix round 1).

const DECISION_ADMIN_UNICO_PAYLOAD = {
  id: "GARR_DECISION_ADMIN_UNICO",
  materia: "GARR_DECISION_ADMIN_UNICO",
  clase: "ORDINARIA",
  organoTipo: "CONSEJO",
  modosAdopcionPermitidos: ["UNIPERSONAL_ADMIN"],
  acta: {
    tipoActaPorModo: { UNIPERSONAL_ADMIN: "ACTA_CONSIGNACION_ADMIN" },
    requiereConformidadConjunta: false,
    requiereTranscripcionLibroActas: true,
  },
  votacion: {
    mayoria: {
      SA: { fuente: "LEY", formula: "decision_unica", referencia: "art. 210 LSC — administrador único (no aplica mayoría, decisión unipersonal)" },
      SL: { fuente: "LEY", formula: "decision_unica", referencia: "art. 210 LSC — administrador único (no aplica mayoría, decisión unipersonal)" },
      CONSEJO: { fuente: "LEY", formula: "decision_unica", referencia: "art. 210 LSC — administrador único (no aplica mayoría, decisión unipersonal)" },
    },
    abstenciones: "no_cuentan",
    votoCalidadPermitido: false,
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
      SA_2a: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
      SL: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
      CONSEJO: { valor: "no_aplica", fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
    },
  },
  convocatoria: {
    canales: { SA: [], SL: [] },
    antelacionDias: {
      SA: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — sin convocatoria, decisión unipersonal" },
      SL: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — sin convocatoria, decisión unipersonal" },
    },
    contenidoMinimo: [],
    documentosObligatorios: [
      { id: "propuesta", nombre: "Texto de la decisión del administrador único", condicion: "SIEMPRE" },
    ],
  },
  documentacion: {
    obligatoria: [
      { id: "decision_consignada", nombre: "Consignación escrita de la decisión", condicion: "SIEMPRE" },
    ],
    ventanaDisponibilidad: { dias: 0, fuente: "SISTEMA" },
  },
  postAcuerdo: {
    inscribible: false,
    instrumentoRequerido: "NINGUNO",
    publicacionRequerida: false,
  },
  plazosMateriales: {
    publicacion: [],
  },
};

const JUNTA_SOCIOS_PAYLOAD = {
  id: "GARR_JUNTA_SOCIOS",
  materia: "GARR_JUNTA_SOCIOS",
  clase: "ESTATUTARIA",
  organoTipo: "JUNTA_GENERAL",
  modosAdopcionPermitidos: ["MEETING", "UNIVERSAL"],
  acta: {
    tipoActaPorModo: { MEETING: "ACTA_JUNTA", UNIVERSAL: "ACTA_JUNTA" },
    requiereConformidadConjunta: false,
    requiereTranscripcionLibroActas: true,
  },
  votacion: {
    mayoria: {
      SA: { fuente: "LEY", formula: "reforzada art. 201.2 LSC", referencia: "art. 201.2 LSC — 2/3 capital presente (tramo 25-50% en 2ª conv.)" },
      SL: { fuente: "LEY", formula: "favor > 1/2_capital_total_con_voto", referencia: "art. 199.a LSC" },
      CONSEJO: { fuente: "LEY", formula: "favor > presentes_mitad", referencia: "art. 247.1 LSC" },
      // Doble mayoría de la exclusión de socio profesional — anidada aquí
      // (no en un nivel superior) a propósito: el extractor legacy
      // (extractMajorityFromRulePackParams, rule-pack-params.ts) solo lee
      // claves de PRIMER NIVEL del payload y nunca ha leído nada bajo
      // votacion.mayoria — ni esto ni el resto de packs del repo. No se toca.
      // `alcance` dice expresamente que esto NO es la mayoría general de la
      // Junta: la doble mayoría del art. 15 Ley 2/2007 rige SOLO la exclusión
      // (Comité Legal 2026-08-04, Decisión 2, regla transversal 3).
      // Fix round 1 (M-1): "; reembolso ex art. 16" retirado de `redaccion` —
      // esa cláusula NO está en la celda "Redacción para el sistema" del
      // registro legal (docs/legal/2026-08-04-...), venía de una paráfrasis
      // del plan. `referencia` sigue citando "arts. 15 y 16 Ley 2/2007" (el
      // reembolso del art. 16 queda cubierto por la cita, no narrado).
      sociosProfesionalesExclusion: {
        fuente: "LEY",
        formula: "mayoria_capital_y_mayoria_socios_profesionales",
        referencia: "arts. 15 y 16 Ley 2/2007",
        alcance: "EXCLUSION_SOCIO_PROFESIONAL_UNICAMENTE — no es la mayoría general de acuerdos de la Junta",
        redaccion: "Acuerdo motivado de la Junta, por causas legales o estatutarias; doble mayoría de capital y de socios profesionales",
      },
    },
    abstenciones: "no_cuentan",
    votoCalidadPermitido: false,
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0.5, fuente: "LEY", referencia: "art. 194.1 LSC" },
      SA_2a: { valor: 0.25, fuente: "LEY", referencia: "art. 194.1 LSC" },
      SL: { valor: 0, fuente: "LEY", referencia: "art. 198 LSC" },
      CONSEJO: { valor: "mayoria_miembros", fuente: "LEY", referencia: "art. 247.1 LSC" },
    },
  },
  convocatoria: {
    // Canal individual con acuse: la cita del CANAL es LSC supletoria +
    // art. 27.3 Estatutos (Comité Legal 2026-08-04, Decisión 2, regla
    // transversal "Canal de convocatoria"), no Ley 2/2007. El detalle de la
    // semántica de acuse (EAD interposición, etiquetada) vive en
    // reglaEspecifica.canalAcuseLey2007 más abajo, no en el código de canal.
    canales: { SA: ["BORME", "WEB_INSCRITA"], SL: ["COMUNICACION_INDIVIDUAL_CON_ACUSE"] },
    antelacionDias: {
      // 15 días para SL/SLP: la referencia es SIEMPRE "art. 176 LSC
      // (supletoria)", NUNCA Ley 2/2007 (que no regula plazos de
      // convocatoria) — Comité Legal 2026-08-04, Decisión 2, regla
      // transversal "Corrección de cita obligada". Misma cita literal que
      // prototype-rule-pack-fallback.ts:116 (Task 1) — no se inventa una
      // redacción nueva.
      SA: { valor: 30, fuente: "LEY", referencia: "art. 176.1 LSC" },
      SL: { valor: 15, fuente: "LEY", referencia: "art. 176 LSC (supletoria)" },
      SLP: { valor: 15, fuente: "LEY", referencia: "art. 176 LSC (supletoria)" },
    },
    contenidoMinimo: ["Fecha hora y lugar", "Orden del día", "Texto íntegro de la propuesta cuando proceda"],
    documentosObligatorios: [
      { id: "propuesta", nombre: "Texto íntegro de la propuesta", condicion: "SIEMPRE" },
      { id: "informe_admin", nombre: "Informe del administrador único", condicion: "SIEMPRE" },
    ],
  },
  documentacion: {
    obligatoria: [
      { id: "propuesta", nombre: "Propuesta íntegra" },
      { id: "informe_admin_justificacion", nombre: "Informe justificativo del administrador único" },
      { id: "derecho_informacion_287", nombre: "Derecho de información art. 287 LSC", condicion: "SIEMPRE" },
    ],
    ventanaDisponibilidad: { dias: 15, fuente: "LEY" },
  },
  // Fix round 1 (C-1): el art. 8 Ley 2/2007 OBLIGA a inscribir los cambios de
  // socios/administradores, pero no fija ningún plazo de días — el plazo (1
  // mes) es de derecho registral general. Mismo patrón que el pack hermano
  // ya aprobado por el Comité (20260612210000_item054_rule_packs_garrigues.sql):
  // la obligación cita Ley 2/2007 (ver overlay INSCRIBIBILIDAD_CAMBIO_SOCIOS
  // más abajo); el plazo cita "art. 83 RRM (1 mes)".
  postAcuerdo: {
    inscribible: true,
    instrumentoRequerido: "ESCRITURA",
    publicacionRequerida: true,
    plazoInscripcion: { dias: 30, fuente: "LEY", referencia: "art. 83 RRM (1 mes)" },
  },
  plazosMateriales: {
    inscripcion: { plazo_dias: 30, fuente: "LEY", referencia: "art. 83 RRM" },
    publicacion: ["BORME"],
  },
  reglaEspecifica: {
    // Overlay Ley 2/2007 — citas FIRMES, tabla completa del Comité Legal
    // 2026-08-04 (Decisión 2). "concentración": la rama SLP de
    // normative-framework.ts ("Ley 2/2007 + LSC supletoria") sigue siendo el
    // punto único del marco general; esto remite a esas 5 citas puntuales sin
    // repetir el framing general. "granularidad" (fix round 1, I-1): tanto
    // `referencia` como `redaccion` quedan a nivel de artículo — el apartado
    // 4.2/4.3 del art. 4 Ley 2/2007 NO aparece en ningún string del payload,
    // solo en el comentario de ese parámetro más abajo.
    overlayLey2007: [
      {
        parametro: "TRANSMISION_PARTICIPACION_SOCIO_PROFESIONAL",
        referencia: "art. 13 Ley 2/2007",
        fuente: "LEY",
        redaccion: "La condición de socio profesional es intransmisible salvo consentimiento de todos los socios profesionales, salvo que el contrato social lo module a mayoría de ellos",
      },
      {
        parametro: "SEPARACION_SOCIO_PROFESIONAL",
        referencia: "art. 14 Ley 2/2007",
        fuente: "LEY",
        redaccion: "Separación libre en sociedad de duración indefinida, eficaz desde la notificación, conforme a la buena fe",
      },
      {
        // Fix round 1 (M-1): "; reembolso ex art. 16" retirado de
        // `redaccion` — no está en la celda "Redacción para el sistema" del
        // registro legal, venía de una paráfrasis del plan. `referencia`
        // sigue citando "arts. 15 y 16 Ley 2/2007".
        parametro: "EXCLUSION_SOCIO_PROFESIONAL",
        referencia: "arts. 15 y 16 Ley 2/2007",
        fuente: "LEY",
        redaccion: "Acuerdo motivado de la Junta, por causas legales o estatutarias; doble mayoría de capital y de socios profesionales",
        alcance: "La doble mayoría también se anida en votacion.mayoria.sociosProfesionalesExclusion para la ficha del acuerdo de exclusión",
      },
      {
        // Fix round 1 (I-1): `redaccion`/`alcance` retiran los apartados
        // "(4.2)"/"(4.3)" — quedan a nivel de artículo. Desglose (solo aquí,
        // en código fuente, nunca en un string del payload): el art. 4 Ley
        // 2/2007 tiene dos apartados relevantes — 4.2 exige que la mayoría
        // de capital y votos pertenezca a socios profesionales; 4.3 exige
        // que el administrador único de una SLP sea socio profesional.
        parametro: "MAYORIA_SOCIOS_PROFESIONALES",
        referencia: "art. 4 Ley 2/2007",
        fuente: "LEY",
        redaccion: "La mayoría del capital y votos ha de pertenecer a socios profesionales; el administrador único de una SLP ha de ser socio profesional; la doble mayoría se exige señaladamente en la exclusión",
        alcance: "COMPOSICION_ORGANO_Y_JUNTA — invariante sondable (el administrador único figura también en el censo de socios), NO mayoría general de acuerdos de la Junta",
      },
      {
        // Fix round 1 (C-1): `alcance` ya no reclama sostener
        // `plazoInscripcion` — ese campo ahora cita "art. 83 RRM (1 mes)"
        // (el art. 8 Ley 2/2007 obliga a inscribir, no fija plazo de días).
        parametro: "INSCRIBIBILIDAD_CAMBIO_SOCIOS",
        referencia: "art. 8 Ley 2/2007",
        fuente: "LEY",
        redaccion: "Los cambios de socios y administradores constan en escritura pública y se inscriben",
        alcance: "Sostiene postAcuerdo.inscribible=true; el plazo de inscripción cita art. 83 RRM (Ley 2/2007 obliga a inscribir, no fija días)",
      },
    ],
    canalAcuseLey2007: {
      codigo: "COMUNICACION_INDIVIDUAL_CON_ACUSE",
      referencia: "LSC supletoria + art. 27.3 Estatutos",
      semanticaAcuse: "EAD_INTERPOSICION_ETIQUETADA",
      nota: "El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21).",
    },
  },
};

const SOCIO_UNICO_FILIAL_PAYLOAD = {
  id: "GARR_SOCIO_UNICO_FILIAL",
  materia: "GARR_SOCIO_UNICO_FILIAL",
  clase: "ORDINARIA",
  organoTipo: "SOCIO_UNICO",
  modosAdopcionPermitidos: ["UNIPERSONAL_SOCIO"],
  acta: {
    tipoActaPorModo: { UNIPERSONAL_SOCIO: "ACTA_CONSIGNACION_SOCIO" },
    requiereConformidadConjunta: false,
    requiereTranscripcionLibroActas: true,
  },
  votacion: {
    mayoria: {
      SA: { fuente: "LEY", formula: "decision_unica", referencia: "art. 15 LSC — decisiones del socio único (sociedad unipersonal; no aplica mayoría)" },
      SL: { fuente: "LEY", formula: "decision_unica", referencia: "art. 15 LSC — decisiones del socio único (sociedad unipersonal; no aplica mayoría)" },
      CONSEJO: { fuente: "LEY", formula: "decision_unica", referencia: "art. 15 LSC — decisiones del socio único (sociedad unipersonal; no aplica mayoría)" },
    },
    abstenciones: "no_cuentan",
    votoCalidadPermitido: false,
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
      SA_2a: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
      SL: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
      CONSEJO: { valor: "no_aplica", fuente: "SISTEMA", referencia: "No aplica — órgano unipersonal" },
    },
  },
  convocatoria: {
    canales: { SA: [], SL: [] },
    antelacionDias: {
      SA: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — sin convocatoria, decisión unipersonal" },
      SL: { valor: 0, fuente: "SISTEMA", referencia: "No aplica — sin convocatoria, decisión unipersonal" },
    },
    contenidoMinimo: [],
    documentosObligatorios: [
      { id: "propuesta", nombre: "Texto de la decisión del socio único", condicion: "SIEMPRE" },
    ],
  },
  documentacion: {
    obligatoria: [
      { id: "decision_consignada", nombre: "Consignación en el libro-registro de decisiones del socio único", condicion: "SIEMPRE" },
    ],
    ventanaDisponibilidad: { dias: 0, fuente: "SISTEMA" },
  },
  postAcuerdo: {
    inscribible: false,
    instrumentoRequerido: "NINGUNO",
    publicacionRequerida: false,
  },
  plazosMateriales: {
    publicacion: [],
  },
};

const CONSEJO_EAD_PAYLOAD = {
  id: "GARR_CONSEJO_EAD",
  materia: "GARR_CONSEJO_EAD",
  clase: "ORDINARIA",
  organoTipo: "CONSEJO",
  modosAdopcionPermitidos: ["MEETING"],
  acta: {
    tipoActaPorModo: { MEETING: "ACTA_CONSEJO" },
    requiereConformidadConjunta: false,
    requiereTranscripcionLibroActas: true,
  },
  votacion: {
    mayoria: {
      SA: { fuente: "LEY", formula: "favor > contra", referencia: "art. 201.1 LSC (mayoría ordinaria)" },
      SL: { fuente: "LEY", formula: "favor > 1/3_capital", referencia: "art. 198 LSC" },
      CONSEJO: { fuente: "LEY", formula: "favor > presentes_mitad", referencia: "art. 247.1 LSC" },
    },
    abstenciones: "no_cuentan",
    // Sin evidencia de previsión estatutaria expresa del voto de calidad para
    // el Consejo de EAD Trust (a diferencia del CdA de ARGA, donde SÍ está
    // verificado) — el default LSC es que NO existe sin previsión expresa.
    votoCalidadPermitido: false,
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0.25, fuente: "LEY", referencia: "art. 193.1 LSC" },
      SA_2a: { valor: 0, fuente: "LEY", referencia: "art. 193.2 LSC" },
      SL: { valor: 0, fuente: "LEY", referencia: "art. 198 LSC" },
      CONSEJO: { valor: "mayoria_miembros", fuente: "LEY", referencia: "art. 247.1 LSC" },
    },
  },
  // Fix round 1 (C-2): la convocatoria original citaba art. 176.1 LSC (que
  // regula EXCLUSIVAMENTE la Junta General) con antelación 30/15 días y
  // canales públicos (BORME, WEB_INSCRITA) — modelaba el Consejo como si
  // fuera una Junta. El Consejo se rige por el art. 246 LSC: lo convoca el
  // presidente, sin plazo mínimo legal, y la notificación es individual a
  // cada consejero, nunca pública. Reescrita solo esta sección; el resto del
  // payload (mayoría/quórum art. 247.1, voto de calidad no asumido) no
  // cambia.
  convocatoria: {
    canales: { SA: ["COMUNICACION_INDIVIDUAL_CON_ACUSE"], SL: ["COMUNICACION_INDIVIDUAL_CON_ACUSE"] },
    antelacionDias: {
      // Sin piso legal (art. 246 LSC no fija plazo mínimo): valor práctico
      // de referencia, no una cita de mínimo legal. `fuente: 'ESTATUTOS'`
      // (no 'PRACTICA_SOCIETARIA' — ese valor no existe en el tipo cerrado
      // `Fuente` de rules-engine/types.ts; 'ESTATUTOS' es la alternativa
      // válida ya prevista para este caso).
      SA: { valor: 5, fuente: "ESTATUTOS", referencia: "art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente" },
      SL: { valor: 5, fuente: "ESTATUTOS", referencia: "art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente" },
    },
    contenidoMinimo: ["Fecha hora y lugar", "Orden del día"],
    documentosObligatorios: [
      { id: "propuesta", nombre: "Propuesta de acuerdo", condicion: "SIEMPRE" },
    ],
  },
  documentacion: {
    obligatoria: [
      { id: "propuesta", nombre: "Propuesta de acuerdo", condicion: "SIEMPRE" },
    ],
    ventanaDisponibilidad: { dias: 0, fuente: "SISTEMA" },
  },
  postAcuerdo: {
    inscribible: false,
    instrumentoRequerido: "NINGUNO",
    publicacionRequerida: false,
  },
  plazosMateriales: {
    publicacion: [],
  },
  reglaEspecifica: {
    canalAcuseConsejo: {
      codigo: "COMUNICACION_INDIVIDUAL_CON_ACUSE",
      referencia: "art. 246 LSC — convocatoria del presidente a cada consejero",
      semanticaAcuse: "EAD_INTERPOSICION_ETIQUETADA",
      nota: "El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21).",
    },
  },
};

export const PACKS: Array<{ id: string; organoTipo: string; descripcion: string; payload: Record<string, unknown> }> = [
  {
    id: "GARR_DECISION_ADMIN_UNICO",
    organoTipo: "CONSEJO",
    descripcion: "Garrigues G3 — decisión genérica del administrador único (filiales SLP)",
    payload: DECISION_ADMIN_UNICO_PAYLOAD,
  },
  {
    id: "GARR_JUNTA_SOCIOS",
    organoTipo: "JUNTA_GENERAL",
    descripcion: "Garrigues G3 — acuerdos de la Junta de Socios de la matriz (overlay Ley 2/2007)",
    payload: JUNTA_SOCIOS_PAYLOAD,
  },
  {
    id: "GARR_SOCIO_UNICO_FILIAL",
    organoTipo: "SOCIO_UNICO",
    descripcion: "Garrigues G3 — decisiones del socio único de sociedades filiales",
    payload: SOCIO_UNICO_FILIAL_PAYLOAD,
  },
  {
    id: "GARR_CONSEJO_EAD",
    organoTipo: "CONSEJO",
    descripcion: "Garrigues G3 — Consejo de Administración colegiado de EAD Trust",
    payload: CONSEJO_EAD_PAYLOAD,
  },
];

async function ensureRulePack(admin: ReturnType<typeof createClient>, pack: (typeof PACKS)[number]) {
  const { data: existingPack, error: eSelPack } = await admin
    .from("rule_packs")
    .select("id")
    .eq("id", pack.id)
    .maybeSingle();
  if (eSelPack) fail(`rule_packs select '${pack.id}': ${eSelPack.message}`);

  if (!existingPack) {
    const { error: eIns } = await admin.from("rule_packs").insert({
      id: pack.id,
      tenant_id: GARRIGUES_TENANT,
      materia: pack.id,
      organo_tipo: pack.organoTipo,
      descripcion: pack.descripcion,
    });
    if (eIns) fail(`rule_packs insert '${pack.id}': ${eIns.message}`);
    console.log(`✓ rule_packs ${pack.id} creado`);
  } else {
    console.log(`… rule_packs ${pack.id} ya existía`);
  }

  const { data: existingVersion, error: eSelVer } = await admin
    .from("rule_pack_versions")
    .select("id")
    .eq("pack_id", pack.id)
    .eq("version", VERSION)
    .maybeSingle();
  if (eSelVer) fail(`rule_pack_versions select '${pack.id}@${VERSION}': ${eSelVer.message}`);

  if (!existingVersion) {
    const { error: eInsVer } = await admin.from("rule_pack_versions").insert({
      pack_id: pack.id,
      version: VERSION,
      payload: pack.payload,
      is_active: true,
      status: "ACTIVE",
      effective_from: new Date().toISOString().slice(0, 10),
    });
    if (eInsVer) fail(`rule_pack_versions insert '${pack.id}@${VERSION}': ${eInsVer.message}`);
    console.log(`✓ rule_pack_versions ${pack.id}@${VERSION} creada`);
  } else {
    console.log(`… rule_pack_versions ${pack.id}@${VERSION} ya existía`);
  }
}

async function main() {
  console.table(PACKS.map((p) => ({ id: p.id, organo_tipo: p.organoTipo, materia: p.payload.materia })));

  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar contra Cloud.");
    return;
  }
  if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  for (const pack of PACKS) await ensureRulePack(admin, pack);
  console.log("✓ Seed completado (idempotente) — 4 rule packs núcleo de Garrigues.");
}

main();
