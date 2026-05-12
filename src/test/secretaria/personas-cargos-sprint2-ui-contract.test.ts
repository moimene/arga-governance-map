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

const personaNueva = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonaNuevaStepper.tsx"),
  "utf8",
);

const personasList = readFileSync(
  join(process.cwd(), "src/pages/secretaria/PersonasList.tsx"),
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
    expect(personaDetalle).toMatch(/authorityStatus/);
    expect(personaDetalle).toMatch(/Inscrito/);
    expect(personaDetalle).toMatch(/Pendiente RM/);
    expect(personaDetalle).toMatch(/bg-\[var\(--status-success\)\]/);
    expect(personaDetalle).toMatch(/bg-\[var\(--status-warning\)\]/);
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
    expect(designarStepper).toMatch(/representanteSearch/);
    expect(designarStepper).toMatch(/person_type:\s*"PF"/);
    expect(designarStepper).toMatch(/limit:\s*personaSearch\.trim\(\) \? 50 : 200/);
  });

  it("paginates PersonasList instead of rendering every row at once", () => {
    expect(personasList).toMatch(/const PAGE_SIZE = 25/);
    expect(personasList).toMatch(/pageRows/);
    expect(personasList).toMatch(/Mostrando/);
    expect(personasList).toMatch(/Página \{currentPage\} de \{totalPages\}/);
  });

  it("wires L13-B presidential vacancy scan as non-blocking dashboard notification job", () => {
    expect(notificationsHook).toMatch(/useAutoScanVacanciasPresidencia/);
    expect(notificationsHook).toMatch(/supabase\.rpc\("fn_scan_vacancias_presidencia"/);
    expect(notificationsHook).toMatch(/retry:\s*false/);
    expect(notificationsHook).toMatch(/Vacancia presidencial scan skipped/);
    expect(secretariaDashboard).toMatch(/useAutoScanVacanciasPresidencia\(\)/);
  });
});
