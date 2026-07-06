import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mutations = readFileSync(
  join(process.cwd(), "src/hooks/useCondicionesPersonaMutations.ts"),
  "utf8",
);

const designarStepper = readFileSync(
  join(process.cwd(), "src/pages/secretaria/DesignarAdminStepper.tsx"),
  "utf8",
);

const personasCanonicalHook = readFileSync(
  join(process.cwd(), "src/hooks/usePersonasCanonical.ts"),
  "utf8",
);

const notificationsHook = readFileSync(
  join(process.cwd(), "src/hooks/useNotifications.ts"),
  "utf8",
);

const representantesHook = readFileSync(
  join(process.cwd(), "src/hooks/useRepresentantesAdminPJ.ts"),
  "utf8",
);

const personaDetalle = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonaDetalle.tsx"),
  "utf8",
);

const representanteAdminStepper = readFileSync(
  join(process.cwd(), "src/pages/secretaria/RepresentanteAdminPJStepper.tsx"),
  "utf8",
);

const personaNueva = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonaNuevaStepper.tsx"),
  "utf8",
);

const personasList = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonasList.tsx"),
  "utf8",
);

const personasImport = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonasImportStepper.tsx"),
  "utf8",
);

const rmStatusChip = readFileSync(
  join(process.cwd(), "src/components/secretaria/RmStatusChip.tsx"),
  "utf8",
);

const secretariaDashboard = readFileSync(
  join(process.cwd(), "src/pages/secretaria/Dashboard.tsx"),
  "utf8",
);

