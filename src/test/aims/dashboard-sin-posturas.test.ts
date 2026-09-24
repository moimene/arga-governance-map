// src/test/aims/dashboard-sin-posturas.test.ts
//
// El Dashboard de AI Governance ya no lleva dentro un catálogo de posturas.
//
// `aimsScreenPostures` era una descripción EN PROSA de lo que hacen las diez
// pantallas del módulo, mantenida aparte de las pantallas: derivaba en cuanto
// alguien tocaba una, y llegó a afirmar por las diez filas lo que sólo valía
// para ocho. Se retira entera (D-10). Lo que sobrevive es el DATO de
// navegación —los cuatro handoffs—, que se muda a la hoja `@/lib/aims/handoffs`.
//
// Todo se mide sobre el fuente SIN COMENTARIOS: el comentario que explica una
// retirada cita por fuerza lo retirado, y sin esto el gate se dispara contra su
// propia justificación.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
import { mockearModulos } from "@/test/garrigues/_mock-restaurable";

// Las tres listas se montan con las consultas mockeadas en dos modos: una
// lectura que FALLA y una que devuelve vacío. Restaurado en `afterAll` porque
// `mock.module` es global a la corrida (ver _mock-restaurable.ts).
// Tercer modo (F1.T8): `datos`, con filas de forma real, para medir lo que la
// portada pinta con dato y no sólo con vacío o error.
let modo: "error" | "vacio" | "datos" | "guiados" = "vacio";
const DATOS: Record<string, unknown[]> = {
  systems: [
    // ARGA medido: nivel «Alto» declarado en ficha, sin cuestionario.
    { id: "s1", name: "ARGA Score", status: "ACTIVO", risk_level: "Alto", regulatory_profile: null },
    { id: "s2", name: "FraudGuard", status: "ACTIVO", risk_level: "Alto", regulatory_profile: null },
  ],
  assessments: [
    // Ordenadas por fecha descendente, como las devuelve el hook: la primera es un BORRADOR.
    { id: "a2", system_id: "s1", framework: "ISO_42001", status: "BORRADOR", assessment_date: "2026-07-31", findings: [] },
    { id: "a1", system_id: "s1", framework: "EU_AI_ACT", status: "APROBADO", assessment_date: "2026-07-19", findings: [] },
  ],
};
// Control positivo del tono: los mismos sistemas, clasificados por cuestionario.
const GUIADOS: Record<string, unknown[]> = {
  ...DATOS,
  systems: (DATOS.systems as Array<Record<string, unknown>>).map((s) => ({ ...s, regulatory_profile: { cuestionario_id: `q-${s.id}` } })),
};
const consulta = (clave?: string) => () =>
  modo === "error"
    ? { data: undefined, isLoading: false, isError: true, error: new Error("permiso denegado") }
    : { data: clave && (modo === "datos" || modo === "guiados") ? (modo === "guiados" ? GUIADOS : DATOS)[clave] ?? [] : [], isLoading: false, isError: false, error: null };
// El Dashboard lee además secciones e indicadores del tenant (F1.T3). El resto
// del módulo se conserva real: lo importan otras pantallas.
const expedienteReal = await import("@/hooks/useAimsTechnicalFile");
const restaurarMocks = await mockearModulos([
  ["@/hooks/useAimsTechnicalFile", () => ({
    ...expedienteReal,
    useAimsTechnicalFileSectionsDelTenant: consulta(),
    useAimsMonitoringIndicatorsDelTenant: consulta(),
  })],
  ["@/hooks/useAiSystems", () => ({ useAiSystemsList: consulta("systems") })],
  ["@/hooks/useAiIncidents", () => ({ useAiIncidentsList: consulta() })],
  ["@/hooks/useAiAssessments", () => ({ useAllAssessments: consulta("assessments"), useAllComplianceChecks: consulta() })],
  ["@/hooks/useAimsClasificacion", () => ({ useCuestionariosVigentesDelTenant: consulta() })],
  ["@/hooks/useBodies", () => ({ useBodyBySlug: () => ({ data: null }) })],
  ["@/context/ScopeContext", () => ({ useScope: () => ({ scope: "Todos" }) })],
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: null }) })],
]);
afterAll(restaurarMocks);
afterEach(() => cleanup());

const DASHBOARD = "src/pages/ai-governance/Dashboard.tsx";
const READINESS = "src/lib/aims/readiness.ts";
const HANDOFFS = "src/lib/aims/handoffs.ts";
const DIR = "src/components/ai-governance/dashboard";

