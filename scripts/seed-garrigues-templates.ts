#!/usr/bin/env bun
/**
 * Seed G3 Task 8 — plantillas núcleo del tenant Garrigues.
 *
 * El brief pide "5 plantillas"; el modelo de datos exige `tipo` documental
 * distinto para convocatoria y acta (composer.ts: `templateTypesForDocumentType`
 * mapea CONVOCATORIA→tipo CONVOCATORIA y ACTA→tipo ACTA_SESION, nunca al revés),
 * así que el punto 3 del brief ("Junta de Socios") se materializa en 2 filas.
 * Total: 6 `plantillas_protegidas`.
 *
 *   1. MODELO_ACUERDO      materia=GARR_DECISION_ADMIN_UNICO   (Decisión admin único)
 *   2. ACTA_CONSIGNACION   materia=ACTA_CONSIGNACION_ADMIN_UNICO_SLP
 *   3. CONVOCATORIA        materia=CONVOCATORIA_JUNTA_SOCIOS_SLP
 *   4. ACTA_SESION         materia=ACTA_JUNTA_SOCIOS_SLP
 *   5. CERTIFICACION       materia=CERTIFICACION_ADMIN_UNICO_SLP
 *   6. INFORME_PRECEPTIVO  materia=INFORME_PRECEPTIVO_CONSEJO_SOCIOS_SLP
 *
 * GUARD Oleada 3A sondeado ANTES de diseñar este seed (migración
 * 20260712124000_secretaria_template_activation_integrity.sql):
 *
 *   - `tr_guard_template_state_transition` (BEFORE INSERT OR UPDATE) bloquea
 *     CUALQUIER INSERT con estado <> 'BORRADOR' (ERRCODE 42501), y cualquier
 *     UPDATE directo de `estado` fuera de la RPC. No hay atajo: todo insert
 *     entra en BORRADOR y sube de estado exclusivamente vía
 *     `fn_secretaria_transition_template_state`.
 *   - `fn_secretaria_transition_template_state` exige ADMIN_TENANT
 *     (`fn_secretaria_assert_active_template_admin`) SOLO para llamadas
 *     autenticadas humanas. Su primera rama es
 *     `IF NOT v_is_service THEN ... PERFORM assert_active_template_admin ...
 *     ELSE <sin check> END IF`, con `v_is_service :=
 *     fn_secretaria_is_service_role()` (JWT claim role=service_role — el que
 *     lleva la service-role key). Este script corre ÍNTEGRO como service-role
 *     y por tanto NO necesita admin@garrigues-demo.dev en ningún paso,
 *     incluida la promoción final a ACTIVA.
 *   - Máquina de estados real: BORRADOR→REVISADA→APROBADA→ACTIVA (no hay salto
 *     directo). REVISADA→APROBADA exige `p_aprobada_por`/`p_fecha_aprobacion`;
 *     ambos quedan persistidos en la fila y NO hace falta repetirlos en la
 *     transición APROBADA→ACTIVA.
 *   - RLS de `plantillas_protegidas`/`materia_template_binding` está acotada
 *     `TO authenticated`; `service_role` tiene BYPASSRLS + GRANT explícito
 *     (confirmado en la propia migración), así que las políticas no aplican
 *     a este script — el único gate real es el trigger de arriba.
 *
 * Binding del gate T7 (template_binding_key='INFORME_PRECEPTIVO_ORGANO:'||
 * agreement_kind): investigado `bindRequirementToTemplate`
 * (document-requirements/index.ts) — es una función pura NO conectada a
 * runtime (solo la usa su propio test). El camino REAL que sí ejecuta la UI
 * (`AgreementDocumentRequirementsPanel` → `useCreateAndLinkAgreementDocumentArtifact`
 * → `composer.ts:loadTemplateByRequest` → `selectProcessTemplate` de
 * `process-documents.ts`) resuelve por **`plantillas_protegidas.tipo`**
 * contra una lista de prioridad `[template_profile_id, ...templateTypesFor
 * DocumentType(document_kind)]`, donde `template_profile_id` es literalmente
 * el `template_binding_key` del requirement y `templateTypesForDocumentType
 * ('INFORME_PRECEPTIVO') = ['INFORME_PRECEPTIVO']` SIEMPRE está en la lista.
 * Conclusión: **una única plantilla `tipo='INFORME_PRECEPTIVO'` ACTIVA ya
 * desbloquea las 4 materias** (fallback genérico); no hace falta clonarla
 * 4 veces. La diferenciación por materia se resuelve con variables, no con
 * contenido — `useCreateAndLinkAgreementDocumentArtifact` ya arma
 * `baseVariables` por acuerdo (`buildRequirementBaseVariables`) con
 * `fundamento_legal` = el `legal_basis` que la RPC de T7 calculó PARA ESA
 * materia y ESE órgano informante — variable plana, sin punto, exenta de la
 * declaración en capa2 (Gate PRE solo exige catalogar variables con punto).
 *
 * Sobre el binding EXPLÍCITO: además de la plantilla, se siembran 4 filas en
 * `materia_template_binding` (P2.4 "Binding determinista materia→plantilla",
 * tabla real ya existente, consumida por `useTemplateBindings` en
 * CatalogoMaterias/CatalogoTab para la matriz de cobertura). NO participa en
 * la resolución runtime del gate T7 (confirmado: `composer.ts` nunca la
 * consulta) — se siembra para que la consola de gobierno de plantillas
 * muestre cobertura explícita y con motivo jurídico citado para las 4
 * materias, vía la RPC ya existente `fn_secretaria_assign_template_binding`
 * (que exige la plantilla ACTIVA y hace upsert idempotente sobre el mismo
 * índice único parcial).
 *
 * Naming (hallazgo T1): ningún código/label contiene "SL" — todos dicen
 * "SLP" explícito o usan vocabulario propio (GARR_/ADMIN_UNICO).
 *
 * Uso:
 *   bun run scripts/seed-garrigues-templates.ts            # dry-run (default)
 *   bun run scripts/seed-garrigues-templates.ts --commit   # ejecuta
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";
import { validateTemplateForActivation } from "../src/lib/secretaria/template-admin/gate-pre";
import type { PlantillaCandidate, EstadoPlantilla } from "../src/lib/secretaria/template-admin/types";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

function fail(msg: string): never { console.error(`✗ ${msg}`); process.exit(1); }
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (!SERVICE_KEY) fail("Falta la service-role key.");

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const APROBADA_POR = "Comité Legal Garrigues (seed G3 Task 8 — demo operativo)";
const FECHA_APROBACION = new Date().toISOString();
const NOTAS_LEGAL =
  "Contenido demo etiquetado — G3 Task 8 (2026-08-10). Entorno de validación funcional del " +
  "prototipo TGMS; no constituye asesoramiento jurídico ni documento societario real. No " +
  "afirma firma, QES, ERDS, envío ni entrega.";
const DISCLAIMER =
  "Documento generado como entorno de validación funcional del prototipo TGMS — sin eficacia " +
  "jurídica cualificada productiva.";

type TemplateSeed = {
  tipo: string;
  materia: string;
  organo_tipo: string;
  adoption_mode: string | null;
  referencia_legal: string;
  capa1_inmutable: string;
  label: string;
};

const TEMPLATES: TemplateSeed[] = [
  {
    label: "Decisión del administrador único",
    tipo: "MODELO_ACUERDO",
    materia: "GARR_DECISION_ADMIN_UNICO",
    organo_tipo: "ADMIN_UNICO",
    adoption_mode: "UNIPERSONAL_ADMIN",
    referencia_legal: "art. 210 LSC; arts. 25 y 32.1.d) Estatutos",
    capa1_inmutable: `DECISIÓN DEL ADMINISTRADOR ÚNICO

{{ENTIDAD.denominacion_social}}, {{ENTIDAD.tipo_social}}

En {{ENTIDAD.domicilio_social}}, en mi condición de administrador único de la sociedad, y en ejercicio de la facultad de organizar la administración de forma unipersonal que reconocen el artículo 210 de la Ley de Sociedades de Capital y los artículos 25 y 32.1.d) de los Estatutos Sociales, adopto la presente decisión sobre el asunto de referencia, que sustituye a la deliberación colegiada al no existir en la sociedad órgano de administración plural.

ASUNTO

{{EXPEDIENTE.proposal_text}}

DECISIÓN ADOPTADA

{{EXPEDIENTE.decision_text}}

La presente decisión queda consignada en el libro de decisiones del administrador único y a disposición de los socios conforme a la normativa aplicable.

${DISCLAIMER}`,
  },
  {
    label: "Acta de consignación de decisión del administrador único",
    tipo: "ACTA_CONSIGNACION",
    materia: "ACTA_CONSIGNACION_ADMIN_UNICO_SLP",
    organo_tipo: "ADMIN_UNICO",
    adoption_mode: "UNIPERSONAL_ADMIN",
    referencia_legal: "art. 210 LSC; arts. 25 y 32.1.d) Estatutos",
    capa1_inmutable: `ACTA DE CONSIGNACIÓN DE DECISIÓN DEL ADMINISTRADOR ÚNICO

{{ENTIDAD.denominacion_social}}

En {{ENTIDAD.domicilio_social}}, a {{SISTEMA.fecha_emision}}, el administrador único de la sociedad, en ejercicio de la facultad prevista en el artículo 210 de la Ley de Sociedades de Capital y en los artículos 25 y 32.1.d) de los Estatutos Sociales, deja constancia por escrito de la decisión adoptada, que se consigna en el libro correspondiente conforme al régimen legal y estatutario propio de las sociedades con administrador único.

DECISIÓN CONSIGNADA

{{EXPEDIENTE.decision_text}}

FUNDAMENTO

{{EXPEDIENTE.statutory_basis}}

El administrador único suscribe la presente acta de consignación, que queda incorporada al libro de decisiones de {{ENTIDAD.denominacion_social}}.

${DISCLAIMER}`,
  },
  {
    label: "Convocatoria de la Junta de Socios",
    tipo: "CONVOCATORIA",
    materia: "CONVOCATORIA_JUNTA_SOCIOS_SLP",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "arts. 27.3 y 27.4 Estatutos; art. 176 LSC (supletoria)",
    capa1_inmutable: `Querido socio:

Por medio de la presente le convoco, en mi condición de {{ORGANO.cargo_convocante}}, a la Junta de Socios de {{ENTIDAD.denominacion_social}}, que se celebrará el {{REUNION.fecha_junta}}, a las {{REUNION.hora_junta}}, en {{REUNION.lugar_junta}}, con arreglo al siguiente

ORDEN DEL DÍA

{{#each REUNION.orden_dia}}
{{ordinal}}. {{descripcion_punto}}
{{/each}}

De no alcanzarse el quórum de constitución en primera convocatoria, la Junta se celebrará en segunda convocatoria {{#if REUNION.segunda_convocatoria}}el {{REUNION.fecha_segunda_convocatoria}}, a las {{REUNION.hora_segunda_convocatoria}}, en el mismo lugar{{else}}en la fecha y lugar que se le comunique con la misma antelación{{/if}}.

La presente convocatoria se le remite por medio de comunicación individualizada y por escrito que asegura la recepción (art. 27.3 de los Estatutos Sociales), con la antelación mínima prevista en el artículo 27.4 de los Estatutos Sociales y, supletoriamente, en el artículo 176 de la Ley de Sociedades de Capital.

Un cordial saludo,

{{ORGANO.convocante_nombre}}
{{ORGANO.cargo_convocante}}

${DISCLAIMER} Reproduce, en su estructura (saludo personal, orden del día, cita de antelación), la carta real de convocatoria de la Junta de Socios de 2026 referida en la spec §3.6; no transcribe su texto literal, que no consta en este repositorio.`,
  },
  {
    label: "Acta de la Junta de Socios",
    tipo: "ACTA_SESION",
    materia: "ACTA_JUNTA_SOCIOS_SLP",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: "MEETING",
    referencia_legal: "art. 202 LSC (acta de la Junta); arts. 27.3, 27.4 y 39 Estatutos",
    // Patrón canónico ya reconocido por Gate PRE (gate-pre.ts:
    // `isCanonicalActaProjection = tipo==='ACTA_SESION' && capa1==='{{acta_rrm_texto_completo}}'`,
    // exención explícita de CAPA1_LENGTH≥100). Las actas de Junta MEETING no
    // se renderizan desde capa1 vía Handlebars — el pipeline real es
    // `fn_generar_acta(p_meeting_id, p_content, p_snapshot_id)` con
    // `p_content` ya ensamblado por `buildActaContent()` en el propio
    // stepper (Sprint C, CLAUDE.md). Se sigue el mismo patrón que las actas
    // reales del tenant en vez de inventar prosa que el pipeline ignoraría.
    capa1_inmutable: "{{acta_rrm_texto_completo}}",
  },
  {
    label: "Certificación del administrador único",
    tipo: "CERTIFICACION",
    materia: "CERTIFICACION_ADMIN_UNICO_SLP",
    organo_tipo: "ADMIN_UNICO",
    adoption_mode: null,
    referencia_legal: "art. 109 RRM (certificación sin visto bueno — administrador único); art. 31.3 Estatutos",
    capa1_inmutable: `CERTIFICACIÓN

El administrador único de {{ENTIDAD.denominacion_social}}, con {{ENTIDAD.nif}}, domicilio social en {{ENTIDAD.domicilio_social}}, inscrita en el Registro Mercantil de {{ENTIDAD.registro_mercantil}}, tomo {{ENTIDAD.tomo}}, folio {{ENTIDAD.folio}}, hoja {{ENTIDAD.hoja}}, inscripción {{ENTIDAD.inscripcion}},

CERTIFICA

Que, en ejercicio de la facultad de certificar que corresponde al administrador único conforme al artículo 31.3 de los Estatutos Sociales, y de conformidad con el artículo 109 del Reglamento del Registro Mercantil —que permite certificar sin necesidad de visto bueno cuando quien certifica es la única persona con facultad certificante—, el acuerdo de referencia fue válidamente adoptado:

{{EXPEDIENTE.texto_acuerdo_certificado}}

Y para que conste, expido la presente certificación SIN VISTO BUENO, por no existir en la sociedad presidente distinto del propio administrador único, en {{ENTIDAD.lugar}}, a {{SISTEMA.fecha_emision}}.

${DISCLAIMER}`,
  },
  {
    label: "Informe del órgano informante a la Junta",
    tipo: "INFORME_PRECEPTIVO",
    materia: "INFORME_PRECEPTIVO_CONSEJO_SOCIOS_SLP",
    organo_tipo: "JUNTA_GENERAL",
    adoption_mode: null,
    referencia_legal: "art. 39.5.b Estatutos; art. 225 LSC (deber de diligencia)",
    // Vars planas sin punto (fundamento_legal, materia_acuerdo, organo_nombre,
    // objeto_informe, comprobaciones_texto, conclusion_informe,
    // denominacion_social, fecha) las resuelve `buildRequirementBaseVariables`
    // (useSecretariaDocumentArtifacts.ts) DISTINTAS por acuerdo/materia — no
    // exigen declaración en capa2 (Gate PRE solo exige catalogar variables
    // con punto) y son la única plantilla de las 6 verificada de punta a
    // punta contra el camino real que ejecuta el botón "Crear y enlazar".
    capa1_inmutable: `INFORME PRECEPTIVO DEL CONSEJO DE SOCIOS A LA JUNTA DE SOCIOS

{{denominacion_social}}

De conformidad con el artículo 39.5.b) de los Estatutos Sociales de J&A Garrigues, S.L.P., el Consejo de Socios emite el presente informe con carácter preceptivo y previo a la decisión que sobre este asunto ha de adoptar la {{organo_nombre}}. El presente informe debe hallarse a disposición de los socios desde la fecha de la convocatoria, conforme al régimen de composición del círculo de socios profesionales de la Ley 2/2007.

FUNDAMENTO

{{fundamento_legal}}

OBJETO

{{objeto_informe}}

COMPROBACIONES

{{comprobaciones_texto}}

CONCLUSIÓN

{{conclusion_informe}}

Informe emitido a {{fecha}} como entorno de validación funcional — sin eficacia jurídica cualificada productiva. El contenido reproduce demo etiquetada del prototipo TGMS y no constituye el informe estatutario real del Consejo de Socios de J&A Garrigues, S.L.P.`,
  },
];

// Las 4 materias del gate T7 (docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md,
// "COTEJO CON EL TEXTO VIGENTE DE LOS ESTATUTOS" — las 4 entradas FIRME de
// governing_bodies.config.informe_preceptivo_de en garrigues-junta-socios).
const GATE_MATERIAS = [
  "ADMISION_SOCIO_CUOTA",
  "EXCLUSION_SOCIO_ESTATUTARIA",
  "CONTINUIDAD_SOCIO_POST_60",
  "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
] as const;

function toCandidate(t: TemplateSeed, id: string, estado: EstadoPlantilla): PlantillaCandidate {
  return {
    id,
    tipo: t.tipo,
    materia: t.materia,
    materia_acuerdo: t.materia,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado,
    organo_tipo: t.organo_tipo,
    adoption_mode: t.adoption_mode,
    tipo_social: "SLP",
    aprobada_por: APROBADA_POR,
    fecha_aprobacion: FECHA_APROBACION,
    referencia_legal: t.referencia_legal,
    capa1_inmutable: t.capa1_inmutable,
    capa2_variables: [],
    capa3_editables: [],
  };
}

const TRANSITION_ORDER: EstadoPlantilla[] = ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"];

async function transition(
  templateId: string,
  from: EstadoPlantilla,
  to: EstadoPlantilla,
  motivo: string,
  extra: { aprobadaPor?: string; fechaAprobacion?: string } = {},
): Promise<void> {
  const { data, error } = await admin.rpc("fn_secretaria_transition_template_state", {
    p_template_id: templateId,
    p_expected_from: from,
    p_to_state: to,
    p_motivo: motivo,
    p_operation_id: randomUUID(),
    p_aprobada_por: extra.aprobadaPor ?? null,
    p_fecha_aprobacion: extra.fechaAprobacion ?? null,
  });
  if (error) fail(`Transición ${from}→${to} falló para plantilla ${templateId}: ${error.message}`);
  const ok = (data as { ok?: boolean } | null)?.ok;
  if (!ok) fail(`Transición ${from}→${to} sin éxito para plantilla ${templateId}: ${JSON.stringify(data)}`);
}

/** Inserta (si falta) y sube de estado hasta ACTIVA. Idempotente: si la fila
 * ya está en un estado intermedio (ejecución previa parcial), reanuda desde
 * ahí; si ya está ACTIVA, no hace ninguna llamada. */
