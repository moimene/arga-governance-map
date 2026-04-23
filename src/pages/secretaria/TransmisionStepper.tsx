import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowRightLeft, Check, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSociedad } from "@/hooks/useSociedades";
import { useCapitalHoldings } from "@/hooks/useCapitalHoldings";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { useTenantContext } from "@/context/TenantContext";

interface Draft {
  source_holding_id: string;
  destino_person_id: string;
  numero_titulos: string;
  effective_from: string;
  motivo: string;
}

const STEPS = ["Origen", "Destino", "Confirmar"];

export default function TransmisionStepper() {
  const { id: entityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();

  const { data: sociedad } = useSociedad(entityId);
  const { data: holdings } = useCapitalHoldings(entityId);
  const { data: personas } = usePersonasCanonical({});

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    source_holding_id: "",
    destino_person_id: "",
    numero_titulos: "",
    effective_from: new Date().toISOString().slice(0, 10),
    motivo: "",
  });

  const sourceHolding = useMemo(() => {
    return (holdings ?? []).find((h) => h.id === draft.source_holding_id);
  }, [holdings, draft.source_holding_id]);

  const update = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = (() => {
    if (step === 0)
      return !!draft.source_holding_id && Number(draft.numero_titulos) > 0 &&
        (sourceHolding ? Number(draft.numero_titulos) <= (sourceHolding.numero_titulos ?? 0) : false);
    if (step === 1) return !!draft.destino_person_id && draft.destino_person_id !== sourceHolding?.holder_person_id;
    return true;
  })();

  async function guardar() {
    if (!entityId || !sourceHolding) return;
    setSaving(true);
    try {
      const titulosATransmitir = Number(draft.numero_titulos);
      const titulosOrigen = sourceHolding.numero_titulos ?? 0;
      const pctOrigen = sourceHolding.porcentaje_capital ?? 0;
      const pctATransmitir = titulosOrigen > 0 ? (pctOrigen * titulosATransmitir) / titulosOrigen : 0;
      const today = draft.effective_from;

      // 1) Cerrar la holding de origen (effective_to = today)
      const { error: closeErr } = await supabase
        .from("capital_holdings")
        .update({ effective_to: today })
        .eq("id", sourceHolding.id);
      if (closeErr) throw closeErr;

      // 2) Si queda remanente en el origen, crear nueva holding con (titulos - transmitidos)
      const remanente = titulosOrigen - titulosATransmitir;
      if (remanente > 0) {
        const { error: remErr } = await supabase.from("capital_holdings").insert({
          tenant_id: tenantId!,
          entity_id: entityId,
          holder_person_id: sourceHolding.holder_person_id,
          share_class_id: sourceHolding.share_class_id,
          numero_titulos: remanente,
          porcentaje_capital: pctOrigen - pctATransmitir,
          voting_rights: sourceHolding.voting_rights,
          is_treasury: sourceHolding.is_treasury,
          effective_from: today,
          effective_to: null,
        });
        if (remErr) throw remErr;
      }

      // 3) Crear holding de destino
      const { error: destErr } = await supabase.from("capital_holdings").insert({
        tenant_id: tenantId!,
        entity_id: entityId,
        holder_person_id: draft.destino_person_id,
        share_class_id: sourceHolding.share_class_id,
        numero_titulos: titulosATransmitir,
        porcentaje_capital: pctATransmitir,
        voting_rights: sourceHolding.voting_rights,
        is_treasury: false,
        effective_from: today,
        effective_to: null,
        metadata: { motivo: draft.motivo || "transmision_inter_vivos", origen_holding_id: sourceHolding.id },
      });
      if (destErr) throw destErr;

      toast.success("Transmisión registrada correctamente");
      navigate(`/secretaria/sociedades/${entityId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo registrar la transmisión: " + msg);
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
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Secretaría · Transmisión
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Transmisión de titularidad — {sociedad?.common_name ?? sociedad?.legal_name ?? "…"}
        </h1>
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
                Asiento de origen *
              </span>
              <select
                value={draft.source_holding_id}
                onChange={(e) => update("source_holding_id", e.target.value)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccionar —</option>
                {(holdings ?? []).filter((h) => !h.is_treasury).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.holder?.full_name ?? "?"} · {h.numero_titulos} títulos ({h.porcentaje_capital}%)
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Títulos a transmitir *"
              type="number"
              value={draft.numero_titulos}
              onChange={(v) => update("numero_titulos", v)}
              placeholder={sourceHolding ? `máx ${sourceHolding.numero_titulos}` : ""}
            />
            {sourceHolding && Number(draft.numero_titulos) > (sourceHolding.numero_titulos ?? 0) && (
              <div className="rounded-md bg-[var(--status-error)]/10 p-3 text-xs text-[var(--status-error)]">
                Excede los títulos disponibles ({sourceHolding.numero_titulos}).
              </div>
            )}
            <Input
              label="Fecha efectiva"
              type="date"
              value={draft.effective_from}
              onChange={(v) => update("effective_from", v)}
            />
            <Input
              label="Motivo"
              value={draft.motivo}
              onChange={(v) => update("motivo", v)}
              placeholder="Compraventa, donación, sucesión..."
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Persona adquirente *
              </span>
              <select
                value={draft.destino_person_id}
                onChange={(e) => update("destino_person_id", e.target.value)}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccionar —</option>
                {(personas ?? [])
                  .filter((p) => p.id !== sourceHolding?.holder_person_id)
                  .map((p) => (
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

        {step === 2 && sourceHolding && (
          <div>
            <p className="mb-4 text-sm text-[var(--g-text-primary)]">
              Esta operación cerrará la holding de origen y creará una nueva de destino. Si hay
              remanente, se creará una tercera holding con el saldo del transmitente.
            </p>
            <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Origen" value={sourceHolding.holder?.full_name ?? "—"} />
              <Field
                label="Destino"
                value={
                  (personas ?? []).find((p) => p.id === draft.destino_person_id)?.full_name ?? "—"
                }
              />
              <Field label="Títulos a transmitir" value={draft.numero_titulos} />
              <Field label="Títulos en origen" value={sourceHolding.numero_titulos} />
              <Field
                label="Remanente en origen"
                value={(sourceHolding.numero_titulos ?? 0) - Number(draft.numero_titulos)}
              />
              <Field label="Fecha efectiva" value={draft.effective_from} />
              <Field label="Motivo" value={draft.motivo || "—"} />
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
            {saving ? "Registrando…" : "Registrar transmisión"}
          </button>
        )}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
    </label>
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
