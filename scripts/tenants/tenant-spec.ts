/**
 * Catálogo de tenants aprovisionables — ÚNICA FUENTE DE VERDAD del
 * `tenant-bootstrap` (spec docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md).
 *
 * ARGA (`…0001`) y Garrigues (`…0002`) NO viven aquí a propósito: nacieron por
 * sus propios seeds y tienen contratos vigentes (cero-cambio ARGA, persistencia
 * del dato de Garrigues). Este catálogo describe los tenants que nacen EN BLANCO
 * y se cablean por pantalla. Módulo puro: sin red, sin proceso, testeable.
 */

export const ARGA_TENANT_ID = "00000000-0000-0000-0000-000000000001";
export const GARRIGUES_TENANT_ID = "00000000-0000-0000-0000-000000000002";

/** Tenants con contrato propio: ningún spec de este catálogo puede apuntarles. */
export const TENANTS_RESERVADOS: readonly string[] = [ARGA_TENANT_ID, GARRIGUES_TENANT_ID];

/**
 * Estado DECLARADO del tenant en Cloud. Es dato del repo, no una sonda: lo
 * cambia a mano quien ejecuta el bootstrap con `--commit`. Mientras diga
 * PENDIENTE, el gate de aislamiento del tenant se reporta como pendiente
 * (visible, con motivo); cuando diga PROVISIONADO, el gate corre de verdad y
 * LANZA si no puede autenticar. Nunca un verde mudo.
 */
export type EstadoCloud = "PENDIENTE" | "PROVISIONADO";

export type RolDemo = "SECRETARIO" | "ADMIN_TENANT" | "COMPLIANCE" | "CONSEJERO" | "AUDITOR";

export interface TenantUserSpec {
  email: string;
  role: RolDemo;
}

export interface GrcModuleSpec {
  id: string;
  name: string;
  description: string;
  owner: string;
}

export interface TenantBrandingSpec {
  nombre: string;
  shell_label: string;
  scope_label: string;
  sii_org_label: string;
  /**
   * "none" = el tenant NO pinta los fixtures estáticos de `src/data/*` (ESG,
   * actividad reciente, notificaciones, operaciones vinculadas), que son dato
   * de ARGA. Ver `src/lib/tenant-fixtures.ts`. ARGA (branding NULL) y Garrigues
   * (sin la clave) no cambian.
   */
  fixtures: "none";
  /**
   * Lista blanca de módulos. Se OMITE a propósito en un tenant que quiere
   * probar toda la capacidad: sin lista, `isModuleEnabled` falla abierto.
   */
  modules?: string[];
  tokens: Record<string, string>;
}

export interface TenantSpec {
  /** Slug. Coincide con la clave de `LOGIN_BRANDS` y con `?tenant=`. */
  key: string;
  tenantId: string;
  /** `tenants.name`. */
  name: string;
  countryCode: string;
  /** Prefijo de `rule_packs.id` (TEXT PRIMARY KEY GLOBAL: sin prefijo colisiona con ARGA). */
  packIdPrefix: string;
  /** Variable de `.env` con la contraseña demo. Nunca un literal en el repo. */
  passwordEnvVar: string;
  users: TenantUserSpec[];
  branding: TenantBrandingSpec;
  grcModules: GrcModuleSpec[];
  /** Suelo jurídico a clonar. `null` = ninguno (el tenant no podrá adoptar acuerdos). */
  packBase: "LSC_ES" | null;
  cloud: EstadoCloud;
}

const OWNER_PENDIENTE = "Pendiente de designación";

/**
 * Columna vertebral GRC genérica. `risk` es OBLIGATORIO: el trigger
 * `tg_sync_obligation_to_backbone` cae a él sin comprobar que exista, así que
 * registrar una obligación en un tenant sin esa fila revienta. El resto se
 * declara con propietario pendiente: no se inventa gobierno que nadie ha
 * constituido.
 */
