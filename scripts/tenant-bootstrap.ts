#!/usr/bin/env bun
/**
 * tenant-bootstrap — da de alta un tenant EN BLANCO y le pone el suelo mínimo
 * para que se pueda cablear entero por pantalla.
 *
 * Spec: docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md
 * Plan: docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md
 *
 * Dos fases, las dos idempotentes y aditivas (nunca DELETE, nunca mutar una
 * versión ya escrita):
 *
 *   fundacion  tenants (+branding) · usuarios Auth · user_profiles ·
 *              rbac_user_roles · grc_modules
 *   pack-base  rule_packs (+versión ACTIVE) · jurisdiction_rule_sets ES ·
 *              plantillas_protegidas (BORRADOR → … → ACTIVA por la RPC)
 *
 * NO siembra ni una sociedad, ni una persona, ni un órgano: eso se hace por
 * pantalla y es el objeto de la prueba.
 *
 * Uso:
 *   bun run scripts/tenant-bootstrap.ts --tenant nuevo                  # dry-run: plan contra Cloud, no escribe
 *   bun run scripts/tenant-bootstrap.ts --tenant nuevo --commit         # ejecuta
 *   bun run scripts/tenant-bootstrap.ts --tenant nuevo --fase fundacion # solo una fase
 *
 * Service-role (salta RLS): SOLO CLI, nunca UI. Guard de target: governance_OS.
 * Contrato que el script VIGILA y no solo promete: el recuento de filas de ARGA
 * y de Garrigues en las tablas tocadas es idéntico antes y después. Varias
 * columnas `tenant_id` llevan DEFAULT '…0001'; un INSERT que la omita aterriza
 * en ARGA sin error. Aquí todo INSERT la nombra, y si aun así algo se mueve, el
 * script termina en rojo diciendo dónde.
 */
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ARGA_TENANT_ID,
  TENANTS_RESERVADOS,
  TENANT_SPECS,
  tenantSpec,
  validarTenantSpec,
  type TenantSpec,
} from "./tenants/tenant-spec";
import {
  SERVICE_KEY_NAMES,
  aprobadaPorClon,
  cargarPackBase,
  clonarCertificationKind,
  clonarPlantilla,
  clonarRulePack,
  clonarRuleSet,
  idPlantillaClonada,
  packIdPara,
  resolverEntorno,
  seleccionarCertificationKinds,
  targetEsGovernanceOs,
  type PackBase,
  type PackBasePlantilla,
  type StandaloneCertificationKindOrigen,
} from "./tenants/bootstrap-lib";
import { validateTemplateForActivation } from "../src/lib/secretaria/template-admin/gate-pre";
import type { EstadoPlantilla, PlantillaCandidate } from "../src/lib/secretaria/template-admin/types";

type Fase = "fundacion" | "pack-base" | "todo";

function arg(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const COMMIT = process.argv.includes("--commit");
const FASE = (arg("--fase") ?? "todo") as Fase;
const TENANT_KEY = arg("--tenant");

if (!["fundacion", "pack-base", "todo"].includes(FASE)) fail(`--fase inválida: ${FASE}`);
const spec: TenantSpec =
  tenantSpec(TENANT_KEY) ??
  fail(`--tenant obligatorio. Disponibles: ${Object.keys(TENANT_SPECS).join(", ")}`);

const problemas = validarTenantSpec(spec);
if (problemas.length) fail(`El spec de «${spec.key}» no es válido:\n${problemas.map((p) => `    - ${p}`).join("\n")}`);

const { url, serviceKey } = resolverEntorno(process.env);
if (!targetEsGovernanceOs(url)) fail(`Target inesperado (${url}) — este script solo corre contra governance_OS.`);
if (!serviceKey) {
  fail(`Falta la service-role key en el entorno. Se buscó bajo:\n${SERVICE_KEY_NAMES.map((n) => `    - ${n}`).join("\n")}`);
}

const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } });
const HOY = new Date().toISOString().slice(0, 10);

// ─────────────────────── vigilancia de contaminación ───────────────────────

const TABLAS_VIGILADAS = ["rule_packs", "jurisdiction_rule_sets", "plantillas_protegidas", "grc_modules", "user_profiles", "rbac_user_roles", "standalone_certification_kinds"] as const;

