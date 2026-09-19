// src/test/aims/sistema-ficha-coherente.test.ts
//
// Carril A (2026-09-14): la ficha del sistema —cabecera, edición, clasificación
// y declaración— decide con las hojas de `@/lib/aims`, no por su cuenta.
//
// Se vigila la ARISTA (que el componente importe y llame la hoja) y, donde el
// componente es puro, el COMPORTAMIENTO renderizado con control positivo. Todo
// lo que es grep se mide sobre el fuente SIN COMENTARIOS.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
import { claseNivelRiesgo } from "@/lib/aims/vocabulario";
import { AESIA_RIA_REQUIREMENTS } from "@/lib/aims/catalog-aesia";
import TabEvaluaciones from "@/components/ai-governance/sistema/TabEvaluaciones";
import TabIncidentes from "@/components/ai-governance/sistema/TabIncidentes";
import DeclaracionConformidadModal from "@/components/ai-governance/DeclaracionConformidadModal";
import Expediente from "@/components/ai-governance/sistema/TabExpedienteTecnico";
import Vigilancia from "@/components/ai-governance/sistema/TabVigilancia";
import Versiones from "@/components/ai-governance/sistema/VersionesSistema";
import { conProveedoresReales } from "./_proveedores-reales";

const SISTEMA = "src/components/ai-governance/sistema";
const EDITAR = `${SISTEMA}/EditarSistemaModal.tsx`;
const CABECERA = `${SISTEMA}/CabeceraSistema.tsx`;
const PANEL = `${SISTEMA}/ClasificacionVigentePanel.tsx`;
const GUIADA = "src/components/ai-governance/clasificacion/ClasificacionGuiada.tsx";
const EXPEDIENTE = `${SISTEMA}/TabExpedienteTecnico.tsx`;
const EVALUACIONES = `${SISTEMA}/TabEvaluaciones.tsx`;
const VIGILANCIA = `${SISTEMA}/TabVigilancia.tsx`;
const VERSIONES = `${SISTEMA}/VersionesSistema.tsx`;
const MODAL = "src/components/ai-governance/DeclaracionConformidadModal.tsx";
const PAGINA = "src/pages/ai-governance/SistemaDetalle.tsx";

/** Todo fichero del perímetro que muestra un error de RPC al usuario. */
const CON_ERRORES_RPC = [EDITAR, PANEL, EXPEDIENTE, EVALUACIONES, VIGILANCIA, VERSIONES, `${SISTEMA}/TabIncidentes.tsx`];
const PERIMETRO = [...CON_ERRORES_RPC, CABECERA, GUIADA, MODAL, PAGINA];

const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));

const noop = () => undefined;
const base = { id: "11111111-1111-1111-1111-111111111111", tenant_id: "t", name: "S", system_type: null, risk_level: null, vendor: null, deployment_date: null, owner_id: null, status: "ACTIVO", description: null, use_case: null, created_at: "" };

describe("A1 — la edición ofrece el responsable y lo envía", () => {
  it("importa el mismo selector de personas que el alta y el payload lleva owner_id", () => {
    const src = fuente(EDITAR);
    expect(src).toContain('from "@/hooks/usePersonasCanonical"');
    expect(src).toContain('usePersonasCanonical({ person_type: "PF" })');
    expect(src).toContain("owner_id: ownerId || null");
  });
});