const read = (f: string) => readFileSync(f, "utf8");
const lineas = (f: string) => read(f).split("\n").length;

/** Todos los `.ts`/`.tsx` bajo `src/`, para que el barrido no sea una lista. */
function fuentes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  for (const d of ["src/pages", "src/components", "src/lib", "src/hooks", "src/test"]) walk(d);
  return out;
}

describe("control positivo del instrumento", () => {
  it("las dos superficies existen y tienen cuerpo", () => {
    // Las aserciones de ausencia de abajo pasarían por vacuidad si el fichero
    // hubiera desaparecido o se hubiera quedado en un cascarón.
    expect(existsSync(DASHBOARD), `${DASHBOARD} no existe`).toBe(true);
    expect(lineas(DASHBOARD)).toBeGreaterThan(100);
    expect(existsSync(READINESS), `${READINESS} no existe`).toBe(true);
    expect(lineas(READINESS)).toBeGreaterThan(300);
  });

  it("el barrido de `src/` ve el árbol entero, no un subconjunto mudo", () => {
    const ficheros = fuentes();
    expect(ficheros.length, "el barrido de src/ se ha quedado corto").toBeGreaterThan(200);
    for (const esperado of [DASHBOARD, READINESS, HANDOFFS]) {
      expect(ficheros, `${esperado} no entra en el barrido`).toContain(esperado);
    }
  });
});

describe("el catálogo de posturas de pantalla está retirado", () => {
  it("`readiness.ts` ya no exporta ni las posturas ni los handoffs", () => {
    const src = sinComentarios(read(READINESS));
    expect(/export const aimsScreenPostures/.test(src)).toBe(false);
    expect(/export const aimsReadOnlyHandoffs/.test(src)).toBe(false);
    expect(/export interface AimsScreenPosture/.test(src)).toBe(false);
    // Y no se ha vaciado el módulo por el camino: el criterio sigue ahí.
    expect(src).toContain("export function buildAimsReadiness");
    expect(src).toContain("export function buildAimsComplianceMonitors");
  });

  it("no queda una sola aparición de `aimsScreenPostures` en `src/`", () => {
    // Este fichero se excluye: nombra lo prohibido para poder prohibirlo, igual
    // que `sinComentarios` protege a la prosa que explica una retirada.
    const YO = "src/test/aims/dashboard-sin-posturas.test.ts";
    const conRastro = fuentes()
      .filter((f) => f !== YO)
      .filter((f) => sinComentarios(read(f)).includes("aimsScreenPostures"));
    expect(conRastro, `el catálogo de posturas sigue vivo en: ${conRastro.join(", ")}`).toEqual([]);
  });

  it("el Dashboard cabe en 400 líneas", () => {
    expect(lineas(DASHBOARD)).toBeLessThanOrEqual(400);
  });

  it("ningún componente del dashboard pasa de 400 líneas", () => {
    const ficheros = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));
    expect(ficheros.length, "el directorio de componentes del dashboard está vacío").toBeGreaterThan(3);
    for (const f of ficheros) {
      expect({ f, cabe: lineas(`${DIR}/${f}`) <= 400 }).toEqual({ f, cabe: true });
    }
  });
});

describe("los handoffs son dato de navegación en un módulo hoja", () => {
  it("`handoffs.ts` no importa nada", () => {
    // Hoja de verdad: si importara de `@/` o de un hermano volvería a poder
    // participar en un ciclo, que es lo que ya tumbó `/secretaria` una vez.
    const src = sinComentarios(read(HANDOFFS));
    expect([...src.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim())).toEqual([]);
  });

  it("los cuatro handoffs siguen siendo rutas de solo lectura", async () => {
    const { AIMS_HANDOFFS } = await import("@/lib/aims/handoffs");
    expect(AIMS_HANDOFFS.length).toBe(4);
    for (const handoff of AIMS_HANDOFFS) {
      expect(handoff.mutation, `${handoff.id}: deja de declararse read-only`).toBe(
        "read-only route handoff",
      );
      expect(handoff.targetRoute).not.toContain("governance_module_events");
      expect(handoff.targetRoute).not.toContain("governance_module_links");
    }
  });
});