const GRC_MODULES_GENERICOS: GrcModuleSpec[] = [
  { id: "risk", name: "Riesgos", description: "Mapa de riesgos del grupo: identificación, valoración, tratamiento y seguimiento.", owner: OWNER_PENDIENTE },
  { id: "tprm", name: "Riesgo de terceros", description: "Inventario y evaluación de terceros y proveedores críticos.", owner: OWNER_PENDIENTE },
  { id: "cyber", name: "Ciberseguridad", description: "Gestión de la seguridad de la información e incidentes de seguridad.", owner: OWNER_PENDIENTE },
  { id: "gdpr", name: "Protección de datos", description: "Cumplimiento del RGPD y la LOPDGDD: registro de actividades, brechas y derechos.", owner: OWNER_PENDIENTE },
  { id: "ethics", name: "Ética y canal interno", description: "Código ético y Sistema Interno de Información (Ley 2/2023).", owner: OWNER_PENDIENTE },
  { id: "audit", name: "Auditoría interna", description: "Plan de auditoría, hallazgos y seguimiento de recomendaciones.", owner: OWNER_PENDIENTE },
];

export const TENANT_SPECS: Record<string, TenantSpec> = {
  nuevo: {
    key: "nuevo",
    tenantId: "00000000-0000-0000-0000-000000000003",
    name: "Grupo Nuevo",
    countryCode: "ES",
    packIdPrefix: "GN",
    passwordEnvVar: "DEMO_PASSWORD_NUEVO",
    users: [
      { email: "demo@grupo-nuevo-demo.dev", role: "SECRETARIO" },
      { email: "admin@grupo-nuevo-demo.dev", role: "ADMIN_TENANT" },
    ],
    branding: {
      nombre: "Grupo Nuevo",
      shell_label: "TGMS · GRUPO NUEVO",
      scope_label: "Grupo Nuevo",
      sii_org_label: "Grupo Nuevo",
      fixtures: "none",
      // Paleta neutra (azul pizarra): ni el rojo de ARGA ni el verde de Garrigues.
      tokens: {
        "--t-brand": "#1f3a5f",
        "--t-brand-hover": "#2b4f7e",
        "--t-brand-bright": "#3b6ea8",
        "--t-surface-subtle": "#e3ebf4",
        "--t-sec-primary": "#7fa3cc",
        "--t-surface-page": "#f3f5f8",
        "--t-surface-card": "#ffffff",
        "--t-surface-muted": "hsl(214, 16%, 90%)",
        "--t-text-primary": "#1f2937",
        "--t-text-secondary": "#4b5563",
        "--t-text-inverse": "#ffffff",
        "--t-border-default": "#c3cedb",
        "--t-border-subtle": "#dbe2ea",
        "--t-border-focus": "#1f3a5f",
        "--t-status-success": "#2f855a",
        "--t-status-warning": "#b7791f",
        "--t-status-error": "hsl(0, 72%, 51%)",
        "--t-status-info": "#3b6ea8",
        "--t-sidebar-bg": "#1f3a5f",
        "--t-sidebar-fg": "#FFFFFF",
        "--t-sidebar-active": "rgba(255,255,255,0.20)",
        "--t-sidebar-hover": "rgba(255,255,255,0.12)",
        "--t-sidebar-label": "rgba(255,255,255,0.55)",
        "--t-sidebar-scope-bg": "rgba(255,255,255,0.12)",
        "--primary": "214 51% 25%",
        "--primary-foreground": "0 0% 100%",
        "--accent": "212 36% 92%",
        "--accent-foreground": "214 51% 25%",
        "--ring": "214 51% 25%",
        "--sidebar-background": "214 51% 25%",
        "--sidebar-foreground": "0 0% 100%",
      },
    },
    grcModules: GRC_MODULES_GENERICOS,
    packBase: "LSC_ES",
    // Bootstrap ejecutado con --commit el 2026-09-19 (fundación + pack base).
    cloud: "PROVISIONADO",
  },
};