describe("A3 — el art. 47 lo decide la hoja también en la cabecera", () => {
  it("la cabecera importa vinculaArt47 y lo llama", () => {
    const src = fuente(CABECERA);
    expect(src).toContain('from "@/lib/aims/expediente-tecnico"');
    expect(src).toContain("vinculaArt47(system.regulatory_role, system.risk_level)");
  });

  // Review 2026-09-14 (h.1): «Sin clasificación guiada» es UN predicado —
  // tieneClasificacionGuiada— en el modal, la cabecera y el chip de nivel.
  it("modal y cabecera anteponen tieneClasificacionGuiada a vinculaArt47 (misma expresión)", () => {
    for (const f of [MODAL, CABECERA]) {
      expect(fuente(f), f).toMatch(/tieneClasificacionGuiada\(system\) \? vinculaArt47\(system\.regulatory_role, system\.risk_level\) : null|conCuestionario \? vinculaArt47\(system\.regulatory_role, system\.risk_level\) : null/);
    }
  });

  const proveedorAlto = { ...base, regulatory_role: "PROVEEDOR", risk_level: "Alto" };
  const html = (system: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(DeclaracionConformidadModal, { system: system as never, isOpen: true, onClose: noop }));

  it("proveedor de alto riesgo CON cuestionario → documento (control positivo)", () => {
    const out = html({ ...proveedorAlto, regulatory_profile: { cuestionario_id: "q1" } });
    expect(out).toContain("Descargar borrador");
    expect(out).not.toContain("Sin clasificación guiada");
  });

  it("mismo rol y nivel en ficha pero SIN cuestionario → «Sin clasificación guiada», sin documento", () => {
    const out = html(proveedorAlto);
    expect(out).toContain("Sin clasificación guiada");
    expect(out).not.toContain("Descargar borrador");
  });

  it("responsable del despliegue con cuestionario → «no le aplica», sin documento", () => {
    const out = html({ ...base, regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Limitado", regulatory_profile: { cuestionario_id: "q1" } });
    expect(out).toContain("no le aplica");
    expect(out).not.toContain("Sin clasificación guiada");
    expect(out).not.toContain("Descargar borrador");
  });
});

describe("A10 — tokens y a11y del modal de declaración", () => {
  it("sin colores Tailwind nativos; el diálogo es modal y lleva su título", () => {
    const src = fuente(MODAL);
    expect(src).not.toMatch(/bg-black|bg-white|bg-gray-|text-white|text-gray-/);
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-labelledby="art47-titulo"');
    expect(src).toContain('id="art47-titulo"');
  });
});

describe("A4 — sin cuestionario COMPLETED el nivel es un dato declarado, no una clasificación", () => {
  it("cabecera y panel deciden con tieneClasificacionGuiada, no con otra expresión", () => {
    for (const f of [CABECERA, PANEL]) {
      const src = fuente(f);
      expect(src, f).toContain("tieneClasificacionGuiada(system)");
    }
    expect(fuente(CABECERA)).toContain("nivel declarado en ficha, sin cuestionario");
  });

  it("el chip neutro sale de la hoja: claseNivelRiesgo(null) no tiñe (control discriminante)", () => {
    expect(fuente(CABECERA)).toContain("claseNivelRiesgo(conCuestionario ? system.risk_level : null)");
    expect(/status-(error|warning|success)/.test(claseNivelRiesgo(null))).toBe(false);
    expect(/status-error/.test(claseNivelRiesgo("Alto"))).toBe(true);
  });
});

describe("A5 — reclasificación: el modo viaja a la hoja y el borrador se conserva", () => {
  it("ClasificacionGuiada pasa el modo y el panel lo dice junto al borrador", () => {
    expect(fuente(GUIADA)).toContain("bloqueosParaConfirmar(respuestas, justificacion, tieneOwner, modo)");
    const panel = fuente(PANEL);
    expect(panel).toContain('modo="reclasificacion"');
    expect(panel).toContain("El borrador se conserva hasta que se confirme.");
  });
});

describe("A6 — un solo traductor de errores de RPC", () => {
  it("ningún fichero del perímetro declara su propio `mensaje` ni desenvuelve `.message` a mano", () => {
    for (const f of PERIMETRO) {
      const src = fuente(f);
      expect(/const mensaje\s*=/.test(src), `${f}: declara su propio helper de mensaje`).toBe(false);
      expect(/\.message \?\? String\(/.test(src), `${f}: desenvuelve el error a mano`).toBe(false);
    }
  });

  it("todos los que muestran errores importan errores-rpc y llaman a mensajeUsuario", () => {
    for (const f of CON_ERRORES_RPC) {
      const src = fuente(f);
      expect(src, f).toContain('from "@/lib/aims/errores-rpc"');
      expect(src, f).toContain("mensajeUsuario(");
    }
  });
});

describe("A7 — una evaluación medida contra otro catálogo se dice", () => {
  const conCuestionario = { ...base, regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Limitado", regulatory_profile: { cuestionario_id: "q1" } };
  const evaluacion = { id: "a1", system_id: base.id, framework: "EU_AI_ACT", score: 40, assessment_date: "2026-09-01", assessor_id: null, status: "CON_GAPS", notes: null, created_at: "", findings: [{ code: AESIA_RIA_REQUIREMENTS[0].measures[0].id, status: "Pendiente" }] };
  const html = (system: typeof conCuestionario | typeof base) =>
    renderToStaticMarkup(createElement(TabEvaluaciones, { system, assessments: [evaluacion], onNueva: noop, onAbrir: noop }));

  it("la arista: importa y llama a evaluadaContraOtroCatalogo con el catálogo del proveedor", () => {
    const src = fuente(EVALUACIONES);
    expect(src).toContain('from "@/lib/aims/perfil-aplicabilidad"');
    expect(src).toContain("evaluadaContraOtroCatalogo(ass.findings, system, AESIA_RIA_REQUIREMENTS)");
  });

  it("responsable del despliegue clasificado y evaluado contra el catálogo del proveedor → chip", () => {
    expect(html(conCuestionario)).toContain("Evaluada contra otro catálogo");
  });

  it("sin cuestionario (perfil NULL, ARGA) no se pinta nada", () => {
    expect(html(base)).not.toContain("Evaluada contra otro catálogo");
  });

  // Review 2026-09-14 (h.2): el chip neutro sale de la hoja, no de un literal
  // local que divergiría el día que cambie el de `vocabulario.ts`.
  it("el chip neutro es el de la hoja: sin CHIP_NEUTRO local", () => {
    const src = fuente(EVALUACIONES);
    expect(src).not.toMatch(/const CHIP_NEUTRO/);
    expect(src).toContain("${claseNivelRiesgo(null)}");
    expect(html(conCuestionario)).toContain(claseNivelRiesgo(null));
  });
});

describe("A8 — «no se pudo leer» no es «no hay»", () => {
  const error = new Error("PGRST301: permiso denegado");

  it("evaluaciones: con error no aparece el vacío; sin error, sí (control positivo)", () => {
    const props = { system: base, assessments: [], onNueva: noop, onAbrir: noop };
    const conError = renderToStaticMarkup(createElement(TabEvaluaciones, { ...props, error }));
    expect(conError).not.toContain("No hay autodiagnósticos registrados");
    expect(conError).toContain("No se pudo leer los autodiagnósticos (permiso denegado)");
    expect(renderToStaticMarkup(createElement(TabEvaluaciones, props))).toContain("No hay autodiagnósticos registrados");
  });

  it("incidentes: con error no aparece el vacío; sin error, sí (control positivo)", () => {
    const props = { incidents: [], onNuevo: noop, onAbrir: noop };
    const conError = renderToStaticMarkup(createElement(TabIncidentes, { ...props, error }));
    expect(conError).not.toContain("No se han registrado incidentes");
    expect(conError).toContain("No se pudo leer los incidentes (permiso denegado)");
    expect(renderToStaticMarkup(createElement(TabIncidentes, props))).toContain("No se han registrado incidentes");
  });

  it("la página lee el error de las cinco consultas y lo pasa a cada pestaña", () => {
    const src = fuente(PAGINA);
    for (const e of ["errAssessments", "errIncidents", "errSections", "errVersions", "errIndicators"]) {
      expect((src.match(new RegExp(`\\b${e}\\b`, "g")) ?? []).length, `${e} se lee pero no se pasa`).toBeGreaterThanOrEqual(2);
    }
  });

  // Review 2026-09-14 (h.6): también la consulta padre. Un fallo al leer el
  // sistema no es «Sistema no encontrado».
  it("la página distingue «no se pudo leer el sistema» de «no encontrado»", () => {
    const src = fuente(PAGINA);
    expect(src).toContain("error: errSystem");
    expect(src).toContain("No se pudo leer el sistema (${mensajeUsuario(errSystem)})");
    expect(src).toContain('"Sistema no encontrado"');
  });

  // Review 2026-09-14 (h.3): las tres pestañas con mutaciones se RENDERIZAN;
  // el grep del literal no cazaba `{errorSecciones ? (` → `{false ? (`.
  // 2026-09-19: con sus hooks y proveedores REALES, no con `mock.module` del
  // hook: un componente cargado durante ese mock se quedaba ligado a los dobles
  // después de restaurarlo, y rompía los tests de otros ficheros que lo usaban
  // de verdad. En render estático no corre ningún efecto ni ninguna mutación.
  describe("expediente, vigilancia y versiones: con error no aparece el vacío; sin error, sí", () => {
    const pintar = (tipo, props) => renderToStaticMarkup(conProveedoresReales(createElement(tipo, props)));

    it("expediente (secciones)", () => {
      const props = { systemId: base.id, rol: null, nivel: null, secciones: [], versiones: [], onClasificar: noop };
      const conError = pintar(Expediente, { ...props, errorSecciones: error });
      expect(conError).not.toContain("No se han generado secciones técnicas");
      expect(conError).not.toContain("Iniciar expediente técnico");
      expect(conError).toContain("No se pudo leer las secciones del expediente (permiso denegado)");
      const sinError = pintar(Expediente, props);
      expect(sinError).toContain("No se han generado secciones técnicas");
      expect(sinError).toContain("Iniciar expediente técnico");
    });

    it("vigilancia (indicadores)", () => {
      const props = { systemId: base.id, indicators: [] };
      const conError = pintar(Vigilancia, { ...props, error });
      expect(conError).not.toContain("No hay indicadores de monitorización");
      expect(conError).toContain("No se pudo leer los indicadores (permiso denegado)");
      expect(pintar(Vigilancia, props)).toContain("No hay indicadores de monitorización");
    });

    it("versiones", () => {
      const props = { systemId: base.id, versiones: [] };
      const conError = pintar(Versiones, { ...props, error });
      expect(conError).not.toContain("No hay versiones registradas");
      expect(conError).toContain("No se pudo leer las versiones (permiso denegado)");
      expect(pintar(Versiones, props)).toContain("No hay versiones registradas");
    });
  });
});

describe("A9 — el copy de ayuda no nombra tablas", () => {
  it("el expediente técnico dice «sin hash de integridad» y ningún nombre de tabla", () => {
    const src = fuente(EXPEDIENTE);
    expect(src).toContain("sin hash de integridad");
    expect(src).not.toMatch(/aims_technical_file_sections|aims_system_versions/);
  });
});
