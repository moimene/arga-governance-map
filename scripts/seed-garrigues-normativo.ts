#!/usr/bin/env bun
/**
 * Seed G4 Task 3 — Sistema normativo interno de Garrigues (39 documentos).
 *
 * Siembra en `policies` (tenant Garrigues, `00000000-…0002`) los 39
 * documentos del catálogo de Task 2 (`scripts/garrigues/normativo/
 * catalogo-normativo.ts`, NORMATIVO_CATALOG — única fuente de verdad, no se
 * reinterpreta aquí). Para cada uno: policy_code, title, normative_tier,
 * effective_date, current_version, summary, content_outline, data_provenance
 * y, SOLO para los 3 acreditados en fuente, owner_body_id + owner_function.
 *
 * Ownership — regla de oro (spec §6): se siembra SOLO el órgano que la fuente
 * hace RESPONSABLE. No vale sustituirlo por otro que la misma fuente coloca
 * en un papel distinto (informar, auxiliar), ni por el más parecido de los que
 * están modelados. Ante la duda, NULL.
 *
 * De ahí las tres listas de abajo, cada una con la cita literal que la
 * sostiene: OWNER_BY_CODE (órgano acreditado, FK real), OWNER_CARGO_BY_CODE
 * (la fuente nombra responsable, pero es un CARGO sin fila en
 * `governing_bodies` → FK NULL y el cargo en `owner_function`) y el resto, sin
 * atribución de ninguna clase.
 *
 * owner_function (columna text ya existente, pintada por 3 lecturas vivas:
 * PoliticasList "Propietario", PoliticaDetalle, EntidadDetalle) lleva el
 * `name` del órgano donde hay FK y, donde no la hay, el cargo LITERAL de la
 * fuente — que es lo que prescribe la spec §6 ("Donde la fuente calla: NULL,
 * owner_function descriptivo y etiqueta de procedencia"). Nunca se inventa:
 * los documentos cuya fuente no nombra a nadie quedan con los dos campos NULL.
 *
 * Contrato cero-cambio ARGA: este script NUNCA toca filas de
 * `00000000-…0001`. Ninguna columna nueva de Task 1 se popula para ARGA.
 *
 * Patrón: scripts/seed-garrigues-rule-packs.ts. Dry-run por defecto,
 * --commit para escribir. Requiere una service-role key en el entorno.
 * El seed ABORTA si algún slug de OWNER_BY_CODE no resuelve a un UUID real
 * en `governing_bodies` — nunca sembrar NULL en silencio por un slug roto.
 *
 * Uso: bun run scripts/seed-garrigues-normativo.ts [--commit]
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";
import { NORMATIVO_CATALOG, type NormativoEntry } from "./garrigues/normativo/catalogo-normativo";



const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  // SERVICE_ROLE_SECRET es el nombre que usa el .env real de este repo. Faltaba aquí
  // y el seed abortaba tras imprimir todo el resumen, igual que pasó con el seed del
  // tenant en G0/G1. Mismo orden que scripts/seed-garrigues-obligaciones.ts.
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";

// El cliente NO esta tipado contra `Database` — ese es un hallazgo abierto del
// arbol, no algo que se arregle aqui. Lo que si se arregla: los helpers
// anotaban `ReturnType<typeof createClient>`, que instancia los genericos con
// sus valores POR DEFECTO (`unknown` / `never`) y no coincide con lo que
// devuelve la llamada real. Se deriva de la fabrica de verdad, asi que el tipo
// sigue al codigo aunque cambie la firma de createClient.
function crearAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
type AdminClient = ReturnType<typeof crearAdmin>;

const COMMIT = process.argv.includes("--commit");

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);
if (NORMATIVO_CATALOG.length !== 39) fail(`NORMATIVO_CATALOG tiene ${NORMATIVO_CATALOG.length} entradas, se esperaban 39.`);

/**
 * Órgano RESPONSABLE acreditado en el propio documento, con la cita literal
 * que lo sostiene. `seleccion_forzada` marca los casos en que la fuente no
 * elige y el modelo obliga a elegir: la atribución es entonces del modelo, no
 * del documento, y así se etiqueta en `data_provenance`.
 */
