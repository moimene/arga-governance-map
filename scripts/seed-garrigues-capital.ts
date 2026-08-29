#!/usr/bin/env bun
/**
 * Seed C1 — Capital de la matriz Garrigues por el art. 7 de los Estatutos + holdings de filiales.
 *
 * TODA la aritmética vive en `./garrigues/capital/estructura-art7` y este script solo la
 * escribe: clases, nominales, votos por participación, títulos por clase, reparto del censo
 * y autocartera salen de allí. Aquí NO se calcula ningún porcentaje. Las constantes locales
 * del seed anterior (AUTOCARTERA_PCT 2,59 / PRESENCIALES_PCT_TOTAL 0,8875 / TOTAL_TITULOS 695)
 * están borradas a propósito: eran una segunda copia de la aritmética, ajustada a mano para
 * cuadrar los agregados del acta, y confundían capital con voto.
 *
 * Procedencia: la ESTRUCTURA es FIRME (art. 7 de los Estatutos + acta 06/05/2026). El
 * emparejamiento socio↔participación numerada NO es público —el Anexo 2 del acta no está
 * transcrito— y queda etiquetado `metadata.asignacion_clase = "INFERIDO"` en cada fila de socio.
 *
 * Registro canónico del criterio de cómputo:
 *   docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md
 *
 * Uso: `bun run scripts/seed-garrigues-capital.ts` (dry-run, sin red) / `--commit` para escribir.
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, GARRIGUES_MATRIZ_UUID, GARRIGUES_ENTITIES } from "./garrigues/entities-catalog";
import { loadGovernanceCatalog } from "./garrigues/gobierno/governance-catalog";
import {
  ART7_CLASES,
  AUTOCARTERA_TITULOS_A,
  CAPITAL_ESCRITURADO_EUR,
  pctCapital,
  repartirCenso,
  type ClaseCode,
  type Holding,
} from "./garrigues/capital/estructura-art7";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";
const COMMIT = process.argv.includes("--commit");

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const FECHA_JUNTA = "2026-05-06";
const METADATA_FIRME = {
  confianza: "FIRME",
  fuente: "art. 7 de los Estatutos Sociales",
  nota: "Estructura FIRME (clases, nominales, votos, títulos por clase y autocartera). El emparejamiento socio↔participación numerada no es público: el Anexo 2 del acta 06/05/2026 no está transcrito.",
};

export type MatrizHolding = {
  /** Nombre del socio en el censo; `null` = la propia matriz (autocartera). */
  nombre: string | null;
  classCode: ClaseCode;
  numero_titulos: number;
  porcentaje_capital: number;
  voting_rights: boolean;
  is_treasury: boolean;
  effective_from: string;
  metadata: Record<string, unknown>;
};

/**
 * PASSTHROUGH deliberado: `numero_titulos`, `porcentaje_capital` y `asignacion_clase` de cada
 * socio se copian tal cual del `Holding` que devuelve `repartirCenso`. Si esta función volviera
 * a derivar el porcentaje de títulos × nominal / capital tendría su propia copia de la
 * aritmética — que es justo el fallo que la fase corrige — y el test de arista lo detecta
 * alimentándola con holdings de valores imposibles.
 */
/**
 * Camino COMPLETO censo → filas, exportado a propósito. El test de arista lo llama
 * con el censo real y asierta comportamiento (los 3 presenciales suman 150 votos),
 * que es lo único que mata al mutante «el seed vuelve a armar el censo por su
 * cuenta»: un guard de texto sobre el fuente se derrota dejando una llamada de
 * señuelo, y así se coló un presencial en clase B bajando los votos a 101.
 */
export function filasMatrizDesdeCenso(presenciales: string[], representados: string[]): MatrizHolding[] {
  return buildMatrizHoldings(repartirCenso(presenciales, representados));
}

export function buildMatrizHoldings(holdings: Holding[]): MatrizHolding[] {
  const socios: MatrizHolding[] = holdings.map((h) => ({
    nombre: h.nombre,
    classCode: h.clase,
    numero_titulos: h.titulos,
    porcentaje_capital: h.pctCapital,
    voting_rights: true,
    is_treasury: false,
    effective_from: FECHA_JUNTA,
    metadata: { ...METADATA_FIRME, asignacion_clase: h.asignacionClase },
  }));
  // La autocartera SÍ es dato del acta: sin `asignacion_clase`.
  return [...socios, {
    nombre: null,
    classCode: "A",
    numero_titulos: AUTOCARTERA_TITULOS_A,
    porcentaje_capital: pctCapital("A", AUTOCARTERA_TITULOS_A),
    voting_rights: false,
    is_treasury: true,
    effective_from: FECHA_JUNTA,
    metadata: {
      ...METADATA_FIRME,
      nota: "18 participaciones de clase A en autocartera (acta 06/05/2026, 2,59 % de los derechos de voto). Sin voto y fuera del denominador.",
    },
  }];
}

