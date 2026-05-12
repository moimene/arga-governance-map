import { forwardRef, useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronLeft,
  Users,
  Building2,
  Plus,
  UserCheck,
  Edit3,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { usePersonaCanonical, useUpdatePersona } from "@/hooks/usePersonasCanonical";
import {
  useCargosPersona,
  CARGO_LABELS,
  type CargoDetailRow,
} from "@/hooks/useCargos";
import { useHoldingsPersona } from "@/hooks/useCapitalHoldings";
import { useCesarCargo } from "@/hooks/useCondicionesPersonaMutations";
import { useRepresentantesAdminPJByPerson } from "@/hooks/useRepresentantesAdminPJ";
import {
  isAuthorityRole,
  requiresRepresentative,
  type TipoCondicionCargo,
} from "@/lib/secretaria/cargo-validation";

export default function PersonaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading } = usePersonaCanonical(id);
  const { data: cargos } = useCargosPersona(id);
  const { data: holdings } = useHoldingsPersona(id);
  // P2 Codex iteration-1: hook llamado aquí (no después de los early returns)
  // para cumplir rules-of-hooks. El hook se desactiva internamente vía
  // `enabled: !!tenantId && !!representedPersonId` si id es undefined.
  const { data: representantesByEntity } = useRepresentantesAdminPJByPerson(id);

  // D4.1: split cargos by estado para mostrar vigentes y cesados en
  // secciones independientes. El histórico se conserva (L14): el cese hace
  // UPDATE estado='CESADO' + fecha_fin, nunca DELETE.
  const cargosVigentes: CargoDetailRow[] = (cargos ?? []).filter(
    (c) => c.estado === "VIGENTE",
  );
  const cargosHistorico: CargoDetailRow[] = (cargos ?? []).filter(
    (c) => c.estado === "CESADO",
  );

  // D4.3: estado modal "Cesar cargo". El UPDATE conserva el registro y se
  // limita a estado='CESADO' + fecha_fin + metadata.cese_razon. El trigger
  // fn_sync_authority_evidence propaga el cierre de vigencia al cargo
  // certificante asociado.
  const [cargoToCesar, setCargoToCesar] = useState<CargoDetailRow | null>(null);
  const [fechaFin, setFechaFin] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [razon, setRazon] = useState<string>("");
  const cesarMutation = useCesarCargo();
  const fechaFinInputRef = useRef<HTMLInputElement>(null);
  const updatePersonaMutation = useUpdatePersona();
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState({
    full_name: "",
    tax_id: "",
    email: "",
    denomination: "",
  });
  const editNameInputRef = useRef<HTMLInputElement>(null);

  function closeCesarModal() {
    setCargoToCesar(null);
    setRazon("");
  }

  function openEditPersona() {
    if (!p) return;
    setEditDraft({
      full_name: p.full_name ?? "",
      tax_id: p.tax_id ?? "",
      email: p.email ?? "",
      denomination: p.denomination ?? "",
    });
    setEditOpen(true);
  }

  function closeEditPersona() {
    setEditOpen(false);
  }

  // Foco inicial al primer campo + Escape cierra. Cumple WCAG 2.1: focus
  // management básico para modal accesible (role=dialog + aria-modal).
  useEffect(() => {
    if (!cargoToCesar) return;
    fechaFinInputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeCesarModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cargoToCesar]);

  useEffect(() => {
    if (!editOpen) return;
    editNameInputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeEditPersona();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editOpen]);

  async function handleConfirmCese() {
    if (!cargoToCesar) return;
    try {
      await cesarMutation.mutateAsync({
        condicion_id: cargoToCesar.id,
        fecha_fin: fechaFin,
        razon: razon || null,
      });
      toast.success("Cargo cesado correctamente");
      closeCesarModal();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo cesar el cargo: " + msg);
    }
  }

  async function handleSavePersona() {
    if (!p) return;
    try {
      await updatePersonaMutation.mutateAsync({
        id: p.id,
        full_name: editDraft.full_name,
        tax_id: editDraft.tax_id || null,
        email: editDraft.email || null,
        denomination: p.person_type === "PJ" ? editDraft.denomination || null : null,
      });
      toast.success("Persona actualizada correctamente");
      closeEditPersona();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("No se pudo actualizar la persona: " + msg);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 text-sm text-[var(--g-text-secondary)]">Cargando…</div>
    );
  }
  if (!p) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 text-sm text-[var(--g-text-secondary)]">
        Persona no encontrada.{" "}
        <Link to="/secretaria/personas" className="text-[var(--g-brand-3308)] underline">
          Volver
        </Link>
      </div>
    );
  }

  // D4.4: detección "PJ administradora sin representante PF permanente"
  // (L2: LSC art. 212 bis + RRM art. 143). Subconjunto de los cargos
  // vigentes filtrados por requiresRepresentative — la persona física
  // permanente sólo es exigible cuando la PJ ocupa un cargo admin
  // (ADMIN_UNICO/SOLIDARIO/MANCOMUNADO/PJ/CONSEJERO); como SOCIO no
  // requiere representante (L1).
  //
  // P2 Codex iteration-1: verificar representación PER entity_id usando
  // `representaciones` directamente (mapa de useRepresentantesAdminPJByPerson),
  // no `persons.representative_person_id` (atajo legacy global compartido).
  const cargosAdminSinRep: CargoDetailRow[] = cargosVigentes.filter((c) => {
    if (
      !requiresRepresentative(
        { person_type: p.person_type },
        c.tipo_condicion as TipoCondicionCargo,
      )
    ) {
      return false;
    }
    // Verificar representación VIGENTE per entity_id
    return !(representantesByEntity?.has(c.entity_id) ?? false);
  });
  const needsRepresentanteWarning = p.person_type === "PJ" && cargosAdminSinRep.length > 0;
  const representantesVigentes = representantesByEntity
    ? Array.from(representantesByEntity.values())
    : [];
  const representantesLabel =
    representantesVigentes.length > 0
      ? representantesVigentes
          .map((r) => `${r.full_name}${r.tax_id ? ` (${r.tax_id})` : ""}`)
          .join(", ")
      : "—";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-4">
        <Link
          to="/secretaria/personas"
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Personas
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-full bg-[var(--g-sec-100)] p-3">
          <Users className="h-5 w-5 text-[var(--g-brand-3308)]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {p.full_name}
          </h1>
          <p className="text-sm text-[var(--g-text-secondary)]">
            {p.person_type === "PJ" ? "Persona jurídica" : "Persona física"} · {p.tax_id ?? "sin NIF"}
          </p>
        </div>
        {/* D4.2: acciones por persona. TODO D5.2/D5.3: rutas destino se
            montarán en App.tsx en Wave 5; por ahora los enlaces apuntan a
            su URL definitiva aunque la vista aún no esté disponible. */}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={openEditPersona}
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            Editar datos
          </button>
          <Link
            to={`/secretaria/cargos/nuevo?personId=${p.id}`}
            className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Asignar cargo
          </Link>
          {p.person_type === "PJ" && (
            <Link
              to={`/secretaria/personas/${p.id}/representante/nuevo`}
              className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              {representantesVigentes.length > 0 ? "Editar representante" : "Asignar representante"}
            </Link>
          )}
        </div>
      </div>

      {/* D4.4: aviso PJ administradora sin representante PF permanente.
          LSC art. 212 bis + RRM art. 143 (L2): mientras no haya
          representante PF, la PJ no podrá emitir certificación con este
          cargo. */}
      {needsRepresentanteWarning && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning)]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Esta persona jurídica administradora requiere representante PF permanente
              (LSC art. 212 bis) — pendiente de asignar.
            </p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              Tiene cargo(s) admin vigente(s):{" "}
              {cargosAdminSinRep
                .map((c) => CARGO_LABELS[c.tipo_condicion] ?? c.tipo_condicion)
                .join(", ")}
              . Hasta que se designe, no se podrá emitir certificación con este cargo.
            </p>
            <Link
              to={`/secretaria/personas/${p.id}/representante/nuevo`}
              className="mt-2 inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-1.5 text-xs font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Asignar representante
            </Link>
          </div>
        </div>
      )}

      <section
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Datos de identidad
        </h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="ID" value={<code className="text-xs">{p.id}</code>} />
          <Field label="Nombre" value={p.full_name} />
          <Field label="Tipo" value={p.person_type ?? "—"} />
          <Field label="NIF/CIF" value={p.tax_id ?? "—"} />
          <Field label="Email" value={p.email ?? "—"} />
          <Field label="Denominación" value={p.denomination ?? "—"} />
          {p.person_type === "PJ" ? (
            <Field
              label="Representantes vigentes"
              value={representantesLabel}
            />
          ) : null}
        </dl>
      </section>

      {/* D4.1: Cargos vigentes — estado === 'VIGENTE' */}
      <section
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Cargos vigentes
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Cargo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sociedad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Órgano</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Desde</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {cargosVigentes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin cargos vigentes.
                </td>
              </tr>
            ) : (
              cargosVigentes.map((c) => {
                const sociedadNombre = c.entity?.common_name ?? c.entity?.legal_name ?? "—";
                const cargoLabel = CARGO_LABELS[c.tipo_condicion] ?? c.tipo_condicion;
                const authorityStatus = isAuthorityRole(c.tipo_condicion as TipoCondicionCargo)
                  ? c.inscripcion_rm_referencia
                    ? "Inscrito"
                    : "Pendiente RM"
                  : null;
                return (
                  <tr key={c.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">
                      {cargoLabel}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {c.entity?.id ? (
                        <Link
                          to={`/secretaria/sociedades/${c.entity.id}`}
                          className="text-[var(--g-brand-3308)] hover:underline"
                        >
                          {sociedadNombre}
                        </Link>
                      ) : (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {c.body?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.fecha_inicio}</td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className="inline-flex items-center bg-[var(--status-success)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        Vigente
                      </span>
                      {authorityStatus ? (
                        <span
                          className={
                            "ml-2 inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)] " +
                            (authorityStatus === "Inscrito"
                              ? "bg-[var(--status-success)]"
                              : "bg-[var(--status-warning)]")
                          }
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {authorityStatus}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => setCargoToCesar(c)}
                        className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                        aria-label={`Cesar cargo ${cargoLabel}`}
                      >
                        Cesar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* D4.1: Histórico — estado === 'CESADO'. L14: el cese conserva el
          registro, nunca hace DELETE. */}
      <section
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Histórico (cesados)
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Cargo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sociedad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Órgano</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Desde</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Hasta</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {cargosHistorico.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin cargos cesados todavía.
                </td>
              </tr>
            ) : (
              cargosHistorico.map((c) => {
                const sociedadNombre = c.entity?.common_name ?? c.entity?.legal_name ?? "—";
                return (
                  <tr key={c.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">
                      {CARGO_LABELS[c.tipo_condicion] ?? c.tipo_condicion}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {c.entity?.id ? (
                        <Link
                          to={`/secretaria/sociedades/${c.entity.id}`}
                          className="text-[var(--g-brand-3308)] hover:underline"
                        >
                          {sociedadNombre}
                        </Link>
                      ) : (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {c.body?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.fecha_inicio}</td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {c.fecha_fin ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className="inline-flex items-center bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        Cesado
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* G3: Es socio en — capital_holdings vigentes de esta persona */}
      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Es socio en
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sociedad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Clase</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Títulos</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">% capital</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {!holdings || holdings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  No figura como socio en ninguna sociedad gestionada.
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const sociedadNombre = h.entity?.common_name ?? h.entity?.legal_name ?? "—";
                return (
                  <tr key={h.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-3 text-sm font-semibold">
                      {h.entity?.id ? (
                        <Link
                          to={`/secretaria/sociedades/${h.entity.id}`}
                          className="text-[var(--g-brand-3308)] hover:underline"
                        >
                          {sociedadNombre}
                        </Link>
                      ) : (
                        <span className="text-[var(--g-text-primary)]">{sociedadNombre}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {h.share_class?.class_code ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                          title={h.share_class.name ?? undefined}
                        >
                          {h.share_class.class_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-[var(--g-text-secondary)] tabular-nums">
                      {h.numero_titulos != null ? Number(h.numero_titulos).toLocaleString("es-ES") : "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-[var(--g-text-primary)] tabular-nums">
                      {h.porcentaje_capital != null ? `${Number(h.porcentaje_capital).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {h.effective_from ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {editOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="editar-persona-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-brand-3308)]/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditPersona();
          }}
        >
          <div
            className="w-full max-w-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
            style={{
              borderRadius: "var(--g-radius-lg)",
              boxShadow: "var(--g-shadow-modal)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="editar-persona-title"
                className="text-lg font-semibold text-[var(--g-text-primary)]"
              >
                Editar persona
              </h2>
              <button
                type="button"
                onClick={closeEditPersona}
                className="-mr-2 -mt-2 p-1.5 text-[var(--g-text-secondary)] transition-colors hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <EditInput
                ref={editNameInputRef}
                label="Nombre"
                value={editDraft.full_name}
                onChange={(value) => setEditDraft((d) => ({ ...d, full_name: value }))}
                required
              />
              <EditInput
                label="NIF/CIF"
                value={editDraft.tax_id}
                onChange={(value) => setEditDraft((d) => ({ ...d, tax_id: value }))}
              />
              <EditInput
                label="Email"
                value={editDraft.email}
                onChange={(value) => setEditDraft((d) => ({ ...d, email: value }))}
                type="email"
              />
              {p.person_type === "PJ" ? (
                <EditInput
                  label="Denominación"
                  value={editDraft.denomination}
                  onChange={(value) => setEditDraft((d) => ({ ...d, denomination: value }))}
                />
              ) : null}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEditPersona}
                className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePersona}
                disabled={updatePersonaMutation.isPending || !editDraft.full_name.trim()}
                aria-busy={updatePersonaMutation.isPending}
                className="inline-flex items-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:pointer-events-none disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {updatePersonaMutation.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D4.3: Modal Cesar cargo. UPDATE estado='CESADO' + fecha_fin + razón
          en metadata. NO DELETE — L14 conserva histórico. El trigger
          fn_sync_authority_evidence cierra la vigencia del cargo
          certificante asociado en authority_evidence. */}
      {cargoToCesar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cesar-cargo-title"
          aria-describedby="cesar-cargo-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-brand-3308)]/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCesarModal();
          }}
        >
          <div
            className="w-full max-w-md border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
            style={{
              borderRadius: "var(--g-radius-lg)",
              boxShadow: "var(--g-shadow-modal)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="cesar-cargo-title"
                className="text-lg font-semibold text-[var(--g-text-primary)]"
              >
                Cesar cargo:{" "}
                {CARGO_LABELS[cargoToCesar.tipo_condicion] ?? cargoToCesar.tipo_condicion}
              </h2>
              <button
                type="button"
                onClick={closeCesarModal}
                className="-mr-2 -mt-2 p-1.5 text-[var(--g-text-secondary)] transition-colors hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p
              id="cesar-cargo-desc"
              className="mt-1 text-sm text-[var(--g-text-secondary)]"
            >
              Se cerrará la vigencia. El histórico se conserva (no se borra).
            </p>
            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Fecha de cese *
                </span>
                <input
                  ref={fechaFinInputRef}
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Razón (opcional)
                </span>
                <textarea
                  value={razon}
                  onChange={(e) => setRazon(e.target.value)}
                  rows={3}
                  placeholder="Renuncia, cese, expiración mandato..."
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCesarModal}
                className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCese}
                disabled={cesarMutation.isPending || !fechaFin}
                aria-busy={cesarMutation.isPending}
                className="inline-flex items-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:pointer-events-none disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {cesarMutation.isPending ? "Cesando…" : "Confirmar cese"}
              </button>
            </div>
          </div>
        </div>
      )}
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

const EditInput = forwardRef<
  HTMLInputElement,
  {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
  }
>(function EditInput({ label, value, onChange, type = "text", required = false }, ref) {
  const inputId = `persona-edit-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <input
        ref={ref}
        id={inputId}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none transition-colors focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
    </label>
  );
});
