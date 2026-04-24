import { useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StepperShell, type StepDef } from "./_shared/StepperShell";
import { useAgreementsList, useAgreementById } from "@/hooks/useAgreementsList";
import { useRulePackForMateria } from "@/hooks/useRulePackForMateria";
import { useModelosAcuerdo } from "@/hooks/useModelosAcuerdo";

const STEPS: StepDef[] = [
  {
    n: 1,
    label: "Seleccionar acuerdo",
    hint: "El acuerdo debe estar en estado CERTIFIED o ADOPTED para tramitación",
  },
  {
    n: 2,
    label: "Vía de presentación",
    hint: "Análisis del instrumento requerido (escritura/instancia) según motor de reglas",
  },
  {
    n: 3,
    label: "Datos del instrumento",
    hint: "Notaría, fecha de escritura y datos registrales",
  },
  {
    n: 4,
    label: "Presentación",
    hint: "Envío a BORME, PSM, SIGER, JUCERJA o CONSERVATORIA según jurisdicción",
  },
  {
    n: 5,
    label: "Seguimiento",
    hint: "Monitorización de estado, subsanaciones y publicación",
  },
];

export default function TramitadorStepper() {
  const { data: agreements = [], isLoading: agreementsLoading } = useAgreementsList([
    "CERTIFIED",
    "ADOPTED",
  ]);

  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const { data: selectedAgreement } = useAgreementById(selectedAgreementId || undefined);

  const { data: rulePackData, isLoading: rulesLoading } = useRulePackForMateria(
    selectedAgreement?.agreement_kind
  );

  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null);

  const materia = selectedAgreement?.agreement_kind ?? "";
  const { data: modelos = [], isLoading: modelosLoading } = useModelosAcuerdo(materia);

  const [instrumentData, setInstrumentData] = useState({
    notary: "",
    deedDate: "",
    protocolNumber: "",
  });

  const [filingChannel, setFilingChannel] = useState<string>("");
  const [filingStatus, setFilingStatus] = useState<string>("DRAFT");

  // Step 1: Select agreement
  const step1Body = (
    <div className="space-y-4">
      {agreementsLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando acuerdos...
        </div>
      ) : agreements.length === 0 ? (
        <div
          className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "var(--g-surface-muted)",
          }}
        >
          <AlertTriangle className="h-4 w-4" />
          No hay acuerdos CERTIFIED o ADOPTED disponibles
        </div>
      ) : (
        <div className="space-y-2">
          {agreements.map((agreement) => (
            <button
              key={agreement.id}
              type="button"
              onClick={() => setSelectedAgreementId(agreement.id)}
              className={`w-full text-left flex items-center justify-between px-4 py-3 border transition-colors ${
                selectedAgreementId === agreement.id
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                  : "border-[var(--g-border-subtle)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)]/50"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div>
                <div className="text-sm font-medium text-[var(--g-text-primary)]">
                  {agreement.agreement_kind}
                </div>
                <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                  Clase: {agreement.matter_class} • Modo: {agreement.adoption_mode}
                </div>
              </div>
              <span
                className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                  agreement.status === "CERTIFIED"
                    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                    : "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]"
                }`}
              >
                {agreement.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Step 2: Inscription analysis
  const step2Body = selectedAgreement && rulePackData ? (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]"
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Análisis de inscribibilidad
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Inscribible:</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                rulePackData.payload.inscribible
                  ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                  : "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
              }`}
            >
              {rulePackData.payload.inscribible ? "Sí" : "No"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Instrumento requerido:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {rulePackData.payload.instrumentoRequerido}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Publicación requerida:</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                rulePackData.payload.publicacionRequerida
                  ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                  : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
              }`}
            >
              {rulePackData.payload.publicacionRequerida ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>

      {rulePackData.payload.plazoInscripcion && (
        <div
          className="px-4 py-2 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Plazo de inscripción: {rulePackData.payload.plazoInscripcion} días
        </div>
      )}

      {/* Modelo de acuerdo */}
      <div className="border border-[var(--g-border-subtle)] p-4 space-y-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">
          Modelo de acuerdo (referencia)
        </div>

        {modelosLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando modelos...
          </div>
        ) : modelos.length === 0 ? (
          <div className="text-xs text-[var(--g-text-secondary)] px-3 py-2 bg-[var(--g-surface-muted)]"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            No hay modelo de acuerdo disponible para esta materia en este momento.
          </div>
        ) : (
          <div className="space-y-2">
            {modelos.map((m) => (
              <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modelo_acuerdo"
                  value={m.id}
                  checked={selectedModeloId === m.id}
                  onChange={() => setSelectedModeloId(m.id)}
                  className="mt-0.5 accent-[var(--g-brand-3308)]"
                />
                <div className="flex-1">
                  <span className="text-sm text-[var(--g-text-primary)]">
                    {m.contenido_template ?? m.materia_acuerdo}
                  </span>
                  {m.referencia_legal && (
                    <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                      ({m.referencia_legal})
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedModeloId && (() => {
          const modelo = modelos.find((m) => m.id === selectedModeloId);
          return modelo?.capa1_inmutable ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--g-text-secondary)] uppercase tracking-wide">
                Texto del modelo
              </div>
              <textarea
                readOnly
                rows={6}
                value={modelo.capa1_inmutable}
                className="w-full px-3 py-2 text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] border border-[var(--g-border-subtle)] resize-none"
                style={{ borderRadius: "var(--g-radius-sm)", fontFamily: "monospace" }}
              />
              <p className="text-xs text-[var(--g-text-secondary)]">
                El texto puede ser editado en la pantalla de redacción del acuerdo.
              </p>
            </div>
          ) : null;
        })()}
      </div>

      {rulesLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando reglas...
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
      style={{
        borderRadius: "var(--g-radius-md)",
        background: "var(--g-surface-muted)",
      }}
    >
      <AlertTriangle className="h-4 w-4" />
      Seleccione un acuerdo en el paso anterior
    </div>
  );

  // Step 3: Instrument data (only if ESCRITURA or INSTANCIA)
  const showInstrumentForm =
    rulePackData && rulePackData.payload.instrumentoRequerido !== "NINGUNO";

  const step3Body = showInstrumentForm ? (
    <div className="space-y-4">
      {rulePackData?.payload.instrumentoRequerido === "ESCRITURA" && (
        <>
          <div>
            <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Notaría
            </label>
            <input
              type="text"
              placeholder="Ej: Notaría López García, Madrid"
              value={instrumentData.notary}
              onChange={(e) => setInstrumentData({ ...instrumentData, notary: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] placeholder-[var(--g-text-secondary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Fecha de escritura
            </label>
            <input
              type="date"
              value={instrumentData.deedDate}
              onChange={(e) => setInstrumentData({ ...instrumentData, deedDate: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Número de protocolo
            </label>
            <input
              type="text"
              placeholder="Ej: 2026/5432"
              value={instrumentData.protocolNumber}
              onChange={(e) =>
                setInstrumentData({ ...instrumentData, protocolNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] placeholder-[var(--g-text-secondary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </>
      )}

      {rulePackData?.payload.instrumentoRequerido === "INSTANCIA" && (
        <div
          className="px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "var(--g-surface-muted)",
          }}
        >
          Tramitación vía instancia notarial. Los datos se completarán en el paso siguiente.
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
      style={{
        borderRadius: "var(--g-radius-md)",
        background: "var(--g-surface-muted)",
      }}
    >
      <AlertTriangle className="h-4 w-4" />
      Este acuerdo no requiere instrumento especial (NINGUNO)
    </div>
  );

  // Step 4: Filing submission
  const step4Body = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
          Canal de presentación
        </label>
        <select
          value={filingChannel}
          onChange={(e) => setFilingChannel(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar canal</option>
          <option value="BORME">BORME (Boletín Oficial del Registro Mercantil)</option>
          <option value="PSM">PSM (Portal de Servicios del Ministerio)</option>
          <option value="SIGER">SIGER (Sistema de Gestión de Registros Mercantiles)</option>
          <option value="JUCERJA">JUCERJA (Junta Central del Registro Mercantil)</option>
          <option value="CONSERVATORIA">Conservatoria (Portugal)</option>
        </select>
      </div>

      {filingChannel && (
        <div
          className="px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "var(--g-surface-subtle)",
          }}
        >
          Canal "{filingChannel}" seleccionado. La presentación se enviará automáticamente.
        </div>
      )}
    </div>
  );

  // Step 5: Tracking status
  const step5Body = (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-4 py-3 bg-[var(--status-success)]/10 text-[var(--status-success)] rounded-lg">
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">Expediente en seguimiento</span>
      </div>

      <div
        className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]"
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Estado del trámite
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Estado:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {filingStatus}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Canal:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {filingChannel || "No asignado"}
            </span>
          </div>
        </div>
      </div>

      <div
        className="px-4 py-3 text-xs text-[var(--g-text-secondary)]"
        style={{
          borderRadius: "var(--g-radius-md)",
          background: "var(--g-surface-muted)",
        }}
      >
        El sistema monitorizará automáticamente el estado de la presentación y le notificará de
        cambios o subsanaciones requeridas.
      </div>
    </div>
  );

  return (
    <StepperShell
      eyebrow="Secretaría · Tramitación registral"
      title="Asistente de tramitación"
      backTo="/secretaria/tramitador"
      steps={[
        { ...STEPS[0], body: step1Body },
        { ...STEPS[1], body: step2Body },
        { ...STEPS[2], body: step3Body },
        { ...STEPS[3], body: step4Body },
        { ...STEPS[4], body: step5Body },
      ]}
    />
  );
}
