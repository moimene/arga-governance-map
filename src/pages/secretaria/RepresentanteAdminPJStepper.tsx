// src/pages/secretaria/RepresentanteAdminPJStepper.tsx
/**
 * D5.3 — Wizard 3 pasos para designar el representante PF de una PJ
 * administradora.
 *
 * Legal:
 *   L2 (LSC art. 212 bis + RRM art. 143): la PJ administradora debe
 *       designar persona natural para ejercer el cargo de forma
 *       permanente. Sin representante, la PJ no puede actuar.
 *   L22 (RRM art. 109): la referencia de inscripcion en el RM es
 *       opcional aqui pero recomendada — sin ella el representante no
 *       podra figurar como certificante a efectos registrales.
 *
 * Pasos:
 *   0. Sociedad — donde la PJ tiene cargo admin VIGENTE que requiere rep.
 *   1. Representante PF — selector de persona fisica existente.
 *   2. Referencia RM — opcional pero recomendada.
 *
 * Datos:
 *   - usePersonaCanonical(id) carga la PJ (debe ser person_type='PJ').
 *   - useCargosPersona(id) lista todos los cargos vigentes de la PJ. Se
 *     filtran por `requiresRepresentative` (L2) para mostrar solo las
 *     sociedades en las que la PJ actua como administrador.
 *   - usePersonasCanonical({ person_type: 'PF' }) lista las PF que se
 *     pueden designar como representante.
 *   - useUpsertRepresentanteAdminPJ persiste: cierra la rep. VIGENTE
 *     previa (si la hay) y crea la nueva en `representaciones` scope
 *     ADMIN_PJ_REPRESENTANTE. `persons.representative_person_id` queda
 *     deprecado en Sprint 2.
 *
 * Garrigues UX:
 *   - Tokens `var(--g-*)` y `var(--status-*)` exclusivamente.
 *   - aria-busy en el boton de submit.
 *   - Sidebar/back via Link normal (no anidado).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  usePersonaCanonical,
  usePersonasCanonical,
  type PersonaRow,
} from "@/hooks/usePersonasCanonical";
import { useCargosPersona } from "@/hooks/useCargos";
import { useUpsertRepresentanteAdminPJ } from "@/hooks/useRepresentantesAdminPJ";
import {
  requiresRepresentative,
  type TipoCondicionCargo,
} from "@/lib/secretaria/cargo-validation";

const STEPS = ["Sociedad", "Representante PF", "Referencia RM"];

export default function RepresentanteAdminPJStepper() {
  const { id } = useParams<{ id: string }>(); // PJ person id
  const navigate = useNavigate();
  const { data: pj, isLoading: pjLoading } = usePersonaCanonical(id);
  const { data: cargosPersona } = useCargosPersona(id);
  const [representativeSearch, setRepresentativeSearch] = useState("");
  const { data: personasPF } = usePersonasCanonical({
    person_type: "PF",
    search: representativeSearch,
    excludeTestData: true,
    limit: representativeSearch.trim() ? 50 : 200,
  });

  // Sociedades en las que la PJ tiene cargo admin vigente que requiere
  // representante (L2). Solo aplica si la persona es PJ — la guarda visual
  // mas abajo neutraliza el flujo si llegamos con una PF.
  const sociedadesAplicables = (cargosPersona ?? []).filter((c) => {
    if (c.estado !== "VIGENTE") return false;
    if (!pj) return false;
    return requiresRepresentative(
      { person_type: pj.person_type as "PF" | "PJ" | null },
      c.tipo_condicion as TipoCondicionCargo,
    );
  });

  // Dedup por entity_id: la misma PJ puede tener varios cargos en la misma
  // sociedad (p. ej. ADMIN_MANCOMUNADO + CONSEJERO); el representante PF se
  // designa una sola vez por (PJ, entity).
  const sociedadesUnicas = Array.from(
    new Map(sociedadesAplicables.map((c) => [c.entity_id, c])).values(),
  );

  const [step, setStep] = useState(0);
  const [entityId, setEntityId] = useState<string>("");
  const [representativeId, setRepresentativeId] = useState<string>("");
  const [representanteSeleccionadoSnapshot, setRepresentanteSeleccionadoSnapshot] =
    useState<PersonaRow | null>(null);
  const { data: representativePreselected } = usePersonaCanonical(representativeId || undefined);
  const [rmRef, setRmRef] = useState("");
  const [rmFecha, setRmFecha] = useState("");
  const upsertMutation = useUpsertRepresentanteAdminPJ();

  useEffect(() => {
    if (!representativeId) {
      setRepresentanteSeleccionadoSnapshot(null);
      return;
    }
    const current =
      representativePreselected?.id === representativeId
        ? representativePreselected
        : (personasPF ?? []).find((p) => p.id === representativeId);
    if (current) setRepresentanteSeleccionadoSnapshot(current);
  }, [representativeId, representativePreselected, personasPF]);

  const representanteSeleccionado =
    representativePreselected?.id === representativeId
      ? representativePreselected
      : representanteSeleccionadoSnapshot?.id === representativeId
        ? representanteSeleccionadoSnapshot
        : (personasPF ?? []).find((p) => p.id === representativeId);

  // Guarda de entrada — id obligatorio.
  if (!id) {
    return (
      <div className="mx-auto max-w-[640px] p-6 text-sm text-[var(--g-text-secondary)]">
        Falta id de persona.
      </div>
    );
  }
  if (pjLoading || !pj) {
    return (
      <div className="mx-auto max-w-[640px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }
  if (pj.person_type !== "PJ") {
    return (
      <div className="mx-auto max-w-[640px] p-6 text-sm text-[var(--g-text-primary)]">
        Solo personas jurídicas pueden designar un representante permanente.{" "}
        <Link
          to={`/secretaria/personas/${id}`}
          className="text-[var(--g-brand-3308)] underline"
        >
          Volver
        </Link>
      </div>
    );
  }

  const canNext = (() => {
    if (step === 0) return !!entityId;
    if (step === 1) return !!representativeId;
    if (step === 2) return true; // ref RM opcional pero recomendada
    return false;
  })();

  async function guardar() {
    if (!entityId || !representativeId || !id) return;
    try {
      await upsertMutation.mutateAsync({
        represented_person_id: id,
        representative_person_id: representativeId,
        entity_id: entityId,
        effective_from: new Date().toISOString().slice(0, 10),
        inscripcion_rm_referencia: rmRef.trim() || null,
        inscripcion_rm_fecha: rmFecha || null,
      });
      toast.success("Representante PF designado correctamente");
      navigate(`/secretaria/personas/${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo designar representante: " + msg);
    }
  }

  const sociedadSeleccionada = sociedadesUnicas.find((c) => c.entity_id === entityId);

  return (
    <div className="mx-auto max-w-[820px] p-6">
      <div className="mb-4">
        <Link
          to={`/secretaria/personas/${id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> {pj.full_name}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <UserCheck className="h-3.5 w-3.5" />
          Secretaría · Representante PF de PJ administradora
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Designar representante permanente — {pj.full_name}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          LSC art. 212 bis: la PJ administradora debe designar persona natural para ejercer el cargo
          de forma permanente.
        </p>
      </div>

      <ol className="mb-6 flex items-center gap-2 text-xs">
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-full px-3 py-1 ${
                active
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : done
                    ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                    : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
              }`}
            >
              <span>
                {done ? <Check className="inline h-3 w-3" /> : i + 1}. {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {step === 0 && (
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Sociedad donde actúa como administrador *
              </span>
              {sociedadesUnicas.length === 0 ? (
                <p className="text-sm text-[var(--g-text-secondary)]">
                  Esta PJ no tiene cargos de administrador vigentes que requieran representante.
                </p>
              ) : (
                <select
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">— Seleccionar sociedad —</option>
                  {sociedadesUnicas.map((c) => (
                    <option key={c.entity_id} value={c.entity_id}>
                      {c.entity?.common_name ?? c.entity?.legal_name ?? c.entity_id}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-[11px] text-[var(--g-text-secondary)]">
                Si la sociedad no aparece, alta primero el cargo admin de la PJ desde la ficha de
                Sociedad.
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Buscar representante PF
              </span>
              <input
                value={representativeSearch}
                onChange={(e) => setRepresentativeSearch(e.target.value)}
                placeholder="Nombre, NIF o email"
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Representante PF *
              </span>
              <select
                value={representativeId}
                onChange={(e) => {
                  const nextRepresentativeId = e.target.value;
                  setRepresentativeId(nextRepresentativeId);
                  setRepresentanteSeleccionadoSnapshot(
                    (personasPF ?? []).find((p) => p.id === nextRepresentativeId) ?? null,
                  );
                }}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccionar PF existente —</option>
                {representanteSeleccionado &&
                  !(personasPF ?? []).some((p) => p.id === representanteSeleccionado.id) && (
                    <option value={representanteSeleccionado.id}>
                      {representanteSeleccionado.full_name}
                      {representanteSeleccionado.tax_id ? ` · ${representanteSeleccionado.tax_id}` : ""}
                    </option>
                  )}
                {(personasPF ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.tax_id ? ` · ${p.tax_id}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[var(--g-text-secondary)]">
                ¿No existe?{" "}
                <Link
                  to="/secretaria/personas/nueva"
                  className="text-[var(--g-brand-3308)] underline"
                >
                  Crear persona física nueva
                </Link>{" "}
                y vuelve aquí.
              </span>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Referencia inscripción RM (recomendada — habilita certificación)
              </span>
              <input
                type="text"
                value={rmRef}
                onChange={(e) => setRmRef(e.target.value)}
                placeholder="T 1234, F 56, H M-12345 Ins. 7"
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Fecha inscripción RM
              </span>
              <input
                type="date"
                value={rmFecha}
                onChange={(e) => setRmFecha(e.target.value)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
            <div
              className="md:col-span-2 bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Sin referencia RM el representante se considera designado pero no certificante a
              efectos registrales (LSC art. 214, declarativa). Se puede completar posteriormente.
            </div>
            <div className="md:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Resumen
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Field
                  label="Sociedad"
                  value={
                    sociedadSeleccionada?.entity?.common_name ??
                    sociedadSeleccionada?.entity?.legal_name ??
                    "—"
                  }
                />
                <Field
                  label="Representante PF"
                  value={representanteSeleccionado?.full_name ?? "—"}
                />
              </dl>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
            disabled={!canNext}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            onClick={guardar}
            disabled={upsertMutation.isPending || !entityId || !representativeId}
            aria-busy={upsertMutation.isPending}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {upsertMutation.isPending ? "Designando…" : "Designar representante"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--g-text-primary)]">{value}</dd>
    </div>
  );
}
