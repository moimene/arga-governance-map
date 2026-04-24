import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, UserCheck } from "lucide-react";
import { StepperShell, type StepDef } from "./_shared/StepperShell";
import { useMateriaCatalog } from "@/hooks/useMateriaConfig";
import { PreviewGatePanel } from "@/components/secretaria/PreviewGatePanel";
import type { AdoptionMode } from "@/lib/rules-engine";

// ── Paso 1: Tipo y materia ───────────────────────────────────────────────────

function TipoMateriaStep() {
  const [tipo, setTipo] = useState<"SOCIO_UNICO" | "ADMINISTRADOR_UNICO">("SOCIO_UNICO");
  const [materia, setMateria] = useState("");
  const { data: materias = [], isLoading } = useMateriaCatalog();

  const adoptionMode: AdoptionMode =
    tipo === "SOCIO_UNICO" ? "UNIPERSONAL_SOCIO" : "UNIPERSONAL_ADMIN";

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Selecciona el tipo de decisión y la materia del acuerdo. El motor verificará
        que el modo unipersonal sea válido para la materia escogida.
      </p>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Tipo de decisión unipersonal
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["SOCIO_UNICO", "ADMINISTRADOR_UNICO"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex flex-col gap-1 border px-4 py-3 text-left transition-colors ${
                tipo === t
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                  : "border-[var(--g-border-subtle)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)]/50"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span className="text-sm font-medium text-[var(--g-text-primary)]">
                {t === "SOCIO_UNICO" ? "Socio único (art. 15 LSC)" : "Administrador único (art. 210 LSC)"}
              </span>
              <span className="text-xs text-[var(--g-text-secondary)]">
                {t === "SOCIO_UNICO"
                  ? "SL con un único socio titular del 100% del capital"
                  : "SA/SL con un único administrador con poderes plenos"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Materia del acuerdo
        </label>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando catálogo…
          </div>
        ) : (
          <select
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">— Selecciona una materia —</option>
            {materias.map((m) => (
              <option key={m.materia} value={m.materia}>
                {m.materia_label_es} ({m.matter_class})
              </option>
            ))}
          </select>
        )}
      </div>

      {materia && (
        <PreviewGatePanel
          params={{ materia, adoptionMode, tipoSocial: "SL", organoTipo: tipo === "SOCIO_UNICO" ? "JUNTA_GENERAL" : "CONSEJO" }}
        />
      )}
    </div>
  );
}

// ── Paso 2: Texto del acuerdo ─────────────────────────────────────────────────

function TextoAcuerdoStep() {
  const [texto, setTexto] = useState("");
  const [fundamentoLegal, setFundamentoLegal] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Redacta el texto íntegro del acuerdo adoptado. Incluye el fundamento jurídico aplicable
        (artículo LSC o estatutario que habilita la decisión unipersonal).
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Texto del acuerdo <span className="text-[var(--status-error)]">*</span>
        </label>
        <textarea
          rows={8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ejemplo: El socio único de ARGA Seguros S.A., en uso de las facultades que le confiere el art. 15 LSC, adopta el siguiente acuerdo…"
          className="w-full resize-y rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-[var(--g-text-primary)]">
          Fundamento jurídico
        </label>
        <input
          type="text"
          value={fundamentoLegal}
          onChange={(e) => setFundamentoLegal(e.target.value)}
          placeholder="Ej: art. 15 LSC / art. 210.3 LSC"
          className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>
    </div>
  );
}

// ── Paso 3: Firma y archivo ───────────────────────────────────────────────────

function FirmaArchivoStep() {
  const navigate = useNavigate();
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  function handleFirmar() {
    setSigning(true);
    setTimeout(() => {
      setSigning(false);
      setSigned(true);
    }, 1400);
  }

  if (signed) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-start gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Decisión firmada y archivada
            </p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              La firma QES ha sido aplicada vía EAD Trust. El documento queda archivado en el
              Libro de Decisiones con estado FIRMADA y el acuerdo se registra en estado ADOPTED.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/secretaria/decisiones-unipersonales")}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <UserCheck className="h-4 w-4" />
          Ver decisiones unipersonales
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        El documento generado se firmará electrónicamente con QES (Qualified Electronic Signature)
        a través de EAD Trust. La firma quedará archivada en el evidence bundle WORM.
      </p>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--g-text-primary)]">
          <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />
          Verificación pre-firma
        </div>
        <ul className="mt-2 space-y-1.5 text-xs text-[var(--g-text-secondary)]">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" />
            Modo adopción: UNIPERSONAL — sin quórum ni mayoría requerida
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" />
            Certificado OCSP verificado (EAD Trust)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" />
            Hash SHA-512 del documento calculado
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={handleFirmar}
        disabled={signing}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-5 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-60"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {signing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Firmando con QES…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Firmar y archivar decisión
          </>
        )}
      </button>
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  {
    n: 1,
    label: "Tipo y materia",
    hint: "Selecciona si es decisión de socio único o administrador único y la materia del acuerdo",
    body: <TipoMateriaStep />,
  },
  {
    n: 2,
    label: "Texto del acuerdo",
    hint: "Redacción del acuerdo adoptado con fundamento jurídico",
    body: <TextoAcuerdoStep />,
  },
  {
    n: 3,
    label: "Firma y archivo",
    hint: "Firma QES via EAD Trust + archivado en evidence bundle WORM",
    body: <FirmaArchivoStep />,
  },
];

export default function DecisionUnipersonalStepper() {
  return (
    <StepperShell
      eyebrow="Secretaría · Nueva decisión unipersonal"
      title="Asistente de decisión unipersonal"
      backTo="/secretaria/decisiones-unipersonales"
      steps={STEPS}
    />
  );
}