describe("la clasificación guiada se cuenta del dato, y el órgano sigue enlazado", () => {
  it("el Dashboard importa y monta la tarjeta de clasificación guiada", () => {
    const src = sinComentarios(read(DASHBOARD));
    expect(src).toContain("dashboard/ClasificacionGuiadaCard");
    expect(/<ClasificacionGuiadaCard\s/.test(src), "la tarjeta se importa pero no se monta").toBe(true);
  });

  it("la tarjeta lee los cuestionarios vigentes y etiqueta el perfil con la hoja", () => {
    const src = sinComentarios(read(`${DIR}/ClasificacionGuiadaCard.tsx`));
    expect(src).toContain("useCuestionariosVigentesDelTenant");
    expect(src).toContain("ETIQUETA_PERFIL");
    // El recuento se cruza con el inventario que la pantalla enseña, no con el
    // total de la tabla: un cuestionario de un sistema fuera de ámbito no
    // clasifica nada de lo que se está viendo.
    expect(/enInventario\.has\(/.test(src), "la tarjeta cuenta sin cruzar con el inventario").toBe(true);
  });

  it("la arista del órgano rector sobrevive a la descomposición", () => {
    // La página resuelve el órgano por tenant —`useBodyBySlug` filtra además
    // por `tenant_id`— y sólo monta el componente si la consulta devuelve fila.
    // El componente pinta el enlace. Las dos mitades se comprueban juntas: sin
    // esto, quitar el `<Link` dejaría un rótulo muerto y nadie lo notaría.
    const page = sinComentarios(read(DASHBOARD));
    expect(
      /useBodyBySlug\(\s*aiGovernanceBodySlug\(/.test(page),
      "el slug resuelto por tenant ya no alimenta la consulta del órgano",
    ).toBe(true);
    expect(/\{aiBody && <OrganoRector\s/.test(page), "el panel del órgano se monta sin condición").toBe(true);

    const comp = sinComentarios(read(`${DIR}/OrganoRector.tsx`));
    expect(/<Link\b/.test(comp), "OrganoRector ya no enlaza: sólo rotula").toBe(true);
    expect(/to=\{`\/organos\/\$\{slug\}`\}/.test(comp), "el enlace del órgano no apunta a su ficha").toBe(true);
  });
});

describe("D4 — una lectura fallida no se pinta como inventario vacío", () => {
  const LISTAS: Array<[string, string, string]> = [
    // [página, literal de vacío, literal de fallo]
    ["@/pages/ai-governance/Dashboard", "Sin inventario registrado", "No se pudo leer el inventario"],
    ["@/pages/ai-governance/Sistemas", "Sin sistemas registrados en el inventario", "No se pudo leer el inventario"],
    ["@/pages/ai-governance/Evaluaciones", "Sin evaluaciones registradas", "No se pudo leer las evaluaciones"],
  ];

  async function montar(ruta: string) {
    const { default: Pagina } = await import(ruta);
    render(createElement(MemoryRouter, null, createElement(Pagina)));
  }

  for (const [ruta, vacio, fallo] of LISTAS) {
    it(`${ruta}: con la consulta rechazada dice el motivo y no el vacío`, async () => {
      modo = "error";
      await montar(ruta);
      expect(screen.getByRole("alert").textContent).toContain(`${fallo} (permiso denegado)`);
      expect(screen.queryByText(new RegExp(vacio))).toBeNull();
      // El Dashboard tampoco deja la prioridad con ceros y su literal de vacío.
      expect(screen.queryByText(/Sin sistemas registrados en el inventario/)).toBeNull();
    });

    it(`${ruta}: control positivo — con datos vacíos sí aparece el literal de vacío`, async () => {
      modo = "vacio";
      await montar(ruta);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getAllByText(new RegExp(vacio)).length).toBeGreaterThan(0);
    });
  }
});

describe("D6 — el nivel sólo lleva color con cuestionario, y se cuenta con la hoja", () => {
  it("Sistemas importa `tieneClasificacionGuiada` y con él decide el color del chip", () => {
    const src = sinComentarios(read("src/pages/ai-governance/Sistemas.tsx"));
    expect(src).toContain('from "@/lib/aims/cuestionario-calificacion"');
    expect(/const guiada = tieneClasificacionGuiada\(system\)/.test(src)).toBe(true);
    expect(/claseNivelRiesgo\(guiada \? system\.risk_level : null\)/.test(src),
      "el chip vuelve a colorear el nivel declarado en ficha sin cuestionario").toBe(true);
    expect(src).toContain("sin cuestionario");
    // Y el chip se monta en las dos vistas (tabla y móvil), no sólo se declara.
    expect((src.match(/<RiskChip system=\{sys\} \/>/g) ?? []).length).toBe(2);
  });

  it("el Dashboard pinta el mismo chip neutro sin cuestionario en su inventario (tabla y móvil)", () => {
    const src = sinComentarios(read(DASHBOARD));
    expect(/const guiada = tieneClasificacionGuiada\(system\)/.test(src)).toBe(true);
    expect(/claseNivelRiesgo\(guiada \? system\.risk_level : null\)/.test(src),
      "el Dashboard vuelve a colorear el nivel declarado en ficha sin cuestionario").toBe(true);
    expect(src).toContain("sin cuestionario");
    expect((src.match(/<RiskBadge system=\{sys\} \/>/g) ?? []).length).toBe(2);
  });

  it("el Dashboard cuenta la clasificación por la hoja y se lo pasa a la prioridad", () => {
    const src = sinComentarios(read(DASHBOARD));
    expect(/systems\.filter\(tieneClasificacionGuiada\)/.test(src)).toBe(true);
    // Y la tarjeta usa el MISMO criterio: no hay dos «clasificado» en la misma pantalla.
    const card = sinComentarios(read(`${DIR}/ClasificacionGuiadaCard.tsx`));
    expect(/const clasificados = systems\.filter\(tieneClasificacionGuiada\)/.test(card),
      "la tarjeta cuenta «clasificado» por otro camino que la prioridad").toBe(true);
    expect(/conClasificacionGuiada=\{conClasificacionGuiada\}/.test(src)).toBe(true);
    const prio = sinComentarios(read(`${DIR}/PrioridadAhora.tsx`));
    expect(prio).toContain("con clasificación guiada");
    expect(prio).not.toContain("con nivel de riesgo declarado");
  });
});

describe("el filtro de estado de Sistemas compara normalizado, como su propio KPI", () => {
  it("una fila «Activo» no desaparece al filtrar por ACTIVO, ni aparece como opción duplicada", () => {
    const src = sinComentarios(read("src/pages/ai-governance/Sistemas.tsx"));
    expect(/normalizeAimsStatus\(s\.status\) === statusFilter/.test(src), "vuelve a comparar `s.status` en crudo").toBe(true);
    expect(/opcionesFiltro\("estadoSistema", systems\.map\(\(s\) => normalizeAimsStatus\(s\.status\)\)\)/.test(src),
      "las opciones extra se ofrecen en crudo y no casan con la comparación").toBe(true);
    expect(/\bs\.status === statusFilter/.test(src)).toBe(false);
  });
});

describe("D7 — copy sin nombres de tabla ni jerga de contrato, y raíz etiquetada", () => {
  const COMPONENTES = readdirSync(DIR).filter((f) => f.endsWith(".tsx")).map((f) => `${DIR}/${f}`);
  const SUPERFICIE = [...COMPONENTES, DASHBOARD, "src/pages/ai-governance/Sistemas.tsx", "src/pages/ai-governance/Evaluaciones.tsx"];

  it("ReadinessDomains es una <section aria-label=\"Readiness AIMS\">", () => {
    const src = sinComentarios(read(`${DIR}/ReadinessDomains.tsx`));
    expect(/<section\s+aria-label="Readiness AIMS"/.test(src)).toBe(true);
    expect(src).toContain("Estado del módulo");
  });

  it("los rótulos viejos no sobreviven en ninguna superficie", () => {
    expect(SUPERFICIE.length).toBeGreaterThan(8);
    for (const f of SUPERFICIE) {
      const src = sinComentarios(read(f));
      for (const viejo of ["Readiness de demo", "Demo operable", "Demo con gaps", "Standalone", "officer", "intake GRC"]) {
        expect(src.includes(viejo), `${f}: sigue diciendo «${viejo}»`).toBe(false);
      }
      // Nombres de tabla en el copy: `ai_*`, `aims_*`, `evidence_bundles`…
      expect(/<code>a(i|ims)_\*<\/code>|ai_\* → aims_\*|`aims_\*`|evidence_bundles y audit_log/.test(src),
        `${f}: nombra tablas en el copy`).toBe(false);
    }
    const readiness = sinComentarios(read(READINESS));
    expect(/Migración ai_\*|mapping ai_systems|evidence_bundles y audit_log/.test(readiness)).toBe(false);
    // La jerga tampoco sobrevive por el DATO que pintan los monitores (`detail`).
    expect(/intake GRC|officer|handoff potencial/.test(readiness), "readiness.ts sigue llevando la jerga en `detail`").toBe(false);
    // Ni por el chip literal del monitor, ni por la prosa fija del Dashboard.
    const panel = sinComentarios(read(`${DIR}/ComplianceMonitorPanel.tsx`));
    expect(/>\s*handoff\s*</.test(panel), "el monitor vuelve a pintar el chip «handoff»").toBe(false);
    expect(/>\s*derivación\s*</.test(panel)).toBe(true);
    expect(sinComentarios(read(DASHBOARD))).not.toContain("reciben handoffs");
  });

  it("el veredicto es «Operable» / «Con carencias» y sale del resumen", () => {
    const src = sinComentarios(read(DASHBOARD));
    expect(/readiness\.standaloneReady \? "Operable" : "Con carencias"/.test(src)).toBe(true);
  });

  it("HandoffAffordances traduce la postura y no pinta el evento de contrato", () => {
    const src = sinComentarios(read(`${DIR}/HandoffAffordances.tsx`));
    expect(src).toContain('NOT_EVIDENCE: "No es evidencia"');
    expect(/\{handoff\.contractEvent\}/.test(src)).toBe(false);
    expect(/\{handoff\.evidencePosture\}/.test(src), "la postura vuelve a pintarse en crudo").toBe(false);
  });

  it("el monitor pinta las comprobaciones apartadas y etiqueta la fuente en castellano", () => {
    const src = sinComentarios(read(`${DIR}/ComplianceMonitorPanel.tsx`));
    expect(/monitor\.otroCatalogo > 0 &&/.test(src)).toBe(true);
    expect(src).toContain("medidas contra otro catálogo");
    expect(/\{monitor\.source\}/.test(src), "la fuente vuelve a pintarse como nombre de tabla").toBe(false);
  });
});

describe("«handoff» no se rinde como rótulo en ninguna superficie del módulo (2026-09-14)", () => {
  // La revisión transversal cazó que el Dashboard cambió «handoff» → «derivación»
  // mientras el panel de derivaciones, el botón de la ficha del incidente y un
  // toast seguían diciendo «handoff»: retirada a medias. Se juzga lo renderizado.
  const DIRS = [
    "src/components/ai-governance/dashboard",
    "src/components/ai-governance/incidente",
    "src/components/ai-governance/sistema",
  ];
  const ficheros = DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".tsx")).map((f) => `${d}/${f}`));

  it("ni botón, ni heading, ni toast con «handoff»", () => {
    expect(ficheros.length).toBeGreaterThan(20);
    for (const f of ficheros) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      expect(src, `${f}: rótulo «Handoff» renderizado`).not.toMatch(/>\s*Handoffs?\b[^<]*</);
      expect(src, `${f}: toast con «handoff»`).not.toMatch(/toast\.[a-z]+\([^)]*handoff/i);
    }
  });

  it("control positivo: la palabra vigente sí está donde se retiró la vieja", () => {
    const cabecera = readFileSync("src/components/ai-governance/incidente/CabeceraIncidente.tsx", "utf8");
    expect(cabecera).toContain("Derivar a GRC");
    const panel = readFileSync("src/components/ai-governance/dashboard/HandoffAffordances.tsx", "utf8");
    expect(panel).toContain('aria-label="Derivaciones AIMS"');
    expect(panel).toContain("Derivaciones de solo lectura");
  });
});