const OWNER_BY_CODE: Record<string, { slug: string; evidencia: string; seleccion_forzada?: string }> = {
  "PBC-FT-10": {
    slug: "garrigues-caci",
    evidencia:
      'Manual PBC/FT v.10 §8.1.3: "El CACI es el órgano de control interno de GARRIGUES en materia de prevención del blanqueo de capitales y de la financiación del terrorismo".',
  },
  "PI-14": {
    slug: "garrigues-comite-editorial-global",
    evidencia:
      'PI-14 §2: "Las dudas e incidencias que se planteen en los procedimientos indicados deberán ser resueltas por los comités editoriales que se indican en el Anexo 1".',
    // El Anexo 1 lista CUATRO comités editoriales sin jerarquía entre ellos
    // (Global, Latinoamérica, Portugal y Garrigues Digital). La fuente no
    // designa uno; se toma el Global porque es el único con fila en
    // `governing_bodies`. La elección es del modelo de datos.
    seleccion_forzada:
      "El Anexo 1 de PI-14 nombra cuatro comités editoriales (Global, Latinoamérica, Portugal y Garrigues Digital) sin jerarquía entre ellos. Se atribuye al Global por ser el único modelado como órgano; la fuente no hace esa elección.",
  },
  "PI-30": {
    slug: "garrigues-comite-gobernanza-ia",
    evidencia:
      'PI-30 §6: "El Comité de IA del Despacho es responsable de supervisar, evaluar, orientar y promover el uso responsable, eficaz y conforme a Derecho de las tecnologías de IA en el contexto jurídico, con un enfoque integral que abarca consideraciones legales, técnicas, estratégicas y éticas". La equivalencia con el "Comité de Gobernanza de la Inteligencia Artificial" del sistema de gobierno corporativo no es una conjetura por parecido de nombre: la misión que la página de gobierno corporativo le asigna (scripts/garrigues/gobierno/comites-2026.json, volcada verbatim) reproduce esa misma frase.',
  },
};

/**
 * Documentos cuyo responsable la fuente SÍ nombra, pero como CARGO unipersonal
 * que no tiene fila en `governing_bodies` (está modelado como persona). El
 * comité que aparece junto al cargo NO lo sustituye: en los tres casos del
 * PPD y del Código Ético su papel es auxiliar o informar, no responder.
 */
const OWNER_CARGO_BY_CODE: Record<string, { funcion: string; evidencia: string }> = {
  "PI-31": {
    funcion: "Senior Partner (cargo unipersonal, no órgano de gobierno)",
    evidencia:
      'PI-31 §4: "El Responsable de la gestión del SII de Garrigues, designado por el órgano de administración, es el Senior Partner de la Firma, órgano unipersonal…". No existe "garrigues-senior-partner" en governing_bodies (verificado contra Cloud, 22 órganos): el Senior Partner está modelado como cargo/persona. No se sustituye por el Consejo de Socios que preside.',
  },
  "CE-2023": {
    funcion: "Senior Partner (cargo unipersonal, no órgano de gobierno)",
    evidencia:
      'Código Ético art. 43.1: "Corresponde al Senior Partner velar por la aplicación de este Código y establecer los criterios interpretativos en relación con el mismo, una vez oído el Consejo de Socios. Además, el Órgano de Administración adoptará o propondrá cuantas directrices y procedimientos resulten adecuados para desarrollar lo previsto en el Código Ético, previo informe del Comité de Práctica Profesional de Garrigues". El Comité de Práctica Profesional solo INFORMA: no se le atribuye la responsabilidad que el artículo pone en el Senior Partner.',
  },
  "PPD-01": {
    funcion: "Senior Partner (supervisión) y socio director (aprobación) — cargos, no órganos de gobierno",
    evidencia:
      'PPD-01 §8.1: "Sin perjuicio de las funciones otorgadas al socio director del Despacho en relación con la aprobación del Manual del sistema de gestión de riesgos penales establecido en Garrigues y el Modelo organizativo del PPD, la supervisión del funcionamiento y cumplimiento del Programa corresponderá al Senior Partner, debidamente auxiliado por el Comité de Práctica Profesional". El Comité AUXILIA al Senior Partner: no es el responsable.',
  },
  "PPD-02": {
    funcion: "Senior Partner (supervisión) y socio director (aprobación) — cargos, no órganos de gobierno",
    evidencia:
      "El propio PPD-02 no obra en el expediente. La atribución procede de PPD-01 §8.1, que nombra expresamente el Modelo organizativo del PPD al referirse a la aprobación por el socio director y a la supervisión por el Senior Partner auxiliado por el Comité de Práctica Profesional.",
  },
  "PPD-CAT": {
    funcion: "Responsables de los Departamentos de práctica (no es un órgano de gobierno)",
    evidencia:
      'El Catálogo no menciona ningún comité. Su propio texto dice que "recopila, en un único Catálogo ejemplificativo, las referidas situaciones identificadas por los responsables de los distintos Departamentos de práctica", y PPD-01 §3 remite a los Documentos de medidas de prevención de carácter específico de esos departamentos. La tabla de ownership de la spec §6 no incluye PPD-CAT: la atribución al Comité de Práctica Profesional que sembró la versión anterior no salía de ninguna fuente.',
  },
};

const provenanceFor = (e: NormativoEntry) => {
  const owner = OWNER_BY_CODE[e.policy_code];
  const cargo = OWNER_CARGO_BY_CODE[e.policy_code];
  return {
    origen: e.provenance, // PDF_EXTRAIDO | CITADO_NO_INCORPORADO
    fuente: e.source_file ?? "citado en el Sistema Normativo Interno",
    ownership_acreditado: Boolean(owner),
    ...(owner
      ? { ownership_evidencia: owner.evidencia, ...(owner.seleccion_forzada ? { ownership_seleccion_forzada: owner.seleccion_forzada } : {}) }
      : {}),
    ...(cargo ? { ownership_cargo_sin_organo: cargo.evidencia } : {}),
  };
};

