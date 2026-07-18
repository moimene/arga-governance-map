import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("Gobierno de plantillas — contrato de accesibilidad transversal", () => {
  it("mantiene targets táctiles y foco Garrigues en las pestañas de escritura", () => {
    const wizard = read("src/components/secretaria/gestor/TemplateImportWizard.tsx");
    const validacion = read("src/components/secretaria/gestor/ValidacionTab.tsx");
    const configuracion = read("src/components/secretaria/gestor/ConfiguracionSociedadTab.tsx");
    const overrides = read("src/components/secretaria/gestor/Capa3OverridesPanel.tsx");

    expect((wizard.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect((wizard.match(/focus-visible:ring-2/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(validacion).toContain("flex min-h-11 items-center");
    expect(validacion).toContain("focus-visible:ring-2");
    expect(configuracion).toContain('"min-h-11 border');
    expect(configuracion).toContain("inline-flex min-h-11");
    expect(overrides).toContain('"min-h-11 border');
    expect(overrides).toContain('"inline-flex min-h-11');
  });

  it("nombra las regiones con scroll y les da foco visible", () => {
    const metricas = read("src/components/secretaria/gestor/MetricasTab.tsx");
    const auditoria = read("src/components/secretaria/gestor/AuditoriaTab.tsx");
    const validacion = read("src/components/secretaria/gestor/ValidacionTab.tsx");

    expect(metricas).toContain('aria-label="Detalle de indicadores por plantilla"');
    expect(auditoria).toContain('aria-label="Plantillas sin trazabilidad de cambios"');
    expect(auditoria).toContain('aria-label="Entradas del historial de cambios de plantillas"');
    expect(auditoria).toContain('aria-label="Ajustes de Capa 3 activos por sociedad"');
    expect(validacion).toContain(
      'aria-label="Resultado detallado de la comprobación documental"',
    );
    for (const source of [metricas, auditoria, validacion]) {
      expect(source).toContain("tabIndex={0}");
      expect(source).toContain("focus-visible:ring-2");
    }
  });

  it("traduce la semántica de versiones del changelog sin perder el código técnico", () => {
    const auditoria = read("src/components/secretaria/gestor/AuditoriaTab.tsx");

    expect(auditoria).toContain("Tipo de cambio");
    expect(auditoria).toContain("Versión anterior → nueva");
    expect(auditoria).toContain("Corrección (PATCH)");
    expect(auditoria).toContain("Evolución menor (MINOR)");
    expect(auditoria).toContain("Cambio mayor (MAJOR)");
    expect(auditoria).not.toContain('<option value="PATCH">PATCH</option>');
  });

  it("expone exportaciones de auditoría honestas, accesibles y basadas en las filas cargadas", () => {
    const auditoria = read("src/components/secretaria/gestor/AuditoriaTab.tsx");

    expect(auditoria).toContain("Exportar historial de cambios filtrado");
    expect(auditoria).toContain("Exportar plantillas sin historial");
    expect(auditoria).toContain("CSV de trabajo; el historial disponible es incompleto.");
    expect(auditoria).toContain("hasta 200 entradas recientes ya cargadas");
    expect(auditoria).toContain("buildChangelogCsvRows(filteredChangelog)");
    expect(auditoria).toContain("buildOrphanCsvRows(rows)");
    expect(auditoria).toContain("filterChangelogRows(changelogRows");
    expect(auditoria).toContain('role={changelogExportFailed ? "alert" : "status"}');
    expect(auditoria).toContain('role={orphanExportFailed ? "alert" : "status"}');
    expect(auditoria).toContain('aria-atomic="true"');
    expect(auditoria).toContain("No se pudo cargar el historial de cambios. El recuento no está disponible");
    expect(auditoria).toContain("No se pudo comprobar la trazabilidad del historial de cambios");
    expect(auditoria).toContain("Reintentar comprobación");
    expect(auditoria).toContain("No se pudieron cargar los ajustes de Capa 3");
    expect(auditoria).toContain("Reintentar ajustes");
    expect(auditoria).toContain('aria-live="polite"');
    expect((auditoria.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(8);
    expect((auditoria.match(/focus-visible:ring-2/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});
