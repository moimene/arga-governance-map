import { useState } from "react";
import { FileCheck, FilePlus2, Info, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  useAbrirSubexpedienteRegimen,
  useUpdateIncidentRegime,
  type IncidentRegimeCase,
} from "@/hooks/useAimsMultiregime";

type RegimeCode = IncidentRegimeCase["regime_code"];
type LeadRole = IncidentRegimeCase["lead_role"];

interface RegimenDeReferencia {
  code: RegimeCode;
  title: string;
  desc: string;
  authority: string;
  role: LeadRole;
}

/**
 * Catálogo de referencia: correspondencia régimen ↔ autoridad. NO es el
 * registro del incidente. Cuando existe una fila, sus valores mandan.
 */
const CATALOGO: RegimenDeReferencia[] = [
  {
    code: "RIA",
    title: "Subexpediente RIA — AESIA (Vigilancia de Mercado)",
    desc: "Notificación de incidente grave de IA y análisis de causalidad algorítmica.",
    authority: "AESIA",
    role: "AI_OFFICER",
  },
  {
    code: "GDPR",
    title: "Subexpediente RGPD — AEPD (Protección de Datos)",
    desc: "Documentación verificable de brecha, medidas de cifrado y comunicación a interesados.",
    authority: "AEPD",
    role: "DPO",
  },
  // D-5: el subexpediente DORA nombra a la DGSFP y al Banco de España. Un
  // despacho no es entidad financiera y tiene DORA oculto por
  // `branding.modules`: ofrecerle aquí el régimen contradice al resto del
  // producto. Se filtra con `doraVisible`.
  {
    code: "DORA",
    title: "Subexpediente DORA — DGSFP / BdE (Resiliencia Operativa TIC)",
    desc: "Plantilla normalizada TIC, informe intermedio a 72h e informe final de causa raíz.",
    authority: "DGSFP",
    role: "CISO",
  },
];

const ROLES: { code: LeadRole; label: string }[] = [
  { code: "AI_OFFICER", label: "AI Officer" },
  { code: "DPO", label: "Delegado de Protección de Datos" },
  { code: "CISO", label: "CISO" },
  { code: "LEGAL", label: "Asesoría jurídica" },
];

/** El código del rol no es texto de pantalla: se pinta su etiqueta. */
const etiquetaRol = (code: string) => ROLES.find((r) => r.code === code)?.label ?? code;

const MOTIVACION_MINIMA = 20;

const INPUT_CLASSES =
  "h-9 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

interface Borrador {
  code: RegimeCode;
  authority: string;
  role: LeadRole;
  motivacion: string;
}

export interface SubexpedientesRegimenProps {
  incidentId: string;
  /** Las filas ya registradas de `aims_incident_regimes`. */
  regimes: IncidentRegimeCase[];
  doraVisible: boolean;
}

