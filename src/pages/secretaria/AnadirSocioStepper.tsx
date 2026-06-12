import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { UserPlus, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  WizardInput as Input,
  WizardField as Field,
  WizardCheckbox as Checkbox,
} from "./_shared/WizardFields";
import { StepPills } from "./_shared/StepNav";
import { useSociedad } from "@/hooks/useSociedades";
import { useCapitalProfile, useShareClasses } from "@/hooks/useCapitalProfile";
import { useCapitalHoldings } from "@/hooks/useCapitalHoldings";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { useTenantContext } from "@/context/TenantContext";

interface Draft {
  holder_person_id: string;
  share_class_id: string;
  numero_titulos: string;
  porcentaje_capital: string;
  voting_rights: boolean;
  is_treasury: boolean;
  effective_from: string;
}

const STEPS = ["Persona", "Participación", "Confirmar"];

export default function AnadirSocioStepper() {
  const { id: entityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();

  const { data: sociedad } = useSociedad(entityId);
  const { data: capital } = useCapitalProfile(entityId);
  const { data: clases } = useShareClasses(entityId);
  const { data: holdings } = useCapitalHoldings(entityId);
  const { data: personas } = usePersonasCanonical({});

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    holder_person_id: "",
    share_class_id: "",
    numero_titulos: "",
    porcentaje_capital: "",
    voting_rights: true,
    is_treasury: false,
    effective_from: new Date().toISOString().slice(0, 10),
  });

  // G1.5: defaults — primera clase seleccionada automáticamente.
  // useEffect porque setDraft es side effect; useMemo no garantiza
  // ejecución única y React puede emitir warnings en dev.
  useEffect(() => {
    if (!draft.share_class_id && clases && clases.length > 0) {
      setDraft((d) => ({ ...d, share_class_id: clases[0].id }));
    }
  }, [clases, draft.share_class_id]);

  // auto-% sobre número total de títulos
  const totalTitulos = capital?.numero_titulos ?? 0;
  const suggestedPct = (() => {
    const n = Number(draft.numero_titulos);
    if (!totalTitulos || !n) return 0;
    return Math.round((n / totalTitulos) * 10000) / 100;
  })();

  const totalAsignado = useMemo(() => {
    if (!holdings) return 0;
    return holdings.reduce((acc, h) => acc + (h.numero_titulos ?? 0), 0);
  }, [holdings]);

  const pctAsignado = totalTitulos ? Math.round((totalAsignado / totalTitulos) * 10000) / 100 : 0;

  // ITEM-021: el libro de socios no puede superar el capital escriturado.
  // capital_holdings no tiene trigger de suma en Cloud, así que el guard vive
  // aquí (RPC con assert de suma queda como deuda anotada).
  const titulosRestantes = totalTitulos > 0 ? Math.max(totalTitulos - totalAsignado, 0) : null;
  const pctAcumuladoExistente = useMemo(
    () => (holdings ?? []).reduce((acc, h) => acc + (Number(h.porcentaje_capital) || 0), 0),
    [holdings]
  );
  const pctNuevo = Number(draft.porcentaje_capital) || suggestedPct;
  const sobreasignaTitulos =
    titulosRestantes !== null && Number(draft.numero_titulos) > titulosRestantes;
  const sobreasignaPct = pctAcumuladoExistente + pctNuevo > 100.001;
  const sobreasignacionError = sobreasignaTitulos
    ? `No quedan títulos suficientes: restan ${titulosRestantes} de ${totalTitulos} (asignados ${totalAsignado}).`
    : sobreasignaPct
      ? `El capital asignado superaría el 100%: ${pctAcumuladoExistente.toFixed(2)}% ya asignado + ${pctNuevo.toFixed(2)}% nuevo.`
      : null;

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === 0) return !!draft.holder_person_id;
    if (step === 1)
      return !!draft.share_class_id && Number(draft.numero_titulos) > 0 && !sobreasignacionError;
    return true;
  })();

  async function guardar() {
    if (!entityId) return;
    // ITEM-021: re-chequeo en el momento de guardar (el censo puede haber
    // cambiado mientras el stepper estaba abierto).
    if (sobreasignacionError) {
      toast.error("No se puede guardar: " + sobreasignacionError);
      return;
    }
    setSaving(true);
    try {
      const pct = Number(draft.porcentaje_capital) || suggestedPct;
      const { error } = await supabase.from("capital_holdings").insert({
        tenant_id: tenantId!,
        entity_id: entityId,
        holder_person_id: draft.holder_person_id,
        share_class_id: draft.share_class_id,
        numero_titulos: Number(draft.numero_titulos),
        porcentaje_capital: pct,
        voting_rights: draft.voting_rights,
        is_treasury: draft.is_treasury,
        effective_from: draft.effective_from,
        effective_to: null,
      });
      if (error) throw error;
      toast.success("Socio añadido correctamente");
      navigate(`/secretaria/sociedades/${entityId}`);
    } catch (e) {
      // ITEM-092: traducir el error de constraint de duplicado (23505 sobre
      // ux_capital_holdings_vigente) a un mensaje accionable en vez del crudo
      // de Postgres.
      const code = (e as { code?: string } | null)?.code;
      const rawMsg = e instanceof Error ? e.message : String(e);
      const isDuplicate =
        code === "23505" || /ux_capital_holdings_vigente|duplicate key/i.test(rawMsg);
      toast.error(
        isDuplicate
          ? "Esta persona ya es titular vigente de esa clase de títulos."
          : "No se pudo añadir el socio",
        {
          description: isDuplicate
            ? "Usa Transmisión de participaciones para modificar su posición en lugar de un alta nueva."
            : rawMsg,
        },
      );
    } finally {
      setSaving(false);
    }
  }

  if (!entityId) {
    return <div className="mx-auto max-w-[960px] p-6 text-sm text-[var(--g-text-secondary)]">Falta id de sociedad.</div>;
  }

  return (
    <div className="mx-auto max-w-[960px] p-6">
      <div className="mb-4">
        <Link
          to={`/secretaria/sociedades/${entityId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> {sociedad?.common_name ?? "Sociedad"}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <UserPlus className="h-3.5 w-3.5" />
          Secretaría · Nuevo socio
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Añadir socio a {sociedad?.common_name ?? sociedad?.legal_name ?? "…"}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Capital total: {totalTitulos.toLocaleString("es-ES")} títulos · Asignado: {pctAsignado}% (resta {Math.max(0, 100 - pctAsignado)}%)
        </p>
      </div>

      <StepPills steps={STEPS.map((label, i) => ({ n: i, label }))} current={step} />{/* ITEM-125 */}

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {step === 0 && (
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Persona titular *
              </span>
              <select
                value={draft.holder_person_id}
                onChange={(e) => update("holder_person_id", e.target.value)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccionar —</option>
                {(personas ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.person_type ?? "?"}] {p.full_name}
                    {p.tax_id ? ` · ${p.tax_id}` : ""}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-[var(--g-text-secondary)]">
                ¿No existe?{" "}
                <Link to="/secretaria/personas/nueva" className="text-[var(--g-brand-3308)] underline">
                  Crear persona nueva
                </Link>
                .
              </span>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Clase de título *
              </span>
              <select
                value={draft.share_class_id}
                onChange={(e) => update("share_class_id", e.target.value)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {(clases ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_code} · {c.name} ({c.votes_per_title}v/t)
                  </option>
                ))}
              </select>
            </label>
            <Input
              label={
                titulosRestantes !== null
                  ? `Número de títulos * (restan ${titulosRestantes} de ${totalTitulos})`
                  : "Número de títulos *"
              }
              type="number"
              value={draft.numero_titulos}
              onChange={(v) => update("numero_titulos", v)}
              placeholder="100"
            />
            {sobreasignacionError ? (
              <div
                className="md:col-span-2 flex items-start gap-2 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-muted)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
                role="alert"
              >
                <p className="text-xs font-medium text-[var(--status-error)]">{sobreasignacionError}</p>
              </div>
            ) : null}
            <Input
              label={`% sobre capital (auto ≈ ${suggestedPct}%)`}
              type="number"
              value={draft.porcentaje_capital}
              onChange={(v) => update("porcentaje_capital", v)}
              placeholder={`${suggestedPct}`}
            />
            <Input
              label="Vigente desde"
              type="date"
              value={draft.effective_from}
              onChange={(v) => update("effective_from", v)}
            />
            <div className="md:col-span-2 flex flex-col gap-2">
              <Checkbox
                label="Con derecho de voto"
                value={draft.voting_rights}
                onChange={(v) => update("voting_rights", v)}
                help="Se computa en denominadores POLÍTICO y ECONÓMICO."
              />
              <Checkbox
                label="Autocartera"
                value={draft.is_treasury}
                onChange={(v) => update("is_treasury", v)}
                help="Si se marca, los títulos NO computan en denominadores (voting_weight=0)."
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-sm text-[var(--g-text-primary)]">
              Revisa la participación antes de crear el asiento en <code>capital_holdings</code>.
            </p>
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label="Titular"
                value={
                  (personas ?? []).find((p) => p.id === draft.holder_person_id)?.full_name ?? "—"
                }
              />
              <Field
                label="Clase"
                value={
                  (clases ?? []).find((c) => c.id === draft.share_class_id)?.class_code ?? "—"
                }
              />
              <Field label="Títulos" value={draft.numero_titulos} />
              <Field label="%" value={draft.porcentaje_capital || `${suggestedPct} (auto)`} />
              <Field label="Voto" value={draft.voting_rights ? "Sí" : "No"} />
              <Field label="Autocartera" value={draft.is_treasury ? "Sí" : "No"} />
              <Field label="Vigente desde" value={draft.effective_from} />
            </dl>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={step === 0}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
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
            disabled={saving}
            aria-busy={saving}
            className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {saving ? "Creando…" : "Añadir socio"}
          </button>
        )}
      </div>
    </div>
  );
}

// ITEM-125: Input/Field/Checkbox extraídos a ./_shared/WizardFields (importados arriba con alias).