/** Lookup con `hasOwnProperty`: "constructor" o "__proto__" no son tenants. */
export function tenantSpec(key: string | null | undefined): TenantSpec | null {
  if (!key) return null;
  return Object.prototype.hasOwnProperty.call(TENANT_SPECS, key) ? TENANT_SPECS[key] : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Valida un spec ANTES de tocar Cloud. Devuelve la lista de problemas (vacía =
 * válido). Cada regla responde a un defecto medido en el repo, no a estética.
 */
export function validarTenantSpec(spec: TenantSpec): string[] {
  const p: string[] = [];
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(spec.key)) p.push(`key inválida: ${spec.key}`);
  if (!UUID_RE.test(spec.tenantId)) p.push(`tenantId no es UUID: ${spec.tenantId}`);
  if (TENANTS_RESERVADOS.includes(spec.tenantId)) {
    p.push(`tenantId ${spec.tenantId} es un tenant RESERVADO (ARGA/Garrigues): este catálogo no puede apuntarle`);
  }
  if (!spec.name.trim()) p.push("name vacío");
  if (!/^[A-Z]{2}$/.test(spec.countryCode)) p.push(`countryCode inválido: ${spec.countryCode}`);

  // rule_packs.id es PK global: el prefijo es lo único que evita la colisión.
  if (!/^[A-Z][A-Z0-9]{1,7}$/.test(spec.packIdPrefix)) p.push(`packIdPrefix inválido: ${spec.packIdPrefix}`);
  if (spec.packIdPrefix === "GARR") p.push("packIdPrefix GARR pertenece a Garrigues");

  if (!/^DEMO_PASSWORD_[A-Z0-9_]+$/.test(spec.passwordEnvVar)) p.push(`passwordEnvVar inválida: ${spec.passwordEnvVar}`);

  // branding NULL o con rótulos vacíos = la aplicación pinta los defaults de
  // ARGA verbatim ("Grupo ARGA", "Buen día, Lucía"). Todo rótulo es obligatorio.
  for (const campo of ["nombre", "shell_label", "scope_label", "sii_org_label"] as const) {
    const v = spec.branding[campo];
    if (typeof v !== "string" || !v.trim()) p.push(`branding.${campo} vacío: caería al default de ARGA`);
    else if (/\barga\b/i.test(v)) p.push(`branding.${campo} menciona ARGA`);
  }
  if (spec.branding.fixtures !== "none") p.push('branding.fixtures debe ser "none" en un tenant en blanco');
  if (spec.branding.modules !== undefined) {
    const m = spec.branding.modules;
    if (!Array.isArray(m) || m.length === 0 || !m.every((x) => typeof x === "string")) {
      p.push("branding.modules declarada pero vacía o malformada (fallaría abierto sin decirlo): omítela o rellénala");
    }
  }
  const tokens = Object.entries(spec.branding.tokens ?? {});
  if (tokens.length === 0) p.push("branding.tokens vacío");
  for (const [k, v] of tokens) {
    if (!k.startsWith("--")) p.push(`token sin prefijo --: ${k}`);
    if (typeof v !== "string" || !v.trim()) p.push(`token sin valor: ${k}`);
  }

  // Usuarios: dominio ficticio SIEMPRE (nunca el dominio real de nadie).
  const roles = new Set(spec.users.map((u) => u.role));
  if (!roles.has("SECRETARIO")) p.push("falta un usuario SECRETARIO (opera Secretaría)");
  if (!roles.has("ADMIN_TENANT")) p.push("falta un usuario ADMIN_TENANT (importa y activa plantillas)");
  const emails = new Set<string>();
  for (const u of spec.users) {
    if (!/^[a-z0-9._-]+@[a-z0-9-]+-demo\.dev$/.test(u.email)) {
      p.push(`email fuera del patrón ficticio *-demo.dev: ${u.email}`);
    }
    if (emails.has(u.email)) p.push(`email repetido: ${u.email}`);
    emails.add(u.email);
  }

  const ids = spec.grcModules.map((m) => m.id);
  if (!ids.includes("risk")) p.push("grcModules sin `risk`: tg_sync_obligation_to_backbone cae a él sin comprobar que exista");
  if (new Set(ids).size !== ids.length) p.push("grcModules con id repetido");
  for (const m of spec.grcModules) {
    // description y owner son NOT NULL sin default en grc_modules.
    if (!m.name.trim() || !m.description.trim() || !m.owner.trim()) p.push(`grcModule ${m.id} con campo vacío`);
    if (/\barga\b/i.test(`${m.name} ${m.description} ${m.owner}`)) p.push(`grcModule ${m.id} menciona ARGA`);
  }
  return p;
}
