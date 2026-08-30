/**
 * scripts/garrigues/ia/catalogo-ia.ts
 *
 * C · Inventario de sistemas de IA del tenant Garrigues
 * (`00000000-0000-0000-0000-000000000002`). **Única fuente de verdad.**
 *
 * FUENTE Y SU LÍMITE
 * ------------------
 * La fuente NO es uniforme, y por eso hay tres niveles de procedencia que no se
 * mezclan. Presentar como norma interna vigente algo que sólo declaró el usuario
 * sería el mismo defecto que este carril lleva retirando de la consola.
 *
 *   PI-30_ART_3_1_1     Política interna vigente (PI-30, Edición 02, julio 2025),
 *                       apartado 3.1.1 «Herramientas corporativas». El PDF vive
 *                       en `version garrigues/` y está en .gitignore: no se
 *                       commitea, se cita.
 *   DECLARADO_USUARIO   Declarado por el usuario, sin respaldo en el corpus
 *                       documental. PI-30 **no menciona** los acuerdos
 *                       enterprise, y clasifica las versiones públicas de esos
 *                       mismos proveedores como NO corporativas (§3.1.2).
 *   PLAN_NO_DESPLEGADO  Roadmap. No está en producción y no se presenta como si
 *                       lo estuviera.
 *
 * SOBRE `risk_level`
 * ------------------
 * Va a `null` en todos, a propósito. **Nadie ha hecho la clasificación** del
 * art. 6 y el anexo III del Reglamento (UE) 2024/1689. Escribir "Alto" o
 * "Limitado" sería inventarla, y la consola ya sabe pintar "sin clasificar".
 * Cuando exista la clasificación, se hace aquí y se siembra.
 */

export type Procedencia = "PI-30_ART_3_1_1" | "DECLARADO_USUARIO" | "PLAN_NO_DESPLEGADO";

export type SistemaIA = {
  /** Código interno estable; alimenta `ai_systems.aims_reference_code`. */
  code: string;
  name: string;
  vendor: string | null;
  system_type: string;
  /** Siempre `null`: ver la nota de cabecera. */
  risk_level: null;
  use_case: string;
  description: string;
  status: "ACTIVO" | "PLANIFICADO";
  provenance: Procedencia;
  /** De dónde sale exactamente, para que se pueda ir a comprobarlo. */
  sourceRef: string;
  /** Restricciones que la propia política impone al uso. */
  restrictions?: string;
  /**
   * PI-30 §3.2(c) obliga a revisar, ajustar y validar todo output antes de
   * usarlo, y dice que la IA «no es un sustituto» del trabajo. Es dato de la
   * fuente, no interpretación.
   */
  humanOversight: boolean;
  /** Se enlaza por slug: `/organos/:id` resuelve por slug, no por UUID. */
  owner_body_slug: "garrigues-comite-gobernanza-ia";
};

const COMITE = "garrigues-comite-gobernanza-ia" as const;
// La referencia dice EXACTAMENTE qué cubre. La política nombra la herramienta y
// la declara corporativa; no dice quién la fabrica ni para qué se usa. Dejar
// `vendor` y `use_case` bajo una referencia que sólo pone «PI-30 §3.1.1» los
// presentaba como si constaran en la fuente — que es el defecto que este carril
// retira de la consola, en pequeño y dentro de casa.
const PI30 =
  "PI-30 (Edición 02, julio 2025), apartado 3.1.1 «Herramientas corporativas»: de ahí " +
  "salen el nombre y su condición de herramienta corporativa aprobada. El proveedor y " +
  "el caso de uso NO constan en la política; son descripción general del producto.";
const PROHIBICION_GRAFICOS =
  "PI-30 §3.2(d): no se permite generar contenidos gráficos ni audiovisuales. El uso " +
  "extraordinario exige informe al Departamento de Intangibles y autorización del Comité " +
  "de IA y, después, del Senior Partner.";