export default function SubexpedientesRegimen({
  incidentId,
  regimes,
  doraVisible,
}: SubexpedientesRegimenProps) {
  const abrirMutation = useAbrirSubexpedienteRegimen();
  const updateRegimeMutation = useUpdateIncidentRegime();
  const [borrador, setBorrador] = useState<Borrador | null>(null);

  const catalogo = CATALOGO.filter((r) => doraVisible || r.code !== "DORA");

  const handleCloseRegimeSubcase = async (regimeCode: RegimeCode) => {
    const fila = regimes.find((r) => r.regime_code === regimeCode);
    if (!fila) {
      toast.error(`No hay subexpediente ${regimeCode} registrado que cerrar`);
      return;
    }
    try {
      await updateRegimeMutation.mutateAsync({
        id: fila.id,
        updates: { status: "CLOSED", closed_at: new Date().toISOString() },
      });
      toast.success(`Subexpediente ${regimeCode} cerrado`, {
        description:
          "El cierre no arrastra a los demás regímenes. No constituye notificación " +
          "a la autoridad ni acuse de recibo: sólo cierra el subexpediente interno.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo cerrar el subexpediente ${regimeCode}: ${msg}`);
    }
  };

  const handleAbrirSubexpediente = async () => {
    if (!borrador) return;
    try {
      await abrirMutation.mutateAsync({
        incidentId,
        regimeCode: borrador.code,
        targetAuthority: borrador.authority.trim(),
        leadRole: borrador.role,
        applicabilityRationale: borrador.motivacion,
      });
      toast.success(`Subexpediente ${borrador.code} abierto`, {
        description:
          "Queda registrado que el régimen alcanza a este incidente a juicio de quien lo abre. " +
          "No notifica a ninguna autoridad ni acredita envío alguno.",
      });
      setBorrador(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo abrir el subexpediente ${borrador.code}: ${msg}`);
    }
  };

  return (
    <div
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g-border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[var(--g-brand-3308)]" />
          <h3 className="text-sm font-bold text-[var(--g-text-primary)]">
            Regímenes potencialmente aplicables
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
          <Info className="w-4 h-4 text-[var(--g-brand-3308)]" />
          <span>El cierre de un subexpediente no arrastra ni altera el estado de los demás regímenes.</span>
        </div>
      </div>

      <p className="text-xs text-[var(--g-text-secondary)]">
        Correspondencia régimen ↔ autoridad de referencia. Abrir un subexpediente registra que, a
        juicio de quien lo abre, el régimen alcanza a este incidente. No notifica a ninguna autoridad
        ni acredita el envío. Los datos de un subexpediente ya registrado sustituyen a los de
        referencia.
      </p>

      <div className="space-y-3">
        {catalogo.map((reg) => {
          // La fila registrada, si la hay, es el dato; `reg` sólo es el
          // catálogo de referencia. Pintar siempre el literal hacía pasar por
          // registrado un valor que nadie ha escrito.
          const fila = regimes.find((r) => r.regime_code === reg.code);
          const editando = borrador?.code === reg.code;
          const motivacionCorta = (borrador?.motivacion.trim().length ?? 0) < MOTIVACION_MINIMA;

          return (
            <div
              key={reg.code}
              className="p-4 bg-[var(--g-surface-subtle)]/30 border border-[var(--g-border-subtle)] space-y-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{reg.code}</span>
                    <h4 className="text-sm font-bold text-[var(--g-text-primary)]">{reg.title}</h4>
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)]">{reg.desc}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[var(--g-text-secondary)] pt-1">
                    <span>Autoridad: <strong className="text-[var(--g-text-primary)]">{fila?.target_authority ?? reg.authority}</strong></span>
                    <span>•</span>
                    <span>Responsable: <strong className="text-[var(--g-text-primary)]">{etiquetaRol(fila?.lead_role ?? reg.role)}</strong></span>
                    <span>•</span>
                    <span>{fila ? `Subexpediente registrado · ${fila.status}` : "Valor de referencia, no registrado"}</span>
                  </div>
                  {fila?.applicability_rationale && (
                    <p className="text-[11px] text-[var(--g-text-secondary)] italic pt-1">
                      Motivación de aplicabilidad: {fila.applicability_rationale}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {fila ? (
                    <button
                      onClick={() => handleCloseRegimeSubcase(reg.code)}
                      disabled={updateRegimeMutation.isPending || fila.status === "CLOSED"}
                      className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Cerrar subexpediente</span>
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setBorrador(
                          editando
                            ? null
                            : { code: reg.code, authority: reg.authority, role: reg.role, motivacion: "" },
                        )
                      }
                      className="px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-semibold transition-colors flex items-center gap-1.5"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <FilePlus2 className="w-3.5 h-3.5 text-[var(--g-brand-3308)]" />
                      <span>{editando ? "Cancelar" : "Abrir subexpediente"}</span>
                    </button>
                  )}
                </div>
              </div>

              {editando && borrador && (
                <div className="border-t border-[var(--g-border-subtle)] pt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={`autoridad-${reg.code}`}
                        className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1"
                      >
                        Autoridad destinataria
                      </label>
                      <input
                        id={`autoridad-${reg.code}`}
                        type="text"
                        value={borrador.authority}
                        onChange={(e) => setBorrador({ ...borrador, authority: e.target.value })}
                        className={INPUT_CLASSES}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`rol-${reg.code}`}
                        className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1"
                      >
                        Responsable interno
                      </label>
                      <select
                        id={`rol-${reg.code}`}
                        value={borrador.role}
                        onChange={(e) => setBorrador({ ...borrador, role: e.target.value as LeadRole })}
                        className={INPUT_CLASSES}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r.code} value={r.code}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`motivacion-${reg.code}`}
                      className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1"
                    >
                      Motivación de aplicabilidad *
                    </label>
                    <textarea
                      id={`motivacion-${reg.code}`}
                      rows={3}
                      value={borrador.motivacion}
                      onChange={(e) => setBorrador({ ...borrador, motivacion: e.target.value })}
                      placeholder="Por qué este régimen alcanza a este incidente: hechos declarados, artículo aplicable y alcance."
                      aria-invalid={motivacionCorta}
                      aria-describedby={`motivacion-ayuda-${reg.code}`}
                      className="w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                    <p
                      id={`motivacion-ayuda-${reg.code}`}
                      className="mt-1 text-[11px] text-[var(--g-text-secondary)]"
                    >
                      {borrador.motivacion.trim().length}/{MOTIVACION_MINIMA} caracteres mínimos. La
                      apertura es una afirmación de quien la hace, y queda registrada con ella.
                    </p>
                  </div>

                  <button
                    onClick={handleAbrirSubexpediente}
                    disabled={abrirMutation.isPending || motivacionCorta}
                    aria-busy={abrirMutation.isPending}
                    className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>{abrirMutation.isPending ? "Abriendo…" : "Confirmar apertura"}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