async function ensureTemplateActive(t: TemplateSeed): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from("plantillas_protegidas")
    .select("id, estado")
    .eq("tenant_id", GARRIGUES_TENANT)
    .eq("materia_acuerdo", t.materia)
    .maybeSingle();
  if (selErr) fail(`Select falló para ${t.materia}: ${selErr.message}`);

  let id = existing?.id as string | undefined;
  let estado = (existing?.estado as EstadoPlantilla | undefined) ?? undefined;

  if (!id) {
    const { data: ins, error: insErr } = await admin
      .from("plantillas_protegidas")
      .insert({
        tenant_id: GARRIGUES_TENANT,
        tipo: t.tipo,
        materia: t.materia,
        materia_acuerdo: t.materia,
        jurisdiccion: "ES",
        version: "1.0.0",
        estado: "BORRADOR",
        organo_tipo: t.organo_tipo,
        adoption_mode: t.adoption_mode,
        tipo_social: "SLP",
        referencia_legal: t.referencia_legal,
        capa1_inmutable: t.capa1_inmutable,
        capa2_variables: [],
        capa3_editables: [],
        notas_legal: NOTAS_LEGAL,
        aprobada_por: null,
        fecha_aprobacion: null,
        snapshot_rule_pack_required: false,
        contrato_variables_version: "1.1.0",
      })
      .select("id")
      .single();
    if (insErr || !ins) fail(`Insert BORRADOR falló para ${t.materia}: ${insErr?.message}`);
    id = ins!.id as string;
    estado = "BORRADOR";
    console.log(`  insertada BORRADOR ${id}`);
  } else {
    console.log(`  ya existe (${estado}) ${id}`);
  }

  const startIdx = TRANSITION_ORDER.indexOf(estado!);
  for (let i = startIdx; i < TRANSITION_ORDER.length - 1; i += 1) {
    const from = TRANSITION_ORDER[i];
    const to = TRANSITION_ORDER[i + 1];
    const extra =
      to === "APROBADA" ? { aprobadaPor: APROBADA_POR, fechaAprobacion: FECHA_APROBACION } : {};
    await transition(
      id,
      from,
      to,
      `Seed G3 Task 8 — plantilla núcleo Garrigues ${t.materia} (${from}→${to}).`,
      extra,
    );
    console.log(`  ${from} → ${to}`);
  }
  return id;
}