export const SISTEMAS_IA: SistemaIA[] = [
  {
    code: "GARR-IA-001",
    name: "Copilot",
    vendor: "Microsoft",
    system_type: "Asistente de IA generativa",
    risk_level: null,
    use_case: "Asistencia ofimática y de productividad en el trabajo profesional.",
    description:
      "Herramienta corporativa aprobada por el Despacho tras verificar los niveles de " +
      "seguridad, confidencialidad y cumplimiento normativo exigibles para uso profesional.",
    status: "ACTIVO",
    provenance: "PI-30_ART_3_1_1",
    sourceRef: PI30,
    restrictions: PROHIBICION_GRAFICOS,
    humanOversight: true,
    owner_body_slug: COMITE,
  },
  {
    code: "GARR-IA-002",
    name: "Harvey",
    vendor: "Harvey",
    system_type: "Asistente de IA generativa para trabajo jurídico",
    risk_level: null,
    use_case: "Asistencia documental y de análisis en el ejercicio profesional.",
    description:
      "Herramienta corporativa aprobada por el Despacho tras verificar los niveles de " +
      "seguridad, confidencialidad y cumplimiento normativo exigibles para uso profesional.",
    status: "ACTIVO",
    provenance: "PI-30_ART_3_1_1",
    sourceRef: PI30,
    restrictions: PROHIBICION_GRAFICOS,
    humanOversight: true,
    owner_body_slug: COMITE,
  },
  {
    code: "GARR-IA-003",
    name: "Garrigues GA_IA",
    vendor: "Garrigues",
    system_type: "Plataforma interna de IA generativa",
    risk_level: null,
    use_case: "Plataforma propia del Despacho para uso profesional interno.",
    description:
      "Herramienta corporativa propia. La política la aprueba con una excepción expresa.",
    status: "ACTIVO",
    provenance: "PI-30_ART_3_1_1",
    sourceRef: PI30,
    restrictions:
      "PI-30 §3.1.1 excluye las funcionalidades de Gemini-Google, que se rigen por lo " +
      "dispuesto en el §3.2 en su totalidad. " + PROHIBICION_GRAFICOS,
    humanOversight: true,
    owner_body_slug: COMITE,
  },
  {
    code: "GARR-IA-101",
    name: "Acuerdo enterprise OpenAI",
    vendor: "OpenAI",
    system_type: "Acuerdo con proveedor de modelos",
    risk_level: null,
    use_case: "Declarado por el usuario; sin uso concreto acreditado en el corpus.",
    description:
      "DECLARADO POR EL USUARIO, sin respaldo documental. PI-30 no menciona acuerdos " +
      "enterprise y clasifica la versión pública de este proveedor como herramienta NO " +
      "corporativa (§3.1.2), sujeta a restricciones. No debe leerse como aprobación.",
    status: "ACTIVO",
    provenance: "DECLARADO_USUARIO",
    sourceRef: "Declaración del usuario en el encargo del carril C2 (2026-08-29)",
    humanOversight: false,
    owner_body_slug: COMITE,
  },
  {
    code: "GARR-IA-102",
    name: "Acuerdo enterprise Anthropic",
    vendor: "Anthropic",
    system_type: "Acuerdo con proveedor de modelos",
    risk_level: null,
    use_case: "Declarado por el usuario; sin uso concreto acreditado en el corpus.",
    description:
      "DECLARADO POR EL USUARIO, sin respaldo documental. Misma cautela que el acuerdo " +
      "con OpenAI: PI-30 no lo menciona y clasifica la versión pública de este proveedor " +
      "como herramienta NO corporativa (§3.1.2).",
    status: "ACTIVO",
    provenance: "DECLARADO_USUARIO",
    sourceRef: "Declaración del usuario en el encargo del carril C2 (2026-08-29)",
    humanOversight: false,
    owner_body_slug: COMITE,
  },
  {
    code: "GARR-IA-201",
    name: "Soluciones agénticas de proceso",
    vendor: null,
    system_type: "Roadmap de automatización agéntica",
    risk_level: null,
    use_case: "Resolución progresiva de procesos internos.",
    description:
      "PLAN, NO DESPLEGADO. Figura en el roadmap declarado por el usuario y no consta en " +
      "producción. Se inventaría para que el plan sea visible, no para dar por hecho lo " +
      "que aún no existe.",
    status: "PLANIFICADO",
    provenance: "PLAN_NO_DESPLEGADO",
    sourceRef: "Declaración del usuario en el encargo del carril C2 (2026-08-29)",
    humanOversight: false,
    owner_body_slug: COMITE,
  },
];