async function recuento(tabla: string, tenantId: string): Promise<number> {
  const { count, error } = await admin.from(tabla).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (error) fail(`recuento ${tabla}/${tenantId}: ${error.message}`);
  return count ?? 0;
}

async function fotoDeReservados(): Promise<Record<string, number>> {
  const foto: Record<string, number> = {};
  for (const t of TENANTS_RESERVADOS) {
    for (const tabla of TABLAS_VIGILADAS) foto[`${tabla}@${t.slice(-4)}`] = await recuento(tabla, t);
  }
  return foto;
}

// ─────────────────────────────── fundación ─────────────────────────────────

async function findUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listUsers: ${error.message}`);
    const users = data.users as Array<{ id: string; email?: string }>;
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function fundacion() {
  console.log(`\n── Fundación · ${spec.name} (${spec.tenantId}) ──`);

  // "El schema manda": tenant_type se copia de ARGA, no se inventa.
  const { data: arga, error: eArga } = await admin.from("tenants").select("tenant_type").eq("id", ARGA_TENANT_ID).maybeSingle();
  if (eArga) fail(`Leyendo tenant de referencia: ${eArga.message}`);
  if (!arga) fail("No existe el tenant ARGA de referencia — target equivocado.");

  const roleCodes = [...new Set(spec.users.map((u) => u.role))];
  const { data: roles, error: eRoles } = await admin.from("rbac_roles").select("id, role_code").in("role_code", roleCodes);
  if (eRoles) fail(`Leyendo rbac_roles: ${eRoles.message}`);
  const roleByCode = new Map((roles ?? []).map((r) => [r.role_code as string, r.id as string]));
  for (const c of roleCodes) if (!roleByCode.has(c)) fail(`rbac_roles sin role_code=${c}`);

  const { data: existente, error: eTen } = await admin.from("tenants").select("id, name").eq("id", spec.tenantId).maybeSingle();
  if (eTen) fail(`Leyendo tenants: ${eTen.message}`);
  if (existente && existente.name !== spec.name) {
    // Un UUID ocupado por OTRO tenant no se pisa: se para y se mira.
    fail(`tenants ${spec.tenantId} ya existe con otro nombre («${existente.name}»). No se sobrescribe.`);
  }

  const plan: Array<{ paso: string; accion: string }> = [
    { paso: "tenants", accion: existente ? "UPDATE branding (la fila ya existe)" : "INSERT fila + branding" },
  ];
  const usuarios: Array<{ email: string; role: string; userId: string | null }> = [];
  for (const u of spec.users) {
    const userId = await findUserByEmail(u.email);
    usuarios.push({ ...u, userId });
    plan.push({ paso: u.email, accion: `${userId ? "reutiliza usuario Auth" : "CREA usuario Auth"} + perfil ${u.role} + rbac_user_roles` });
  }
  const { data: modsExistentes, error: eMods } = await admin.from("grc_modules").select("id").eq("tenant_id", spec.tenantId);
  if (eMods) fail(`Leyendo grc_modules: ${eMods.message}`);
  const yaHay = new Set((modsExistentes ?? []).map((m) => m.id as string));
  const modsNuevos = spec.grcModules.filter((m) => !yaHay.has(m.id));
  plan.push({ paso: "grc_modules", accion: `${modsNuevos.length} por insertar (${modsNuevos.map((m) => m.id).join(", ") || "ninguno"}), ${yaHay.size} ya existen` });
  console.table(plan);

  if (!COMMIT) return;

  const hayQueCrear = usuarios.some((u) => !u.userId);
  const password = process.env[spec.passwordEnvVar] ?? "";
  if (hayQueCrear && !password) fail(`Falta ${spec.passwordEnvVar} en .env para crear los usuarios demo. Nunca un literal en el repo.`);

  const { error: eUp } = await admin.from("tenants").upsert(
    { id: spec.tenantId, name: spec.name, tenant_type: arga.tenant_type, country_code: spec.countryCode, is_active: true, branding: spec.branding },
    { onConflict: "id" },
  );
  if (eUp) fail(`Upsert tenants: ${eUp.message}`);
  console.log(`✓ tenants ${spec.tenantId} (branding poblado)`);

  for (const u of usuarios) {
    let userId = u.userId;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({ email: u.email, password, email_confirm: true });
      if (error) fail(`createUser ${u.email}: ${error.message}`);
      userId = data.user.id;
    }
    const { data: prof, error: eProf } = await admin.from("user_profiles").select("id, tenant_id").eq("user_id", userId).maybeSingle();
    if (eProf) fail(`Leyendo user_profiles ${u.email}: ${eProf.message}`);
    if (prof && prof.tenant_id !== spec.tenantId) {
      // Jamás se mueve un usuario de tenant en silencio: `fn_current_tenant_id()`
      // deriva el tenant de esta columna.
      fail(`${u.email} ya tiene perfil en OTRO tenant (${prof.tenant_id}). No se traslada.`);
    }
    if (prof) {
      const { error } = await admin.from("user_profiles").update({ role_code: u.role }).eq("user_id", userId);
      if (error) fail(`update user_profiles ${u.email}: ${error.message}`);
    } else {
      const { error } = await admin.from("user_profiles").insert({ user_id: userId, tenant_id: spec.tenantId, role_code: u.role });
      if (error) fail(`insert user_profiles ${u.email}: ${error.message}`);
    }
    const roleId = roleByCode.get(u.role)!;
    const { data: link, error: eLink } = await admin
      .from("rbac_user_roles").select("id")
      .eq("user_id", userId).eq("role_id", roleId).eq("tenant_id", spec.tenantId).maybeSingle();
    if (eLink) fail(`Leyendo rbac_user_roles ${u.email}: ${eLink.message}`);
    if (!link) {
      const { error } = await admin.from("rbac_user_roles").insert({ user_id: userId, role_id: roleId, tenant_id: spec.tenantId, is_active: true });
      if (error) fail(`insert rbac_user_roles ${u.email}: ${error.message}`);
    }
    console.log(`✓ ${u.email} → ${u.role}`);
  }

  if (modsNuevos.length) {
    const { error } = await admin.from("grc_modules").upsert(
      modsNuevos.map((m) => ({ tenant_id: spec.tenantId, id: m.id, name: m.name, description: m.description, owner: m.owner })),
      { onConflict: "tenant_id,id", ignoreDuplicates: true },
    );
    if (error) fail(`grc_modules: ${error.message}`);
  }
  console.log(`✓ grc_modules (${modsNuevos.length} nuevos)`);
}

// ─────────────────────────────── pack base ─────────────────────────────────

function candidata(p: PackBasePlantilla, estado: EstadoPlantilla): PlantillaCandidate {
  return {
    id: idPlantillaClonada(spec, p.source_id),
    tipo: p.tipo,
    materia: p.materia,
    materia_acuerdo: p.materia_acuerdo,
    jurisdiccion: p.jurisdiccion,
    version: p.version,
    estado,
    organo_tipo: p.organo_tipo,
    adoption_mode: p.adoption_mode,
    tipo_social: p.tipo_social,
    aprobada_por: aprobadaPorClon(p),
    fecha_aprobacion: new Date().toISOString(),
    referencia_legal: p.referencia_legal,
    capa1_inmutable: p.capa1_inmutable,
    capa2_variables: p.capa2_variables,
    capa3_editables: p.capa3_editables,
  } as PlantillaCandidate;
}

const TRANSICIONES: EstadoPlantilla[] = ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"];

async function transicion(id: string, from: EstadoPlantilla, to: EstadoPlantilla, p: PackBasePlantilla) {
  const { data, error } = await admin.rpc("fn_secretaria_transition_template_state", {
    p_template_id: id,
    p_expected_from: from,
    p_to_state: to,
    p_motivo: `tenant-bootstrap ${spec.key} — pack base LSC, clon de ${p.source_id} v${p.version} (${from}→${to}).`,
    p_operation_id: randomUUID(),
    p_aprobada_por: to === "APROBADA" ? aprobadaPorClon(p) : null,
    p_fecha_aprobacion: to === "APROBADA" ? new Date().toISOString() : null,
  });
  if (error) fail(`Transición ${from}→${to} de ${id}: ${error.message}`);
  if (!(data as { ok?: boolean } | null)?.ok) fail(`Transición ${from}→${to} de ${id} sin éxito: ${JSON.stringify(data)}`);
}

async function packBase() {
  console.log(`\n── Pack base · ${spec.packBase ?? "ninguno"} → ${spec.name} ──`);
  if (!spec.packBase) {
    console.log("El spec no declara pack base: el tenant no podrá convocar ni adoptar acuerdos.");
    return;
  }
  const pack: PackBase = cargarPackBase(); // verifica sha256 contra el MANIFEST
  console.log(`Snapshot ${pack.manifest.exportado_en}: ${pack.rulePacks.length} rule packs · ${pack.ruleSets.length} rule sets · ${pack.plantillas.length} plantillas`);
  for (const a of pack.manifest.avisos_legales) console.log(`  ⚠ revisión legal pendiente — ${a.etiqueta}: ${a.aviso}`);

  // Gate PRE local (sin red) sobre TODAS las plantillas, también en dry-run: si
  // una no podría activarse, se sabe antes de escribir la primera.
  const bloqueadas: string[] = [];
  for (const p of pack.plantillas) {
    const gate = validateTemplateForActivation(candidata(p, "ACTIVA"), { tenantId: spec.tenantId, existingActiveTemplates: [], targetEstado: "ACTIVA" });
    if (gate.summary.blocking > 0) {
      bloqueadas.push(`${p.tipo}/${p.materia_acuerdo ?? p.materia}: ${gate.issues.filter((i) => i.severity === "BLOCKING").map((i) => i.code).join(", ")}`);
    }
  }
  if (bloqueadas.length) fail(`Gate PRE bloquea ${bloqueadas.length} plantilla(s) del pack base:\n${bloqueadas.map((b) => `    - ${b}`).join("\n")}`);
  console.log(`✓ Gate PRE local sin bloqueos (${pack.plantillas.length} plantillas)`);

  // ── estado actual en Cloud ──
  const idsPack = pack.rulePacks.map((p) => packIdPara(spec, p.source_id));
  const { data: packsCloud, error: ePacks } = await admin
    .from("rule_packs").select("id, tenant_id, rule_pack_versions(version, is_active)").in("id", idsPack);
  if (ePacks) fail(`Leyendo rule_packs: ${ePacks.message}`);
  const packPorId = new Map((packsCloud ?? []).map((r) => [r.id as string, r]));
  // rule_packs.id es PK GLOBAL: si el id con prefijo ya es de OTRO tenant, parar.
  for (const r of packsCloud ?? []) {
    if (r.tenant_id !== spec.tenantId) fail(`rule_packs.id ${r.id} ya pertenece a otro tenant (${r.tenant_id}): el prefijo ${spec.packIdPrefix} colisiona.`);
  }

  const { data: setsCloud, error: eSets } = await admin
    .from("jurisdiction_rule_sets").select("jurisdiction, company_form, typology_code, rule_set_version").eq("tenant_id", spec.tenantId);
  if (eSets) fail(`Leyendo jurisdiction_rule_sets: ${eSets.message}`);
  const claveSet = (r: { jurisdiction: string; company_form: string; typology_code: string; rule_set_version: string }) =>
    `${r.jurisdiction}|${r.company_form}|${r.typology_code}|${r.rule_set_version}`;
  const setsYa = new Set((setsCloud ?? []).map(claveSet));

  const { data: plCloud, error: ePl } = await admin
    .from("plantillas_protegidas").select("id, estado").eq("tenant_id", spec.tenantId);
  if (ePl) fail(`Leyendo plantillas_protegidas: ${ePl.message}`);
  const estadoPorId = new Map((plCloud ?? []).map((r) => [r.id as string, r.estado as EstadoPlantilla]));

  const packsNuevos = pack.rulePacks.filter((p) => !packPorId.has(packIdPara(spec, p.source_id)));
  const versionesNuevas = pack.rulePacks.filter((p) => {
    const fila = packPorId.get(packIdPara(spec, p.source_id));
    const versiones = ((fila?.rule_pack_versions ?? []) as Array<{ version: string }>).map((v) => v.version);
    return !versiones.includes(p.version);
  });
  // Un pack ya sembrado cuya versión activa NO es la del snapshot no se toca:
  // subir de versión una regla es una decisión jurídica, no un efecto de re-ejecutar.
  const divergentes = pack.rulePacks.filter((p) => {
    const fila = packPorId.get(packIdPara(spec, p.source_id));
    if (!fila) return false;
    const activas = ((fila.rule_pack_versions ?? []) as Array<{ version: string; is_active: boolean }>).filter((v) => v.is_active);
    return activas.length > 0 && !activas.some((v) => v.version === p.version);
  });
  const setsNuevos = pack.ruleSets.filter((r) => !setsYa.has(claveSet(r)));
  const plPendientes = pack.plantillas.filter((p) => estadoPorId.get(idPlantillaClonada(spec, p.source_id)) !== "ACTIVA");

  // ── tipos de certificación societaria autónoma ──
  const { data: certsCloud, error: eCerts } = await admin
    .from("standalone_certification_kinds")
    .select("*")
    .eq("tenant_id", ARGA_TENANT_ID);
  if (eCerts) fail(`Leyendo standalone_certification_kinds: ${eCerts.message}`);

  const seleccionCerts = seleccionarCertificationKinds((certsCloud ?? []) as unknown as StandaloneCertificationKindOrigen[]);
  const { data: certsDestino, error: eCertsDest } = await admin
    .from("standalone_certification_kinds")
    .select("id, kind_code, is_active")
    .eq("tenant_id", spec.tenantId);
  if (eCertsDest) fail(`Leyendo standalone_certification_kinds destino: ${eCertsDest.message}`);

  const certsDestMap = new Map((certsDestino ?? []).map((c) => [c.kind_code as string, c]));
  const certsPendientes = seleccionCerts.incluidos.filter((c) => !certsDestMap.has(c.kind_code));

  console.table([
    { tabla: "rule_packs", snapshot: pack.rulePacks.length, "por crear": packsNuevos.length, nota: `${versionesNuevas.length} versiones por insertar` },
    { tabla: "jurisdiction_rule_sets", snapshot: pack.ruleSets.length, "por crear": setsNuevos.length, nota: "" },
    { tabla: "plantillas_protegidas", snapshot: pack.plantillas.length, "por crear": plPendientes.filter((p) => !estadoPorId.has(idPlantillaClonada(spec, p.source_id))).length, nota: `${plPendientes.length} por llevar a ACTIVA` },
    { tabla: "standalone_certification_kinds", snapshot: seleccionCerts.incluidos.length, "por crear": certsPendientes.length, nota: `${seleccionCerts.excluidos.length} excluidos por política EAD Trust (${certsDestMap.size} ya existen)` },
  ]);
  if (divergentes.length) {
    console.log(`⚠ ${divergentes.length} pack(s) con versión activa distinta de la del snapshot; NO se tocan: ${divergentes.map((p) => packIdPara(spec, p.source_id)).join(", ")}`);
  }

  if (!COMMIT) return;

  const { data: tenantFila } = await admin.from("tenants").select("id").eq("id", spec.tenantId).maybeSingle();
  if (!tenantFila) fail(`El tenant ${spec.tenantId} no existe todavía: ejecuta antes la fase fundacion.`);

  const divergenteIds = new Set(divergentes.map((p) => p.source_id));
  for (const p of pack.rulePacks) {
    if (divergenteIds.has(p.source_id)) continue;
    const clon = clonarRulePack(spec, p, HOY);
    if (!packPorId.has(clon.pack.id)) {
      const { error } = await admin.from("rule_packs").insert(clon.pack);
      if (error) fail(`rule_packs insert ${clon.pack.id}: ${error.message}`);
    }
    const fila = packPorId.get(clon.pack.id);
    const versiones = ((fila?.rule_pack_versions ?? []) as Array<{ version: string }>).map((v) => v.version);
    if (!versiones.includes(p.version)) {
      const { error } = await admin.from("rule_pack_versions").insert(clon.version);
      if (error) fail(`rule_pack_versions insert ${clon.pack.id}@${p.version}: ${error.message}`);
    }
  }
  console.log(`✓ rule_packs (${packsNuevos.length} nuevos, ${versionesNuevas.length} versiones)`);

  for (const r of setsNuevos) {
    const { error } = await admin.from("jurisdiction_rule_sets").insert(clonarRuleSet(spec, r));
    if (error) fail(`jurisdiction_rule_sets insert ${claveSet(r)}: ${error.message}`);
  }
  console.log(`✓ jurisdiction_rule_sets (${setsNuevos.length} nuevos)`);

  let activadas = 0;
  for (const p of plPendientes) {
    const id = idPlantillaClonada(spec, p.source_id);
    let estado = estadoPorId.get(id);
    if (!estado) {
      const { error } = await admin.from("plantillas_protegidas").insert(clonarPlantilla(spec, p, pack.manifest.exportado_en));
      if (error) fail(`plantillas_protegidas insert ${p.tipo}/${p.materia_acuerdo ?? p.materia}: ${error.message}`);
      estado = "BORRADOR";
    }
    const desde = TRANSICIONES.indexOf(estado);
    if (desde < 0) {
      // ARCHIVADA/DEPRECADA: alguien la retiró a propósito. No se resucita.
      console.log(`  … ${id} está ${estado}: no se reactiva`);
      continue;
    }
    for (let i = desde; i < TRANSICIONES.length - 1; i++) await transicion(id, TRANSICIONES[i], TRANSICIONES[i + 1], p);
    activadas++;
  }
  console.log(`✓ plantillas_protegidas (${activadas} llevadas a ACTIVA)`);

  let insertadosCerts = 0;
  for (const c of certsPendientes) {
    const fila = clonarCertificationKind(spec, c);
    const { error: insErr } = await admin
      .from("standalone_certification_kinds")
      .upsert(fila, { onConflict: "tenant_id, kind_code" });
    if (insErr) fail(`Error insertando tipo de certificación ${c.kind_code}: ${insErr.message}`);
    insertadosCerts++;
  }
  if (insertadosCerts > 0) {
    console.log(`✓ standalone_certification_kinds (${insertadosCerts} tipos sembrados)`);
  }
}

// ─────────────────────────────── verificación ──────────────────────────────

async function verificar() {
  console.log(`\n── Verificación · ${spec.name} ──`);
  const filas: Array<{ tabla: string; filas: number }> = [];
  for (const tabla of TABLAS_VIGILADAS) filas.push({ tabla, filas: await recuento(tabla, spec.tenantId) });
  for (const tabla of ["entities", "persons", "governing_bodies", "agreements"]) filas.push({ tabla: `${tabla} (debe nacer a 0)`, filas: await recuento(tabla, spec.tenantId) });
  console.table(filas);
}

async function main() {
  console.log(`tenant-bootstrap · tenant=${spec.key} · fase=${FASE} · ${COMMIT ? "COMMIT" : "dry-run (no escribe)"}`);
  const antes = await fotoDeReservados();

  if (FASE === "fundacion" || FASE === "todo") await fundacion();
  if (FASE === "pack-base" || FASE === "todo") await packBase();

  const despues = await fotoDeReservados();
  const movidas = Object.keys(antes).filter((k) => antes[k] !== despues[k]);
  if (movidas.length) {
    // Puede ser otra sesión escribiendo a la vez; también puede ser un INSERT
    // que cayó en el DEFAULT '…0001'. En cualquiera de los dos casos hay que mirar.
    fail(`El recuento de un tenant RESERVADO cambió durante la ejecución: ${movidas.map((k) => `${k} ${antes[k]}→${despues[k]}`).join(", ")}`);
  }
  console.log("\n✓ ARGA y Garrigues intactos en las tablas tocadas (recuento idéntico antes y después).");

  await verificar();
  if (!COMMIT) console.log("\nDry-run. Añade --commit para ejecutar.");
  else console.log(`\n✓ Hecho. Falta declarar el tenant como PROVISIONADO en scripts/tenants/tenant-spec.ts y añadir ${spec.passwordEnvVar} al entorno de tests para que corra su gate de aislamiento.`);
}

main();
