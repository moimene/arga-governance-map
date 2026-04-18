import { FileText, Eye } from "lucide-react";
import { useState } from "react";
import { usePlantillasList, PlantillaRow } from "@/hooks/usePlantillas";

const LOCALE_FLAG: Record<string, string> = {
  "es-ES": "ES",
  "pt-PT": "PT",
  "pt-BR": "BR",
  "es-MX": "MX",
  "es":    "ES",
};

export default function Plantillas() {
  const { data, isLoading } = usePlantillasList();
  const [preview, setPreview] = useState<PlantillaRow | null>(null);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileText className="h-3.5 w-3.5" />
          Secretaría · Plantillas
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Plantillas documentales
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Modelos de convocatoria, acta, certificación e instancia — versionadas y con variantes por
          jurisdicción.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <div
          className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Código</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Título</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Locale</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">v.</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">Cargando…</td></tr>
              ) : !data || data.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">Sin plantillas.</td></tr>
              ) : (
                data.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setPreview(t)}
                    className={`cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                      preview?.id === t.id ? "bg-[var(--g-surface-subtle)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3 text-sm font-mono text-[var(--g-text-primary)]">
                      {t.template_code}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-primary)]">{t.title}</td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      <span
                        className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {LOCALE_FLAG[t.locale] ?? t.locale}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">{t.version}</td>
                    <td className="px-5 py-3 text-right">
                      <Eye className="inline h-4 w-4 text-[var(--g-text-secondary)]" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Previsualización</h2>
          </div>
          <div className="p-5">
            {preview ? (
              <>
                <div className="mb-3">
                  <div className="font-mono text-xs text-[var(--g-text-secondary)]">{preview.template_code}</div>
                  <div className="text-base font-semibold text-[var(--g-text-primary)]">{preview.title}</div>
                  <div className="text-xs text-[var(--g-text-secondary)]">
                    {preview.typology ?? "—"} · v{preview.version} · {preview.locale}
                  </div>
                </div>
                <pre className="whitespace-pre-wrap rounded bg-[var(--g-surface-subtle)] p-4 font-sans text-[12px] leading-relaxed text-[var(--g-text-primary)]">
                  {preview.content_template ?? "— Sin contenido —"}
                </pre>
              </>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">
                Selecciona una plantilla para previsualizar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