async function main() {
  if (!SUPABASE_URL.includes("hzqwefkwsxopwrmtksbg")) fail(`Target inesperado (${SUPABASE_URL}).`);

  const cat = loadGovernanceCatalog();
  const rows = filasMatrizDesdeCenso(cat.censo.presenciales, cat.censo.representados);

  // Preflight: un cap table descuadrado en Cloud es peor que un seed que no corre.
  const suma = rows.reduce((a, r) => a + r.porcentaje_capital, 0);
  if (Math.abs(suma - 100) > 1e-6) fail(`preflight: Σ porcentaje_capital = ${suma}, esperado 100 ± 1e-6.`);
  const titulosPorClase = (c: ClaseCode) =>
    rows.filter((r) => r.classCode === c).reduce((a, r) => a + r.numero_titulos, 0);
  for (const c of ART7_CLASES) {
    if (titulosPorClase(c.code) !== c.totalTitulos) {
      fail(`preflight: clase ${c.code} reparte ${titulosPorClase(c.code)} títulos, art. 7 declara ${c.totalTitulos}.`);
    }
  }

  console.table([
    ...ART7_CLASES.map((c) => ({
      concepto: `clase ${c.code}`,
      titulos: c.totalTitulos,
      nominal_eur: c.nominalEur,
      votos_titulo: c.votosPorTitulo,
      votos_clase: c.totalTitulos * c.votosPorTitulo,
    })),
    { concepto: "capital escriturado art. 7 (€)", titulos: "", nominal_eur: CAPITAL_ESCRITURADO_EUR, votos_titulo: "", votos_clase: "" },
    { concepto: "holdings socios A (2 títulos)", titulos: rows.filter((r) => r.classCode === "A" && !r.is_treasury).length, nominal_eur: "", votos_titulo: "", votos_clase: "" },
    { concepto: "holdings socios B (1 título)", titulos: rows.filter((r) => r.classCode === "B").length, nominal_eur: "", votos_titulo: "", votos_clase: "" },
    { concepto: "autocartera (A, sin voto)", titulos: AUTOCARTERA_TITULOS_A, nominal_eur: "", votos_titulo: "", votos_clase: 0 },
    { concepto: "filas capital_holdings", titulos: rows.length, nominal_eur: "", votos_titulo: "", votos_clase: "" },
    { concepto: "Σ porcentaje_capital (%)", titulos: suma.toFixed(10), nominal_eur: "", votos_titulo: "", votos_clase: "" },
  ]);
  if (!COMMIT) { console.log("Dry-run. Nada escrito. Añade --commit para aplicar."); return; }

  if (!SERVICE_KEY) fail(`Falta la service-role key (${SERVICE_KEY_NAMES.join(" | ")}).`);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) Las dos clases del art. 7 (idempotente por class_code)
  const claseId: Record<string, string> = {};
  for (const c of ART7_CLASES) {
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
      class_code: c.code, name: c.nombre,
      votes_per_title: c.votosPorTitulo, nominal_value: c.nominalEur, total_titulos: c.totalTitulos,
      voting_rights: true,
    };
    const { data: prev, error: ePrevClase } = await admin.from("share_classes").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID)
      .eq("class_code", c.code).maybeSingle();
    if (ePrevClase) fail(`share_classes lookup ${c.code}: ${ePrevClase.message}`);
    if (prev) {
      const { error } = await admin.from("share_classes").update(row).eq("id", prev.id);
      if (error) fail(`share_classes ${c.code}: ${error.message}`);
      claseId[c.code] = prev.id;
    } else {
      const { data, error } = await admin.from("share_classes").insert(row).select("id").single();
      if (error) fail(`share_classes ${c.code}: ${error.message}`);
      claseId[c.code] = data.id;
    }
  }
  console.log(`✓ share_classes: ${ART7_CLASES.map((c) => `${c.code}=${c.totalTitulos}×${c.nominalEur}€×${c.votosPorTitulo}v`).join(", ")}`);

  // 2) Perfil de capital VIGENTE (una fila VIGENTE por entidad — regla canónica)
  const { data: prof0 } = await admin.from("entity_capital_profile").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID).eq("estado", "VIGENTE").maybeSingle();
  if (!prof0) {
    const { error } = await admin.from("entity_capital_profile").insert({
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID, currency: "EUR",
      capital_escriturado: CAPITAL_ESCRITURADO_EUR, capital_desembolsado: CAPITAL_ESCRITURADO_EUR,
      estado: "VIGENTE", effective_from: "2026-04-24",
    });
    if (error) fail(`capital_profile: ${error.message}`);
  } else {
    const { error } = await admin.from("entity_capital_profile")
      .update({ capital_escriturado: CAPITAL_ESCRITURADO_EUR, capital_desembolsado: CAPITAL_ESCRITURADO_EUR, effective_from: "2026-04-24" })
      .eq("id", prof0.id);
    if (error) fail(`capital_profile update: ${error.message}`);
  }

  // 3) Holdings del censo + autocartera (idempotente por holder+entity: los 8 que pasan a
  //    clase B cambian de share_class_id, no se duplican).
  const { data: personas, error: ePers } = await admin.from("persons")
    .select("id, full_name").eq("tenant_id", GARRIGUES_TENANT).limit(2000);
  if (ePers) fail(`persons: ${ePers.message}`);
  const idPorNombre = new Map<string, string>();
  for (const p of personas ?? []) {
    if (idPorNombre.has(p.full_name)) fail(`persona duplicada en el tenant: ${p.full_name}`);
    idPorNombre.set(p.full_name, p.id);
  }
  const { data: matriz, error: eMat } = await admin.from("entities")
    .select("person_id").eq("id", GARRIGUES_MATRIZ_UUID).single();
  if (eMat) fail(`entities matriz: ${eMat.message}`);

  for (const r of rows) {
    const holderId = r.nombre === null ? matriz.person_id : idPorNombre.get(r.nombre);
    if (!holderId) fail(`persona no sembrada: ${r.nombre}`);
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: GARRIGUES_MATRIZ_UUID,
      holder_person_id: holderId, share_class_id: claseId[r.classCode],
      numero_titulos: r.numero_titulos, porcentaje_capital: r.porcentaje_capital,
      voting_rights: r.voting_rights, is_treasury: r.is_treasury,
      effective_from: r.effective_from, metadata: r.metadata,
    };
    const { data: prev, error: ePrev } = await admin.from("capital_holdings").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", GARRIGUES_MATRIZ_UUID)
      .eq("holder_person_id", holderId).maybeSingle();
    if (ePrev) fail(`holding lookup ${r.nombre ?? "autocartera"}: ${ePrev.message} — con más de una fila vigente por titular, maybeSingle devuelve null y el seed insertaría una duplicada.`);
    if (prev) {
      const { error } = await admin.from("capital_holdings").update(row).eq("id", prev.id);
      if (error) fail(`holding update ${r.nombre ?? "autocartera"}: ${error.message}`);
    } else {
      const { error } = await admin.from("capital_holdings").insert(row);
      if (error) fail(`holding insert ${r.nombre ?? "autocartera"}: ${error.message}`);
    }
  }
  console.log(`✓ ${rows.length} holdings de la matriz (${rows.length - 1} socios + autocartera), procedencia FIRME`);

  // 4) Holdings de filiales con % CONFIRMADO (titular: matriz u otra del grupo)
  const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));
  for (const e of GARRIGUES_ENTITIES) {
    if (!e.parentSlug || e.ownershipPct == null) continue;
    if (e.provenance.confianza !== "CONFIRMADO" && e.slug !== "ead-trust-sl") continue;
    const parent = bySlug.get(e.parentSlug);
    const { data: pEnt } = await admin.from("entities").select("person_id").eq("id", parent.uuid).single();
    const { data: h0 } = await admin.from("capital_holdings").select("id")
      .eq("tenant_id", GARRIGUES_TENANT).eq("entity_id", e.uuid)
      .eq("holder_person_id", pEnt.person_id).maybeSingle();
    const row = {
      tenant_id: GARRIGUES_TENANT, entity_id: e.uuid, holder_person_id: pEnt.person_id,
      porcentaje_capital: e.ownershipPct, voting_rights: true, is_treasury: false,
      numero_titulos: 1, effective_from: "2026-04-24",
      metadata: { fuente: "IDC 2025", confianza: e.provenance.confianza, titulos_no_aplica: true },
    };
    if (h0) {
      const { error } = await admin.from("capital_holdings").update(row).eq("id", h0.id);
      if (error) fail(`holding filial update ${e.slug}: ${error.message}`);
    } else {
      const { error } = await admin.from("capital_holdings").insert(row);
      if (error) fail(`holding filial insert ${e.slug}: ${error.message}`);
    }
  }
  console.log("✓ Holdings de filiales (CONFIRMADO + EAD 51 A_CONFIRMAR)");

  // 5) Refresh de la proyección. NO es un aviso: si no corre, parte_votante_current se queda
  //    con los pesos del reparto anterior y el motor calcularía la Junta sobre ellos.
  const { error: eRpc } = await admin.rpc("fn_refresh_parte_votante_entity", {
    p_entity_id: GARRIGUES_MATRIZ_UUID,
  });
  if (eRpc) fail(`fn_refresh_parte_votante_entity: ${eRpc.message} — parte_votante_current sigue con los pesos viejos.`);
  console.log("✓ parte_votante_current refrescada para la matriz");
}

if (import.meta.main) main();