async function main(): Promise<void> {
  console.log("Plan:");
  console.table(TEMPLATES.map((t) => ({ label: t.label, tipo: t.tipo, materia: t.materia, organo_tipo: t.organo_tipo })));

  // Gate PRE self-check (contenido puro, sin red): captura CAPA1_LENGTH,
  // machine literals/metadata leak, organo_tipo canónico, formato de
  // referencia_legal y campos ACTIVA requeridos ANTES de tocar Cloud, en
  // dry-run o en --commit. La detección de duplicado funcional activo real
  // (que sí depende de Cloud) se repite más abajo solo en --commit con la
  // lista de ACTIVA ya sembradas.
  for (const t of TEMPLATES) {
    const candidate = toCandidate(t, "pending-seed-check", "ACTIVA");
    const gate = validateTemplateForActivation(candidate, {
      tenantId: GARRIGUES_TENANT,
      existingActiveTemplates: [],
      targetEstado: "ACTIVA",
    });
    if (gate.summary.blocking > 0) {
      fail(
        `Gate PRE bloqueante para ${t.materia}: ` +
          gate.issues.filter((i) => i.severity === "BLOCKING").map((i) => `${i.code} (${i.message})`).join("; "),
      );
    }
  }
  console.log("✓ Gate PRE local (validateTemplateForActivation) sin bloqueos para las 6 plantillas.\n");

  if (!COMMIT) {
    console.log("Dry-run. Re-ejecuta con --commit para escribir.");
    return;
  }

  // Repite el Gate PRE contra las ACTIVA reales de Cloud (incluye posibles
  // filas ya sembradas en una ejecución previa) — cubre DUP_ACTIVE_FUNCTIONAL_KEY,
  // que el self-check de arriba no puede evaluar sin red.
  const { data: existingRows, error: existErr } = await admin
    .from("plantillas_protegidas")
    .select("id, tipo, materia, materia_acuerdo, jurisdiccion, organo_tipo, adoption_mode, tipo_social, estado")
    .eq("tenant_id", GARRIGUES_TENANT);
  if (existErr) fail(`No se pudieron leer plantillas existentes: ${existErr.message}`);
  const existingActive = ((existingRows ?? []) as PlantillaCandidate[]).filter((t) => t.estado === "ACTIVA");

  for (const t of TEMPLATES) {
    const candidate = toCandidate(t, "pending-seed-check", "ACTIVA");
    const gate = validateTemplateForActivation(candidate, {
      tenantId: GARRIGUES_TENANT,
      existingActiveTemplates: existingActive,
      targetEstado: "ACTIVA",
    });
    if (gate.summary.blocking > 0) {
      fail(
        `Gate PRE bloqueante (Cloud) para ${t.materia}: ` +
          gate.issues.filter((i) => i.severity === "BLOCKING").map((i) => `${i.code} (${i.message})`).join("; "),
      );
    }
  }

  let informeTemplateId: string | null = null;
  for (const t of TEMPLATES) {
    console.log(`→ ${t.label} [${t.materia}]`);
    const id = await ensureTemplateActive(t);
    if (t.tipo === "INFORME_PRECEPTIVO") informeTemplateId = id;
    console.log(`✓ ${t.materia} (${t.tipo}) → ACTIVA (${id})\n`);
  }
  if (!informeTemplateId) fail("No se resolvió el id de la plantilla INFORME_PRECEPTIVO tras el seed.");

  console.log("→ materia_template_binding (P2.4, gobierno/cobertura — no participa en la resolución runtime del gate T7)");
  for (const materia of GATE_MATERIAS) {
    const { data: bindingId, error } = await admin.rpc("fn_secretaria_assign_template_binding", {
      p_payload: {
        tenant_id: GARRIGUES_TENANT,
        template_id: informeTemplateId,
        materia,
        doc_type: "INFORME_PRECEPTIVO",
        organo_tipo: "JUNTA_GENERAL",
        tipo_social: "SLP",
        jurisdiccion: "ES",
        adoption_mode: "ANY",
        priority: 100,
        active: true,
        selection_reason:
          `art. 39.5.b Estatutos: informe preceptivo del Consejo de Socios exigido antes de que la ` +
          `Junta de Socios decida sobre ${materia} (gate G3 Task 7; template_binding_key=` +
          `INFORME_PRECEPTIVO_ORGANO:${materia}).`,
      },
    });
    if (error) fail(`Binding falló para ${materia}: ${error.message}`);
    console.log(`  ✓ ${materia} → binding ${bindingId}`);
  }

  console.log(`\n✓ 6 plantillas núcleo ACTIVA + 4 materia_template_binding sembradas (idempotente).`);
}

main();