describe("Personas/Cargos Sprint 2 UI contracts", () => {
  it("routes cargo alta through fn_designar_cargo instead of direct condiciones_persona insert", () => {
    expect(mutations).toMatch(/supabase\.rpc\("fn_designar_cargo"/);
    expect(mutations).toMatch(/supabase\.rpc\("fn_cesar_cargo"/);
    expect(mutations).toMatch(/p_cesar_singleton_previo:\s*true/);
    expect(mutations).toMatch(/p_representative_person_id:\s*input\.representative_person_id \?\? null/);
    expect(mutations).toMatch(/p_idempotency_key:\s*\[/);

    const asignarCargoBlock = mutations.match(
      /export function useAsignarCargo\(\)[\s\S]*?export interface CesarCargoInput/,
    )?.[0];
    expect(asignarCargoBlock).toBeTruthy();
    expect(asignarCargoBlock).not.toMatch(/\.from\("condiciones_persona"\)\s*[\s\S]*?\.insert\(/);

    const cesarCargoBlock = mutations.match(
      /export function useCesarCargo\(\)[\s\S]*?$/m,
    )?.[0];
    expect(cesarCargoBlock).toBeTruthy();
    expect(cesarCargoBlock).not.toMatch(/\.from\("condiciones_persona"\)\s*[\s\S]*?\.update\(/);
  });

  it("prevents stale preselected persona from validating a different draft person", () => {
    expect(designarStepper).toMatch(/draft\.person_id !== personIdFromUrl/);
    expect(designarStepper).toMatch(/guardar\(\) persona mismatch between URL and draft/);
    expect(designarStepper).toMatch(/personaPreselected\?\.id === draft\.person_id/);
    expect(designarStepper).toMatch(/personaSeleccionada\?\.id === draft\.person_id/);
    expect(designarStepper).not.toMatch(/const personaFinal = personaPreselected \?\? personaSeleccionada/);
  });

  it("preserves sociedad scope and refuses silent cargo submit without entity", () => {
    const guardarBlock = designarStepper.match(/async function guardar\(\)[\s\S]*?^\s*}\n\n\s{2}\/\/ Sólo bloqueamos/m)?.[0];
    expect(guardarBlock).toBeTruthy();
    expect(personaDetalle).toMatch(/useSecretariaScope/);
    expect(personaDetalle).toMatch(/createScopedTo\(`\/secretaria\/cargos\/nuevo\?personId=\$\{p\.id\}`\)/);
    expect(designarStepper).toMatch(/setEntityId\(entityIdFromUrl\)/);
    expect(guardarBlock).toMatch(/Selecciona una sociedad antes de designar el cargo/);
    expect(guardarBlock).not.toMatch(/if \(!entityId\) return;/);
  });

  it("deprecates persons.representative_person_id as UI write/read source", () => {
    expect(representantesHook).toMatch(/fuente canónica es `representaciones`/);
    expect(representantesHook).toMatch(/supabase\.rpc\("fn_upsert_representante_admin_pj"/);
    expect(representantesHook).not.toMatch(/\.from\("persons"\)\s*[\s\S]*?representative_person_id/);
    expect(designarStepper).toMatch(/No hacemos dual-write ni segundo upsert cliente/);
    expect(personaDetalle).toMatch(/representantesByEntity/);
    expect(personaDetalle).not.toMatch(/p\.representative\?\.full_name/);
    expect(personaNueva).not.toMatch(/payload\.representative_person_id/);
  });

  it("renders authority RM status chips with Garrigues status tokens", () => {
    expect(personaDetalle).toMatch(/RmStatusChip/);
    expect(rmStatusChip).toMatch(/Inscrito/);
    // UX-0.E (informe legal §7.1): el chip usa el término aprobado
    // "Pendiente de referencia registral" en vez de "Pendiente RM". El aviso §6.7
    // ("Puede limitar certificaciones frente a terceros") se surfacea como elemento
    // visible en la sección de autoridad (UX-6.A), no como tooltip title del chip.
    expect(rmStatusChip).toMatch(/Pendiente de referencia registral/);
    expect(rmStatusChip).not.toMatch(/Pendiente RM/);
    expect(rmStatusChip).toMatch(/bg-\[var\(--status-success\)\]/);
    expect(rmStatusChip).toMatch(/bg-\[var\(--status-warning\)\]/);
  });

  it("supports post-alta persona editing with mutation and accessible modal", () => {
    expect(personasCanonicalHook).toMatch(/export function useUpdatePersona/);
    expect(personasCanonicalHook).toMatch(/supabase\.rpc\("fn_update_persona"/);
    expect(personasCanonicalHook).not.toMatch(/\.from\("persons"\)\s*[\s\S]*?\.update\(/);
    expect(personaDetalle).toMatch(/Editar datos/);
    expect(personaDetalle).toMatch(/role="dialog"/);
    expect(personaDetalle).toMatch(/aria-modal="true"/);
    expect(personaDetalle).toMatch(/useUpdatePersona/);
    expect(personaDetalle).toMatch(/forwardRef/);
  });

  it("uses server-side searchable persona selectors instead of relying on a 2000-row cap", () => {
    expect(personasCanonicalHook).toMatch(/limit\?: number/);
    expect(designarStepper).toMatch(/personaSearch/);
    expect(designarStepper).toMatch(/setPersonaSearch/);
    expect(designarStepper).toMatch(/personaSeleccionadaSnapshot/);
    expect(designarStepper).toMatch(/representanteSeleccionadoSnapshot/);
    expect(designarStepper).toMatch(/representantePreselected\?\.id === draft\.representative_person_id/);
    expect(designarStepper).toMatch(/representanteSearch/);
    expect(designarStepper).toMatch(/person_type:\s*"PF"/);
    expect(designarStepper).toMatch(/limit:\s*personaSearch\.trim\(\) \? 50 : 200/);
    expect(representanteAdminStepper).toMatch(/representativeSearch/);
    expect(representanteAdminStepper).toMatch(/setRepresentativeSearch/);
    expect(representanteAdminStepper).toMatch(/search:\s*representativeSearch/);
    expect(representanteAdminStepper).toMatch(/limit:\s*representativeSearch\.trim\(\) \? 50 : 200/);
    expect(representanteAdminStepper).toMatch(/representanteSeleccionadoSnapshot/);
  });

  it("paginates PersonasList instead of rendering every row at once", () => {
    expect(personasList).toMatch(/const PAGE_SIZE = 25/);
    expect(personasCanonicalHook).toMatch(/usePersonasEnriquecidasPage/);
    expect(personasCanonicalHook).toMatch(/select\("\*", \{ count: "exact" \}\)/);
    expect(personasCanonicalHook).toMatch(/\.range\(from, to\)/);
    expect(personasList).toMatch(/pageRows/);
    expect(personasList).toMatch(/Mostrando/);
    expect(personasList).toMatch(/Página \{currentPage\} de \{totalPages\}/);
  });

  it("adds CSV and Excel import with dry-run plus RPC apply", () => {
    expect(personasImport).toMatch(/await import\("xlsx"\)/);
    expect(personasImport).not.toMatch(/import \* as XLSX from "xlsx"/);
    expect(personasImport).toMatch(/parseFile/);
    expect(personasImport).toMatch(/existingTaxIds/);
    expect(personasImport).toMatch(/useImportPersonaRow/);
    expect(personasImport).toMatch(/useAsignarCargo/);
    expect(personasCanonicalHook).toMatch(/fn_import_persona_row/);
  });

  it("wires L13-B presidential vacancy scan as non-blocking dashboard notification job", () => {
    const scanBlock = notificationsHook.match(
      /export function useAutoScanVacanciasPresidencia\(\)[\s\S]*?^}/m,
    )?.[0];
    expect(scanBlock).toBeTruthy();
    expect(notificationsHook).toMatch(/useAutoScanVacanciasPresidencia/);
    expect(notificationsHook).toMatch(/supabase\.rpc\("fn_scan_vacancias_presidencia"/);
    expect(notificationsHook).toMatch(/retry:\s*false/);
    expect(notificationsHook).toMatch(/Vacancia presidencial scan skipped/);
    expect(scanBlock).toMatch(/queryKey:\s*\["vacancia-presidencia-scan", tenantId\]/);
    expect(scanBlock).toMatch(/queryKey:\s*\["notifications", "all"\], exact:\s*true/);
    expect(scanBlock).not.toMatch(/queryKey:\s*\["notifications"\]\s*\}/);
    expect(secretariaDashboard).toMatch(/useAutoScanVacanciasPresidencia\(\)/);
  });
});
