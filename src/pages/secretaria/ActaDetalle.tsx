import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileSignature, Shield, Stamp } from "lucide-react";
import {
  useActaById,
  useCertificationsByMinute,
  useAgreementIdsForMinute,
} from "@/hooks/useActas";
import { EmitirCertificacionButton } from "@/components/secretaria/EmitirCertificacionButton";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";

export default function ActaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: acta, isLoading } = useActaById(id);
  const { data: certs } = useCertificationsByMinute(id);
  const { data: agreementIds } = useAgreementIdsForMinute(id);
  const { primaryRole } = useCurrentUserRole();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }
  if (!acta) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Acta no encontrada.
      </div>
    );
  }

  const m = acta;
  const body = m.meetings?.governing_bodies?.name ?? "Órgano";
  const entity = m.meetings?.governing_bodies?.entities?.common_name ?? "—";

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate("/secretaria/actas")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileSignature className="h-3.5 w-3.5" />
          Acta · {m.meetings?.meeting_type ?? ""}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {body}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{entity}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
              <FileSignature className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Contenido del acta
              </h2>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--g-text-primary)]">
                {m.content ?? "— Sin contenido —"}
              </pre>
            </div>
          </div>

          <div
            className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] px-5 py-3">
              <div className="flex items-center gap-2">
                <Stamp className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Certificaciones emitidas
                </h2>
              </div>
              {id && acta.entity_id ? (
                <EmitirCertificacionButton
                  minuteId={id}
                  entityId={acta.entity_id}
                  bodyId={acta.body_id}
                  agreementIds={agreementIds ?? []}
                  userRole={primaryRole}
                />
              ) : null}
            </div>
            <div className="divide-y divide-[var(--g-border-subtle)]">
              {certs && certs.length > 0 ? (
                certs.map((c) => (
                  <div key={c.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-[var(--g-text-primary)]">
                          Certificación #{c.id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                          {c.agreements_certified?.length ?? 0} acuerdo(s) certificados ·
                          {c.requires_qualified_signature ? " firma cualificada" : " firma simple"}
                        </div>
                      </div>
                      <span
                        className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {c.signature_status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 text-sm text-[var(--g-text-secondary)]">
                  Sin certificaciones emitidas.
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
              <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Firma y registro</h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <KV label="Firmada" value={m.signed_at ? new Date(m.signed_at).toLocaleString("es-ES") : "—"} />
              <KV label="Registrada" value={m.registered_at ? new Date(m.registered_at).toLocaleString("es-ES") : "—"} />
              <KV label="Bloqueada" value={m.is_locked ? "Sí" : "No"} />
              <KV label="Creada" value={new Date(m.created_at).toLocaleString("es-ES")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}
