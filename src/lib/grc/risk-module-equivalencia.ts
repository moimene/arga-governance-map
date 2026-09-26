// ───────── Equivalencia de módulo para riesgos con `module_id` no declarado ─────────
//
// MOI-189, decisión D-10 (delegada): opción (b) — tabla de equivalencias EN EL
// CÓDIGO, sin tocar `risks.module_id` en la base de datos. ARGA no cambia de
// dato; sigue habiendo dos vocabularios (el legacy de los riesgos sembrados y
// el declarado en `grc_modules`), y esta tabla es el puente entre ambos para
// agrupar/filtrar en la UI. La opción (c) — reclasificar de verdad los 122
// riesgos — exige criterio de negocio y queda fuera de este cambio.
//
// Medido en vivo el 2026-09-26 contra `governance_OS` (SELECT, sin escritura):
// 122 de los 167 riesgos de ARGA (`tenant_id='…0001'`) usan un `module_id` que
// no existe en `grc_modules` de ese tenant. Once valores distintos:
//
//   solvency2 (25) · penal (18) · tech (14) · idd (10) · labor (10) ·
//   compliance (10) · reporting (7) · reputational (7) · fraud (7) ·
//   strategic (7) · governance (7)
//
// Garrigues (`…0002`): 0 riesgos con `module_id` no declarado — nada que
// mapear ahí.
//
// Cada entrada aquí es una decisión técnica del agente (autorizada por
// delegación en MOI-189), no un dictamen legal: agrupa por afinidad temática
// con el módulo declarado más próximo en `grc_modules`, o cae en el catch-all
// `risk` (Riesgos operacionales) cuando ARGA no tiene módulo propio para esa
// materia — el mismo patrón que ya usa el espejo de obligaciones
// (`CATCH_ALL_DECLARADO` en `src/test/schema/grc-sync-modulos.test.ts`) para
// Solvencia II. Un `module_id` que aparezca sin entrada aquí hace caer el test
// que vigila esta tabla: no se pierde en silencio.
export type EquivalenciaModulo = {
  /** `id` de un módulo YA declarado en `grc_modules` del tenant. */
  equivalente: string;
  /** Por qué se agrupa ahí, para quien audite la tabla. */
  motivo: string;
};

export const MODULO_RIESGO_EQUIVALENCIA: Record<string, EquivalenciaModulo> = {
  solvency2: {
    equivalente: "risk",
    motivo:
      "Solvencia II no tiene módulo propio en grc_modules (mismo motivo que OBL-ORSA-001/OBL-SII-001 en el espejo de obligaciones); cae en Riesgos operacionales.",
  },
  penal: {
    equivalente: "abc",
    motivo:
      "El módulo declarado para riesgo penal en el grupo de demostración (tenant …0001) es 'abc' (Anticorrupción); 'penal' es el nombre legacy con el que se sembraron 18 riesgos antes de declarar el módulo (DA-15, ledger 2026-09-05).",
  },
  tech: {
    equivalente: "cyber",
    motivo: "Riesgo tecnológico se agrupa con Ciberseguridad, el módulo declarado más próximo; no hay módulo de TI propio.",
  },
  idd: {
    equivalente: "risk",
    motivo:
      "La Directiva de Distribución de Seguros (IDD) no tiene módulo propio en grc_modules; cae en Riesgos operacionales como catch-all.",
  },
  labor: {
    equivalente: "hs",
    motivo: "Riesgo laboral se agrupa con SST y PRL, el módulo de personas más próximo; no hay módulo de derecho laboral propio.",
  },
  compliance: {
    equivalente: "audit",
    motivo: "Cumplimiento normativo genérico se agrupa con Auditoría interna, el módulo de control más próximo.",
  },
  reporting: {
    equivalente: "audit",
    motivo: "Riesgo de reporting/información financiera se agrupa con Auditoría interna.",
  },
  reputational: {
    equivalente: "risk",
    motivo: "Riesgo reputacional no tiene módulo propio en grc_modules; cae en Riesgos operacionales como catch-all.",
  },
  fraud: {
    equivalente: "abc",
    motivo: "Fraude se agrupa con Anticorrupción, el módulo de conducta indebida más próximo.",
  },
  strategic: {
    equivalente: "risk",
    motivo: "Riesgo estratégico no tiene módulo propio en grc_modules; cae en Riesgos operacionales como catch-all.",
  },
  governance: {
    equivalente: "risk",
    motivo: "Riesgo de gobierno corporativo no tiene módulo propio en grc_modules; cae en Riesgos operacionales como catch-all.",
  },
};

/**
 * El módulo declarado equivalente a un `module_id` legacy, o `null` si el
 * valor ya es un módulo declarado (no necesita equivalencia) o no está en la
 * tabla (caso que el test de esquema debe cazar, no esta función).
 */
export function moduloEquivalente(moduleId: string | null | undefined): string | null {
  if (!moduleId) return null;
  return MODULO_RIESGO_EQUIVALENCIA[moduleId]?.equivalente ?? null;
}
