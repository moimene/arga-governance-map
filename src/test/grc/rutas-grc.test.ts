// src/test/grc/rutas-grc.test.ts
//
// F5.T4 (MOI-175) — /grc/m/ai deja de ofrecer el ModuleShell genérico de GRC
// y redirige a /ai-governance/programa en los dos tenants. Mismo patrón que
// ya usa /aims -> /ai-governance (línea de referencia más abajo): un source
// scan de App.tsx, no un montaje completo de la app (que exigiría sesión de
// Supabase real y TenantProvider resuelto — ese camino ya lo cubren los e2e
// de producción). Precedente del mismo idioma en este repo:
// `src/test/secretaria/secretaria-demo-readiness-routes.test.ts`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

const APP_SRC = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");

describe("F5.T4 — /grc/m/ai redirige fuera del ModuleShell de GRC", () => {
  it("declara la ruta estática /grc/m/ai con un Navigate a /ai-governance/programa", () => {
    expect(APP_SRC).toContain('path="/grc/m/ai"');
    expect(APP_SRC).toMatch(/path="\/grc\/m\/ai"\s+element=\{<Navigate to="\/ai-governance\/programa" replace \/>\}/);
  });

  it("la ruta estática /grc/m/ai va ANTES de la paramétrica /grc/m/:moduleId (no depende solo del orden, pero así queda legible)", () => {
    const iEstatica = APP_SRC.indexOf('path="/grc/m/ai"');
    const iParametrica = APP_SRC.indexOf('path="/grc/m/:moduleId"');
    expect(iEstatica).toBeGreaterThan(-1);
    expect(iParametrica).toBeGreaterThan(-1);
    expect(iEstatica).toBeLessThan(iParametrica);
  });

  it("no monta RequireGrcModule/ModuleShell para /grc/m/ai: el guard y el shell son solo de la ruta paramétrica", () => {
    const lineaRedirect = APP_SRC.split("\n").find((l) => l.includes('path="/grc/m/ai"'));
    expect(lineaRedirect).toBeDefined();
    expect(lineaRedirect).not.toContain("RequireGrcModule");
    expect(lineaRedirect).not.toContain("ModuleShell");
  });

  it("/ai-governance/programa existe y no envuelve un branding distinto (mismo componente que el índice /ai-governance)", () => {
    expect(APP_SRC).toContain('path="/ai-governance/programa"');
    const lineaIndice = APP_SRC.split("\n").find((l) => /path="\/ai-governance"\s/.test(l));
    const lineaPrograma = APP_SRC.split("\n").find((l) => l.includes('path="/ai-governance/programa"'));
    expect(lineaIndice).toBeDefined();
    expect(lineaPrograma).toBeDefined();
    // Mismo componente lazy (AiDashboard) en las dos: la redirección no
    // estrena una pantalla ni un layout nuevo, solo cambia la URL.
    expect(lineaIndice).toContain("<AiDashboard />");
    expect(lineaPrograma).toContain("<AiDashboard />");
  });

  it("las dos rutas nuevas cuelgan del mismo <Route> protegido que el resto del shell (no están fuera de ProtectedShell)", () => {
    const iProtectedShell = APP_SRC.indexOf("<ProtectedShell");
    const iRedirect = APP_SRC.indexOf('path="/grc/m/ai"');
    const iPrograma = APP_SRC.indexOf('path="/ai-governance/programa"');
    expect(iProtectedShell).toBeGreaterThan(-1);
    expect(iProtectedShell).toBeLessThan(iRedirect);
    expect(iProtectedShell).toBeLessThan(iPrograma);
  });
});