async function resolveOwnerSlugs(admin: AdminClient): Promise<Map<string, { id: string; name: string }>> {
  const slugs = Array.from(new Set(Object.values(OWNER_BY_CODE).map((o) => o.slug)));
  const { data, error } = await admin
    .from("governing_bodies")
    .select("id, slug, name")
    .eq("tenant_id", GARRIGUES_TENANT)
    .in("slug", slugs);
  if (error) fail(`governing_bodies select: ${error.message}`);

  const bySlug = new Map((data ?? []).map((r: Record<string, unknown>) => [r.slug as string, { id: r.id as string, name: r.name as string }]));
  const missing = slugs.filter((s) => !bySlug.has(s));
  if (missing.length > 0) {
    fail(`slug(s) de OWNER_BY_CODE sin fila en governing_bodies (tenant Garrigues): ${missing.join(", ")}`);
  }
  return bySlug;
}

function buildRow(e: NormativoEntry, ownerBySlug: Map<string, { id: string; name: string }>) {
  const ownerSlug = OWNER_BY_CODE[e.policy_code]?.slug;
  const owner = ownerSlug ? ownerBySlug.get(ownerSlug) : undefined;
  // Sin órgano, el "Propietario" que pinta la UI es el cargo literal de la
  // fuente cuando lo hay, y "—" cuando la fuente no nombra a nadie.
  const cargo = OWNER_CARGO_BY_CODE[e.policy_code]?.funcion ?? null;
  return {
    tenant_id: GARRIGUES_TENANT,
    policy_code: e.policy_code,
    title: e.title,
    normative_tier: e.normative_tier,
    scope_level: "Corporate",
    status: "Published",
    mandatory: true,
    effective_date: e.effective_date,
    current_version: e.current_version,
    summary: e.summary,
    content_outline: e.content_outline,
    owner_body_id: owner?.id ?? null,
    owner_function: owner?.name ?? cargo,
    data_provenance: provenanceFor(e),
  };
}

// Un código mal escrito en cualquiera de los dos mapas no puede degradar en
// silencio a "sin propietario": se vería como un dato que falta, no como un
// error de configuración.
function validateOwnershipMaps() {
  const codes = new Set(NORMATIVO_CATALOG.map((e) => e.policy_code));
  for (const [map, name] of [
    [Object.keys(OWNER_BY_CODE), "OWNER_BY_CODE"],
    [Object.keys(OWNER_CARGO_BY_CODE), "OWNER_CARGO_BY_CODE"],
  ] as const) {
    for (const c of map) if (!codes.has(c)) fail(`${name}: "${c}" no existe en NORMATIVO_CATALOG.`);
  }
  const dobles = Object.keys(OWNER_BY_CODE).filter((c) => OWNER_CARGO_BY_CODE[c]);
  if (dobles.length > 0) fail(`Códigos en los dos mapas de ownership a la vez: ${dobles.join(", ")}.`);
}

async function main() {
  validateOwnershipMaps();
  console.log(`G4 Task 3 — sistema normativo Garrigues: ${NORMATIVO_CATALOG.length} documentos, ${Object.keys(OWNER_BY_CODE).length} con órgano responsable acreditado, ${Object.keys(OWNER_CARGO_BY_CODE).length} con responsable nombrado que es un cargo sin órgano (FK NULL).`);
  console.table(
    NORMATIVO_CATALOG.filter((e) => OWNER_BY_CODE[e.policy_code]).map((e) => ({
      policy_code: e.policy_code,
      title: e.title.slice(0, 44),
      owner_slug: OWNER_BY_CODE[e.policy_code].slug,
      seleccion: OWNER_BY_CODE[e.policy_code].seleccion_forzada ? "FORZADA POR EL MODELO" : "acreditada",
    })),
  );
  console.table(
    Object.entries(OWNER_CARGO_BY_CODE).map(([code, c]) => ({ policy_code: code, owner_body_id: "NULL", owner_function: c.funcion.slice(0, 60) })),
  );

  if (!COMMIT) {
    console.log("Dry-run. Añade --commit para ejecutar contra Cloud (requiere service-role key).");
    return;
  }
  if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(", ")}).`);

  const admin = crearAdmin();
  const ownerBySlug = await resolveOwnerSlugs(admin);
  const rows = NORMATIVO_CATALOG.map((e) => buildRow(e, ownerBySlug));

  const { error } = await admin.from("policies").upsert(rows, { onConflict: "tenant_id,policy_code" });
  if (error) fail(`policies upsert: ${error.message}`);

  console.log(`✓ Seed completado (idempotente) — ${rows.length} documentos normativos de Garrigues.`);
}

main();
