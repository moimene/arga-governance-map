/**
 * Lógica PURA del `tenant-bootstrap` y del pack base LSC: selección, saneado,
 * clonado e integridad. Sin red y sin `process.exit`: todo lo que decide QUÉ se
 * escribe vive aquí para poder testearlo sin Cloud. La E/S está en
 * `scripts/tenant-bootstrap.ts` y `scripts/export-pack-base-lsc.ts`.
 *
 * Spec: docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TenantSpec } from "./tenant-spec";

// ───────────────────────────── utilidades ──────────────────────────────────

export function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** JSON determinista (claves ordenadas): mismo contenido ⇒ mismos bytes ⇒ mismo hash. */
export function canonicalJson(valor: unknown, indent = 0): string {
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === "object") {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = ordenar((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(ordenar(valor), null, indent || undefined);
}

/** Espacio de nombres fijo del pack base. Cambiarlo cambia TODOS los ids clonados. */
export const PACK_BASE_NAMESPACE = "6f1d2c0a-8f4e-5b7a-9c3d-2e1f0a9b8c7d";

/** UUID v5 (RFC 4122, SHA-1). Determinista: re-ejecutar el bootstrap no duplica filas. */
export function uuidV5(nombre: string, namespace: string = PACK_BASE_NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  if (ns.length !== 16) throw new Error(`namespace UUID inválido: ${namespace}`);
  const hash = createHash("sha1").update(ns).update(nombre, "utf8").digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function contieneClave(valor: unknown, clave: string): boolean {
  if (Array.isArray(valor)) return valor.some((v) => contieneClave(v, clave));
  if (valor && typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>).some(
      ([k, v]) => k === clave || contieneClave(v, clave),
    );
  }
  return false;
}

/**
 * ¿Menciona a ARGA? Palabra completa y SENSIBLE a mayúsculas a propósito: una
 * búsqueda insensible casa "enc-arga-ndo", que es castellano y no un cliente.
 */
export function mencionaArga(valor: unknown): boolean {
  if (valor == null) return false;
  const s = typeof valor === "string" ? valor : JSON.stringify(valor);
  return /\bARGA\b/.test(s);
}

// ──────────────────────── saneado de plantillas ────────────────────────────

/**
 * Única transformación admitida sobre la capa inmutable de una plantilla: el
 * AVISO DE PROTOTIPO nombra el repo de origen ("ARGA Governance Map"). Es un
 * descargo del producto, no contenido jurídico, y en otro tenant debe nombrar el
 * producto. Sustitución de cadena EXACTA; cualquier otra mención a ARGA que
 * sobreviva EXCLUYE la plantilla del pack (fail-closed), no se "arregla".
 */
const AVISO_PROTOTIPO_ORIGEN = "prototipo ARGA Governance Map";
const AVISO_PROTOTIPO_NEUTRO = "prototipo TGMS";

export function neutralizarAvisoPrototipo(texto: string): { texto: string; cambiado: boolean } {
  if (!texto.includes(AVISO_PROTOTIPO_ORIGEN)) return { texto, cambiado: false };
  return { texto: texto.split(AVISO_PROTOTIPO_ORIGEN).join(AVISO_PROTOTIPO_NEUTRO), cambiado: true };
}

// ─────────────────────────── formas de dato ────────────────────────────────

/** Fila de Cloud: `rule_packs` con su(s) versión(es) activa(s) embebida(s). */
export interface RulePackOrigen {
  id: string;
  materia: string;
  organo_tipo: string | null;
  descripcion: string;
  rule_pack_versions: Array<{
    version: string;
    status: string | null;
    is_active: boolean | null;
    effective_from: string | null;
    payload_hash: string | null;
    payload: Record<string, unknown>;
  }>;
}

export interface PackBaseRulePack {
  source_id: string;
  materia: string;
  organo_tipo: string | null;
  descripcion: string;
  version: string;
  source_payload_hash: string | null;
  /** sha256 del payload en JSON canónico: integridad del snapshot, no la columna de BD. */
  payload_sha256: string;
  payload: Record<string, unknown>;
}

export interface RuleSetOrigen {
  id: string;
  jurisdiction: string;
  company_form: string;
  typology_code: string;
  rule_set_version: string;
  legal_reference: string | null;
  name: string | null;
  statutory_override: boolean;
  is_active: boolean;
  pack_id: string | null;
  rule_config: unknown;
}

export type PackBaseRuleSet = Omit<RuleSetOrigen, "id" | "is_active"> & { source_id: string };

export interface PlantillaOrigen {
  id: string;
  tipo: string;
  materia: string | null;
  materia_acuerdo: string | null;
  jurisdiccion: string;
  version: string;
  estado: string;
  organo_tipo: string | null;
  adoption_mode: string | null;
  tipo_social: string | null;
  referencia_legal: string | null;
  capa1_inmutable: string | null;
  capa2_variables: unknown;
  capa3_editables: unknown;
  contenido_template: string | null;
  variables: unknown;
  protecciones: unknown;
  snapshot_rule_pack_required: boolean | null;
  contrato_variables_version: string | null;
  requiere_comunicacion: boolean;
  comunicacion_config: unknown;
  notas_legal: string | null;
  aprobada_por: string | null;
  fecha_aprobacion: string | null;
  content_hash_sha256: string | null;
}

export interface PackBasePlantilla {
  source_id: string;
  tipo: string;
  materia: string | null;
  materia_acuerdo: string | null;
  jurisdiccion: string;
  version: string;
  organo_tipo: string | null;
  adoption_mode: string | null;
  tipo_social: string | null;
  referencia_legal: string | null;
  capa1_inmutable: string;
  capa1_neutralizada: boolean;
  /** sha256(capa1) — MISMA fórmula que exige el servidor (`fn_emit_convocatoria` la recalcula). */
  content_hash_sha256: string;
  capa2_variables: unknown;
  capa3_editables: unknown;
  contenido_template: string | null;
  variables: unknown;
  protecciones: unknown;
  snapshot_rule_pack_required: boolean | null;
  contrato_variables_version: string | null;
  requiere_comunicacion: boolean;
  comunicacion_config: unknown;
  notas_legal_origen: string | null;
  aprobada_por_origen: string | null;
  fecha_aprobacion_origen: string | null;
}

export interface Exclusion {
  tabla: "rule_packs" | "jurisdiction_rule_sets" | "plantillas_protegidas";
  source_id: string;
  etiqueta: string;
  motivo: string;
}

export interface AvisoLegal {
  source_id: string;
  etiqueta: string;
  aviso: string;
}

// ─────────────────────── selección desde el origen ─────────────────────────

/**
 * Rule packs que entran en el pack base. El origen es el estado VIVO de Cloud
 * y no `scripts/seed-rule-packs.ts`: aquel seed quedó atrás respecto a las
 * correcciones del Comité Legal aplicadas por migración (mayorías reforzadas
 * del art. 201.2 LSC, quórum inventado de SL, lotes 1 y 2…). Clonar el seed
 * resucitaría reglas ya corregidas.
 */
export function seleccionarRulePacks(filas: RulePackOrigen[]): {
  incluidos: PackBaseRulePack[];
  excluidos: Exclusion[];
} {
  const incluidos: PackBaseRulePack[] = [];
  const excluidos: Exclusion[] = [];
  for (const f of [...filas].sort((a, b) => a.id.localeCompare(b.id))) {
    const ex = (motivo: string) =>
      excluidos.push({ tabla: "rule_packs", source_id: f.id, etiqueta: `${f.id} (${f.materia})`, motivo });
    const activas = (f.rule_pack_versions ?? []).filter((v) => v.is_active === true);
    if (activas.length !== 1) {
      ex(`${activas.length} versiones activas: se exige exactamente una`);
      continue;
    }
    const v = activas[0];
    if (v.status !== "ACTIVE") {
      ex(`versión activa con status=${v.status ?? "NULL"}: solo entra lo que está ACTIVE de forma expresa`);
      continue;
    }
    if (contieneClave(v.payload, "demo_scope")) {
      ex("payload con `demo_scope`: regla de demo de un tenant, no derecho común");
      continue;
    }
    if (mencionaArga(v.payload)) {
      ex("el payload menciona ARGA");
      continue;
    }
    incluidos.push({
      source_id: f.id,
      materia: f.materia,
      organo_tipo: f.organo_tipo,
      descripcion: f.descripcion,
      version: v.version,
      source_payload_hash: v.payload_hash,
      payload_sha256: sha256Hex(canonicalJson(v.payload)),
      payload: v.payload,
    });
  }
  return { incluidos, excluidos };
}

export function seleccionarRuleSets(filas: RuleSetOrigen[], jurisdiccion = "ES"): {
  incluidos: PackBaseRuleSet[];
  excluidos: Exclusion[];
} {
  const incluidos: PackBaseRuleSet[] = [];
  const excluidos: Exclusion[] = [];
  const orden = (r: RuleSetOrigen) => `${r.jurisdiction}|${r.company_form}|${r.typology_code}|${r.rule_set_version}`;
  for (const f of [...filas].sort((a, b) => orden(a).localeCompare(orden(b)))) {
    const etiqueta = orden(f);
    if (f.jurisdiction !== jurisdiccion) {
      excluidos.push({ tabla: "jurisdiction_rule_sets", source_id: f.id, etiqueta, motivo: `jurisdicción ${f.jurisdiction} fuera del alcance (${jurisdiccion})` });
      continue;
    }
    if (!f.is_active) {
      excluidos.push({ tabla: "jurisdiction_rule_sets", source_id: f.id, etiqueta, motivo: "inactivo en el origen" });
      continue;
    }
    if (mencionaArga(f)) {
      excluidos.push({ tabla: "jurisdiction_rule_sets", source_id: f.id, etiqueta, motivo: "menciona ARGA" });
      continue;
    }
    if (f.pack_id) {
      // `pack_id` es un UUID que apunta a un pack del tenant de ORIGEN: no hay a
      // qué remapearlo en el destino, y copiarlo cruzaría tenants por FK lógica.
      excluidos.push({ tabla: "jurisdiction_rule_sets", source_id: f.id, etiqueta, motivo: "pack_id apunta a un pack del tenant de origen" });
      continue;
    }
    const { id, is_active: _activo, ...resto } = f;
    incluidos.push({ source_id: id, ...resto });
  }
  return { incluidos, excluidos };
}

const CAMPOS_RENDERIZABLES: Array<keyof PlantillaOrigen> = [
  "capa1_inmutable", "contenido_template", "capa2_variables", "capa3_editables",
  "variables", "protecciones", "comunicacion_config", "referencia_legal",
];

export function seleccionarPlantillas(filas: PlantillaOrigen[], jurisdiccion = "ES"): {
  incluidas: PackBasePlantilla[];
  excluidas: Exclusion[];
  avisos: AvisoLegal[];
} {
  const incluidas: PackBasePlantilla[] = [];
  const excluidas: Exclusion[] = [];
  const avisos: AvisoLegal[] = [];
  const orden = (p: PlantillaOrigen) => `${p.tipo}|${p.materia_acuerdo ?? p.materia ?? ""}|${p.organo_tipo ?? ""}|${p.adoption_mode ?? ""}|${p.version}`;
  for (const f of [...filas].sort((a, b) => orden(a).localeCompare(orden(b)))) {
    const etiqueta = orden(f);
    const ex = (motivo: string) =>
      excluidas.push({ tabla: "plantillas_protegidas", source_id: f.id, etiqueta, motivo });
    if (f.estado !== "ACTIVA") { ex(`estado ${f.estado}: solo se clona lo ACTIVA`); continue; }
    if (f.jurisdiccion !== jurisdiccion) { ex(`jurisdicción ${f.jurisdiccion} fuera del alcance`); continue; }
    if (!f.capa1_inmutable || !f.capa1_inmutable.trim()) { ex("sin capa1_inmutable"); continue; }

    const capa1 = neutralizarAvisoPrototipo(f.capa1_inmutable);
    const candidata: PlantillaOrigen = { ...f, capa1_inmutable: capa1.texto };
    const campoConArga = CAMPOS_RENDERIZABLES.find((c) => mencionaArga(candidata[c]));
    if (campoConArga) {
      ex(`tras neutralizar el aviso de prototipo, ${String(campoConArga)} sigue mencionando ARGA`);
      continue;
    }
    // Las notas legales NO se renderizan; se conservan como procedencia. Pero si
    // citan normativa interna de ARGA, el contenido puede encarnar una regla de
    // ese grupo y no derecho común: se avisa para revisión, no se decide aquí.
    if (mencionaArga(f.notas_legal) && /(Reglamento|Estatutos|Pol[ií]tica)[^.]{0,60}\bARGA\b/.test(f.notas_legal ?? "")) {
      avisos.push({
        source_id: f.id,
        etiqueta,
        aviso: "las notas legales del origen citan normativa interna de ARGA: revisar que la plantilla no encarne una regla propia de ese grupo",
      });
    }
    incluidas.push({
      source_id: f.id,
      tipo: f.tipo,
      materia: f.materia,
      materia_acuerdo: f.materia_acuerdo,
      jurisdiccion: f.jurisdiccion,
      version: f.version,
      organo_tipo: f.organo_tipo,
      adoption_mode: f.adoption_mode,
      tipo_social: f.tipo_social,
      referencia_legal: f.referencia_legal,
      capa1_inmutable: capa1.texto,
      capa1_neutralizada: capa1.cambiado,
      content_hash_sha256: sha256Hex(capa1.texto),
      capa2_variables: f.capa2_variables,
      capa3_editables: f.capa3_editables,
      contenido_template: f.contenido_template,
      variables: f.variables,
      protecciones: f.protecciones,
      snapshot_rule_pack_required: f.snapshot_rule_pack_required,
      contrato_variables_version: f.contrato_variables_version,
      requiere_comunicacion: f.requiere_comunicacion,
      comunicacion_config: f.comunicacion_config,
      notas_legal_origen: f.notas_legal,
      aprobada_por_origen: f.aprobada_por,
      fecha_aprobacion_origen: f.fecha_aprobacion,
    });
  }
  return { incluidas, excluidas, avisos };
}

// ─────────────────────────── clonado a un tenant ───────────────────────────

export function packIdPara(spec: Pick<TenantSpec, "packIdPrefix">, sourceId: string): string {
  return `${spec.packIdPrefix}_${sourceId}`;
}

export const PROCEDENCIA_PACK_BASE = "Pack base LSC";

export function clonarRulePack(spec: TenantSpec, p: PackBaseRulePack, hoy: string) {
  const id = packIdPara(spec, p.source_id);
  return {
    pack: {
      id,
      tenant_id: spec.tenantId,
      // La MATERIA es la canónica, no el id con prefijo: la resolución del motor
      // es por `(tenant_id, materia)`. Prefijar la materia dejaría el tenant sin
      // reglas aunque las filas existan.
      materia: p.materia,
      organo_tipo: p.organo_tipo,
      descripcion: `${p.descripcion} · ${PROCEDENCIA_PACK_BASE} (origen ${p.source_id}@${p.version})`,
    },
    version: {
      pack_id: id,
      version: p.version,
      // Payload VERBATIM: es el texto jurídico revisado. Ni siquiera se reescribe
      // `payload.id`; el motor toma el id de la fila, no del payload.
      payload: p.payload,
      is_active: true,
      status: "ACTIVE",
      effective_from: hoy,
    },
  };
}

export function clonarRuleSet(spec: TenantSpec, r: PackBaseRuleSet) {
  return {
    id: uuidV5(`${spec.tenantId}:jurisdiction_rule_set:${r.source_id}`),
    // `tenant_id` EXPLÍCITO: la columna tiene DEFAULT '…0001' y un INSERT que la
    // omita aterriza en ARGA.
    tenant_id: spec.tenantId,
    jurisdiction: r.jurisdiction,
    company_form: r.company_form,
    typology_code: r.typology_code,
    rule_set_version: r.rule_set_version,
    legal_reference: r.legal_reference,
    name: r.name,
    statutory_override: r.statutory_override,
    is_active: true,
    pack_id: null,
    rule_config: r.rule_config,
  };
}

export function idPlantillaClonada(spec: Pick<TenantSpec, "tenantId">, sourceId: string): string {
  return uuidV5(`${spec.tenantId}:plantilla:${sourceId}`);
}

export function aprobadaPorClon(p: PackBasePlantilla): string {
  return `${PROCEDENCIA_PACK_BASE} — clon de la plantilla ${p.source_id} v${p.version}` +
    (p.aprobada_por_origen ? `, aprobada en origen por «${p.aprobada_por_origen}»` : "");
}

export function notasLegalesClon(p: PackBasePlantilla, exportadoEn: string): string {
  const cabecera =
    `${PROCEDENCIA_PACK_BASE} (snapshot ${exportadoEn}). Clon de la plantilla ${p.source_id} v${p.version} del tenant de origen.` +
    (p.capa1_neutralizada
      ? " Única transformación: el aviso de prototipo nombra el producto (TGMS) en lugar del repositorio de origen."
      : " Sin transformaciones sobre la capa inmutable.") +
    " Entorno de validación funcional: sin eficacia jurídica productiva.";
  return p.notas_legal_origen
    ? `${cabecera}\n\n[Notas de la plantilla de origen, conservadas como procedencia]\n${p.notas_legal_origen}`
    : cabecera;
}

/** Fila de INSERT. Entra SIEMPRE en BORRADOR: el trigger rechaza cualquier otro estado. */
export function clonarPlantilla(spec: TenantSpec, p: PackBasePlantilla, exportadoEn: string) {
  return {
    id: idPlantillaClonada(spec, p.source_id),
    tenant_id: spec.tenantId,
    tipo: p.tipo,
    materia: p.materia,
    materia_acuerdo: p.materia_acuerdo,
    jurisdiccion: p.jurisdiccion,
    // Misma versión que el origen: hay RPC de servidor que exigen una versión
    // concreta (p. ej. CONVOCATORIA_CDA 1.1.0 en la emisión de convocatoria).
    version: p.version,
    estado: "BORRADOR" as const,
    organo_tipo: p.organo_tipo,
    adoption_mode: p.adoption_mode,
    tipo_social: p.tipo_social,
    referencia_legal: p.referencia_legal,
    capa1_inmutable: p.capa1_inmutable,
    capa2_variables: p.capa2_variables,
    capa3_editables: p.capa3_editables,
    contenido_template: p.contenido_template,
    variables: p.variables,
    protecciones: p.protecciones,
    snapshot_rule_pack_required: p.snapshot_rule_pack_required,
    contrato_variables_version: p.contrato_variables_version,
    requiere_comunicacion: p.requiere_comunicacion,
    comunicacion_config: p.comunicacion_config,
    content_hash_sha256: p.content_hash_sha256,
    notas_legal: notasLegalesClon(p, exportadoEn),
    aprobada_por: null,
    fecha_aprobacion: null,
  };
}

function resolvePackBaseDir(): string {
  if (typeof __dirname !== "undefined") {
    return join(__dirname, "pack-base-lsc");
  }
  try {
    if (typeof import.meta !== "undefined" && typeof import.meta.url === "string" && import.meta.url.startsWith("file:")) {
      return join(fileURLToPath(new URL(".", import.meta.url)), "pack-base-lsc");
    }
  } catch {
    // fallback below
  }
  return join(process.cwd(), "scripts", "tenants", "pack-base-lsc");
}

export const PACK_BASE_DIR = resolvePackBaseDir();

export interface PackBaseManifest {
  pack: "LSC_ES";
  origen: { tenant_id: string; proyecto: string };
  exportado_en: string;
  ficheros: Record<"rule-packs.json" | "jurisdiction-rule-sets.json" | "plantillas.json", { filas: number; sha256: string }>;
  exclusiones: Exclusion[];
  avisos_legales: AvisoLegal[];
}

export interface PackBase {
  manifest: PackBaseManifest;
  rulePacks: PackBaseRulePack[];
  ruleSets: PackBaseRuleSet[];
  plantillas: PackBasePlantilla[];
}

/**
 * Carga el snapshot y VERIFICA su integridad: un fichero editado a mano sin
 * regenerar el manifiesto deja de cargar. El pack base es texto jurídico
 * revisado; no se retoca en caliente.
 */
export function cargarPackBase(dir: string = PACK_BASE_DIR): PackBase {
  const leer = (nombre: string) => {
    const ruta = join(dir, nombre);
    if (!existsSync(ruta)) {
      throw new Error(`falta ${ruta}: genera el snapshot con \`bun run scripts/export-pack-base-lsc.ts --write\``);
    }
    return readFileSync(ruta, "utf8");
  };
  const manifest = JSON.parse(leer("MANIFEST.json")) as PackBaseManifest;
  const cargar = <T>(nombre: keyof PackBaseManifest["ficheros"]): T[] => {
    const crudo = leer(nombre);
    const esperado = manifest.ficheros[nombre];
    const real = sha256Hex(crudo);
    if (!esperado || esperado.sha256 !== real) {
      throw new Error(`${nombre}: sha256 ${real} no coincide con el MANIFEST (${esperado?.sha256 ?? "ausente"}). Regenera el snapshot; no lo edites a mano.`);
    }
    const filas = JSON.parse(crudo) as T[];
    if (filas.length !== esperado.filas) throw new Error(`${nombre}: ${filas.length} filas, el MANIFEST declara ${esperado.filas}`);
    return filas;
  };
  return {
    manifest,
    rulePacks: cargar<PackBaseRulePack>("rule-packs.json"),
    ruleSets: cargar<PackBaseRuleSet>("jurisdiction-rule-sets.json"),
    plantillas: cargar<PackBasePlantilla>("plantillas.json"),
  };
}

// ───────────────────────────── entorno ─────────────────────────────────────

export const PROYECTO_GOVERNANCE_OS = "hzqwefkwsxopwrmtksbg";

const URL_NAMES = ["VITE_SUPABASE_URL", "SUPABASE_URL", "PROJECT_URL"];
// La service-role key se busca por los nombres que conviven en los .env del
// proyecto. NUNCA se imprime su valor, solo su ausencia.
export const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET",
];

export function resolverEntorno(env: Record<string, string | undefined>): { url: string; serviceKey: string } {
  const url = (URL_NAMES.map((n) => env[n]).find(Boolean) ?? `https://${PROYECTO_GOVERNANCE_OS}.supabase.co`).replace(/\/+$/, "");
  const serviceKey = SERVICE_KEY_NAMES.map((n) => env[n]).find(Boolean) ?? "";
  return { url, serviceKey };
}

/** Guard de target: estos scripts solo corren contra `governance_OS`. */
export function targetEsGovernanceOs(url: string): boolean {
  try {
    return new URL(url).hostname === `${PROYECTO_GOVERNANCE_OS}.supabase.co`;
  } catch {
    return false;
  }
}
