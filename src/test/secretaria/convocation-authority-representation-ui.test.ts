import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateAnnualAccountsTimeliness,
  hasAnnualAccountsRegularizationCondition,
} from "@/lib/secretaria/convocation-agenda-gates";

const stepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriasStepper.tsx"),
  "utf8",
);
const detail = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriaDetalle.tsx"),
  "utf8",
);
const hook = readFileSync(
  resolve(process.cwd(), "src/hooks/useConvocatorias.ts"),
  "utf8",
);
const communicationHook = readFileSync(
  resolve(process.cwd(), "src/hooks/useCommunication.ts"),
  "utf8",
);
const meetingHook = readFileSync(
  resolve(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
  "utf8",
);
const delegationHook = readFileSync(
  resolve(process.cwd(), "src/hooks/useDelegations.ts"),
  "utf8",
);

describe("convocatoria — autoridad y representación autoritativas", () => {
  it("no ofrece rutas excepcionales de convocatoria sin expediente probatorio", () => {
    expect(stepper).toContain('convocanteAuthority?.cargo === "PRESIDENTE"');
    expect(stepper).toContain("art. 246.1 LSC");
    expect(stepper).toContain("la ruta excepcional del art. 246.2 no se simula");
    expect(stepper).not.toContain('cargo_convocante: convocanteMandate');
  });

  it("captura filial y el registro representativo como identificadores estructurados", () => {
    expect(hook).toContain("target_entity_id?: string | null");
    expect(hook).toContain("representative_person_id?: string | null");
    expect(hook).toContain("representation_delegation_id?: string | null");
    expect(stepper).toContain("Datos autoritativos de la representación");
    expect(stepper).toContain("Filial participada al 100 %");
    expect(stepper).toContain("Registro de representante para validación");
    expect(stepper).toContain("ninguno acredita por sí solo poder vigente o suficiente");
    expect(stepper).toContain("representationAgendaReady");
  });

  it("solo envía claims mínimos y deja que el servidor derive la evidencia", () => {
    expect(stepper).toContain("target_entity_id:");
    expect(stepper).toContain("representative_person_id:");
    expect(stepper).toContain("representation_delegation_id:");
    expect(stepper).not.toMatch(/representation_authority_route:\s*representation_authority_route/);
    expect(delegationHook).toContain('"fn_shareholder_representation_candidates"');
    expect(stepper).toContain("candidate.delegation_id === item.representation_delegation_id");
  });

  it("emite por RPC sin claims de estado, tenant o fecha de emisión", () => {
    expect(hook).toContain('.rpc("fn_emit_convocatoria"');
    const mutation = hook.match(/mutationFn:[\s\S]*?onSuccess:/)?.[0] ?? "";
    expect(mutation).not.toContain('.from("convocatorias")');
    expect(mutation).not.toContain("fecha_emision:");
    expect(mutation).not.toContain('estado: "EMITIDA"');
    expect(mutation).not.toContain("tenant_id:");
  });

  it("el detalle usa la evidencia fijada al emitir y no recalcula el presidente actual", () => {
    expect(detail).toContain("useAuthorityEvidenceById");
    expect(detail).toContain("conv?.convocante_authority_evidence_id");
    expect(detail).not.toContain("usePresidenteVigente");
    expect(detail).toContain("useConvocationManifest");
    expect(detail).toContain("Sandbox; entrega real bloqueada");
    expect(detail).toContain("La necesidad jurídica de firma no se afirma");
    expect(detail).toContain("no se afirma que el Presidente haya actuado, consentido, emitido o firmado");
    expect(detail).toContain("SHA-512 del acto DEMO");
  });

  it("presenta el paso final como registro DEMO y gobierna cancelación/rectificación", () => {
    expect(stepper).toContain('label: "Revisión y registro"');
    expect(stepper).toContain("Registrar simulación DEMO");
    expect(stepper).toContain("Simulación DEMO registrada");
    expect(stepper).not.toContain('label: "Revisión y emisión"');
    expect(detail).toContain("useTransitionConvocatoriaLifecycle");
    expect(detail).toContain("Marcar rectificación");
    expect(detail).toContain("Cancelar registro DEMO");
    expect(detail).toContain("el original y su historial permanecen íntegros");
    expect(detail).not.toContain("window.prompt");
    expect(detail).toContain("<AlertDialog");
    expect(detail).not.toContain("<AlertDialogAction");
    expect(detail).toContain("minLength={10}");
    expect(detail).toContain("aria-invalid={Boolean(lifecycleReasonError)}");
    expect(detail).toContain("Confirmar rectificación");
    expect(hook).toContain(
      '["communications", tenantId, "convocatoria", convocatoria.id]',
    );
    expect(hook).toContain(
      '["secretaria", tenantId, "meetings"]',
    );
    expect(communicationHook).not.toContain(".neq('estado', 'CANCELADA')");
    expect(detail).toContain("useReunionById");
    expect(detail).toContain(
      "const effectiveMeeting = scheduledMeeting ?? lifecycleMeeting ?? null",
    );
    expect(detail).toContain("Comunicación sandbox cancelada por la rectificación");
    const agendaBindingLookup = meetingHook.indexOf(
      '.eq("source_convocatoria_id", convocatoriaId)',
    );
    const legacyScan = meetingHook.indexOf(".limit(200)", agendaBindingLookup);
    expect(agendaBindingLookup).toBeGreaterThan(0);
    expect(legacyScan).toBeGreaterThan(agendaBindingLookup);
  });

  it("retira la materia legacy de representante de las opciones y bloquea su emisión", () => {
    expect(stepper).toContain('materia.value !== "NOMBRAMIENTO_REPRESENTANTE_FILIAL"');
    expect(stepper).toContain("La materia legacy de representante en filial no está disponible");
    expect(stepper).toContain(
      'kind === "DECISORIO" && rawMateria === "NOMBRAMIENTO_REPRESENTANTE_FILIAL"',
    );
    expect(stepper).toContain('? "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL"');
  });

  it("no reutiliza el nodo de avanzar como acción de registro", () => {
    expect(stepper).toContain('key="register-convocation"');
    expect(stepper).toContain('key="advance-step"');
    expect(stepper).toContain("Selecciona el órgano convocante antes de registrar");
    expect(stepper).toContain("Indica la fecha de la reunión antes de registrar");
  });

  it("genera una propuesta coherente y separa EAD del título y la firma", () => {
    expect(stepper).toContain("buildSoleShareholderRepresentativeProposal");
    expect(stepper).toContain("hasSoleShareholderRepresentativeConditions");
    expect(stepper).toContain("poder general en documento público (art. 183.1 LSC)");
    expect(stepper).toContain("ausencia de administrador persona jurídica");
    expect(stepper).toContain("Generar propuesta condicionada a validación");
  });

  it("bloquea la formulación extemporánea sin condición expresa de regularización", () => {
    expect(stepper).toContain("evaluateAnnualAccountsTimeliness");
    expect(stepper).toContain("annualAccountsAgendaReady");
    expect(stepper).toContain("Alerta de formulación extemporánea");
    expect(stepper).toContain("art. 253.1 LSC");
    expect(stepper).toContain("Regularización de cuentas pendiente — Paso 3");
  });

  it("alinea el gate cliente con los tres conceptos exigidos por el servidor", () => {
    expect(hasAnnualAccountsRegularizationCondition(
      "Regularización fuera de plazo conforme al artículo 253 LSC.",
    )).toBe(false);
    const proposal =
      "Formulación extemporánea como regularización, sin convalidar el incumplimiento anterior.";
    expect(hasAnnualAccountsRegularizationCondition(proposal)).toBe(true);
    expect(evaluateAnnualAccountsTimeliness({
      title: "Formulación de las cuentas anuales del ejercicio 2025",
      proposal,
      sessionDate: "2026-08-09",
    }).blocking).toBe(false);
    expect(evaluateAnnualAccountsTimeliness({
      title: "Cuentas 2025 y 2024",
      proposal,
      sessionDate: "2026-08-09",
    }).blocking).toBe(true);
    expect(evaluateAnnualAccountsTimeliness({
      title: "Formulación de las cuentas anuales del ejercicio 2026",
      proposal,
      sessionDate: "2026-08-09",
    }).blocking).toBe(true);
  });
});