describe("F1.T8 — rótulos de madurez y portada honesta", () => {
  const PRIORIDAD = `${DIR}/PrioridadAhora.tsx`;
  // El valor del KPI (no el de la prioridad): el rótulo del KpiCard va detrás de su valor.
  const valorKpiAltos = () =>
    screen.getAllByText("Alto riesgo sin autodiagnóstico acreditado").find((e) => e.tagName === "DIV")!.previousElementSibling!;
  const DOMINIOS = `${DIR}/ReadinessDomains.tsx`;

  it("sin constantes: ni `QUICK_ACTIONS` en la prioridad ni una lista fija de «Próximos pasos»", () => {
    // Control positivo del detector sobre la forma retirada.
    const listaFija = /nextSteps:\s*\[\s*"/;
    expect(listaFija.test('nextSteps: [\n  "Cerrar evaluación aprobada de cada sistema de riesgo Alto.",')).toBe(true);
    expect(listaFija.test(sinComentarios(read(READINESS))), "readiness vuelve a llevar una lista fija de pasos").toBe(false);
    expect(sinComentarios(read(PRIORIDAD))).not.toMatch(/QUICK_ACTIONS/);
    expect(sinComentarios(read(DOMINIOS))).not.toMatch(/Próximos pasos/);
    // La prioridad pinta los pasos que recibe, derivados del dato.
    expect(sinComentarios(read(DASHBOARD))).toMatch(/pasos=\{readiness\.nextSteps\}/);
  });

  it("los pasos salen del dato: vacío pide el alta; con dato, dicen cuántos y dónde", async () => {
    const { buildAimsReadiness } = await import("@/lib/aims/readiness");
    const vacio = buildAimsReadiness({ systems: [], assessments: [], incidents: [] }).nextSteps;
    expect(vacio.map((p) => p.to)).toEqual(["/ai-governance/sistemas/nuevo"]);
    const conDato = buildAimsReadiness({
      systems: [
        { id: "s1", status: "ACTIVO", risk_level: "Alto", regulatory_profile: { cuestionario_id: "q" } },
        { id: "s2", status: "ACTIVO", risk_level: "Alto" },
      ],
      assessments: [{ id: "a", system_id: "s1", status: "CONFORME", findings: [] }],
      incidents: [{ id: "i", system_id: "s1", status: "EN_INVESTIGACION" }],
    }).nextSteps;
    const detalle = conDato.map((p) => p.detalle).join(" | ");
    expect(detalle).toMatch(/1 sistemas sin clasificación guiada/);
    expect(detalle).toMatch(/1 autodiagnósticos vigentes sin congelar y revisar/);
    // El «Alto» se cuenta sólo con cuestionario; el declarado en ficha, aparte.
    expect(detalle).toMatch(/1 sistemas de alto riesgo sin autodiagnóstico acreditado/);
    expect(detalle).toMatch(/1 declarados Alto en ficha, sin cuestionario/);
    expect(detalle).toMatch(/1 incidentes abiertos o en investigación/);
    expect(conDato.every((p) => p.to.startsWith("/"))).toBe(true);
  });

  it("«Autodiagnóstico de madurez» en todas las superficies; ya no «de riesgo» ni «de conformidad»", () => {
    const SUPERFICIES = [
      "src/pages/ai-governance/Evaluaciones.tsx",
      "src/pages/ai-governance/EvaluacionNueva.tsx",
      "src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx",
    ];
    for (const f of SUPERFICIES) {
      const src = sinComentarios(read(f));
      expect(src, f).toMatch(/[Aa]utodiagnóstico de madurez/);
      expect(src, f).not.toMatch(/Evaluaciones de riesgo IA|Autodiagnóstico de Conformidad/i);
    }
  });

  it("con dato: «Última evaluación» es la última no borrador, y el nivel sin cuestionario se pinta neutro", async () => {
    modo = "datos";
    const { default: Pagina } = await import("@/pages/ai-governance/Dashboard");
    render(createElement(MemoryRouter, null, createElement(Pagina)));
    // El BORRADOR del 31-07 no es la última evaluación: lo es la del 19-07.
    expect(screen.getByText("2026-07-19")).toBeTruthy();
    expect(screen.queryByText("2026-07-31")).toBeNull();
    // Los dos «Alto» son nivel declarado en ficha, sin cuestionario: van a su
    // fila neutra y la fila «Alto» (sólo nivel de cuestionario) queda a cero.
    const fila = screen.getByText("Declarado, sin cuestionario").parentElement!;
    const filas = [...fila.parentElement!.children].map((e) => e.textContent);
    expect(filas).toEqual(["Alto0", "Limitado0", "Mínimo0", "Declarado, sin cuestionario2", "Sin clasificar0"]);
    expect(screen.getByText(/Nivel declarado en ficha, sin cuestionario/)).toBeTruthy();
    // El KPI de alto riesgo se pinta neutro: su «2» es el nivel declarado, no uno medido.
    expect(valorKpiAltos().className).toContain("text-[var(--g-text-secondary)]");
    expect(valorKpiAltos().className).not.toContain("--status-error");
    modo = "vacio";
  });

  it("control positivo: con cuestionario, dos de alto riesgo sin acreditar van en rojo", async () => {
    modo = "guiados";
    const { default: Pagina } = await import("@/pages/ai-governance/Dashboard");
    render(createElement(MemoryRouter, null, createElement(Pagina)));
    expect(valorKpiAltos().textContent).toBe("2");
    expect(valorKpiAltos().className).toContain("--status-error");
    modo = "vacio";
  });
});
