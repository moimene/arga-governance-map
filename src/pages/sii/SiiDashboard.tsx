import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { useSiiCasesList, type SiiCaseFull } from "@/hooks/useSii";
import {
  AlertOctagon,
  Archive,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileLock2,
  FolderOpen,
  Inbox,
  Loader2,
  MessageSquarePlus,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

const intakeSteps = [
  {
    icon: MessageSquarePlus,
    title: "Recepción segura",
    body: "Registra la comunicación con referencia SII y separa identidad, hechos y adjuntos desde el primer minuto.",
  },
  {
    icon: ClipboardCheck,
    title: "Triage inicial",
    body: "Clasifica materia, país, urgencia y conflicto potencial antes de asignar un investigador.",
  },
  {
    icon: UserCheck,
    title: "Asignación controlada",
    body: "Limita la visibilidad al equipo SII y deja constancia de cada acceso en el log segregado.",
  },
];

const guardrails = [
  "Identidad protegida conforme a Ley 2/2023",
  "Auditoría independiente de accesos",
  "Evidencias cifradas y custodiadas",
  "Escalado separado de hallazgos GRC",
];

function toneFor(s: string | null): "info" | "warning" | "neutral" {
  const v = (s ?? "").toUpperCase();
  if (v.startsWith("EN INVESTIGAC")) return "info";
  if (v.startsWith("EN ANÁLISIS") || v.startsWith("EN ANALISIS")) return "warning";
  if (v.startsWith("CERRAD")) return "neutral";
  return "neutral";
}

function KpiTile({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return (
    <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-3xl font-bold leading-none tracking-tight text-[var(--t-text-primary)]">{value}</div>
          <div className="mt-2 text-sm font-medium leading-tight text-[var(--t-text-secondary)]">{label}</div>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--t-surface-subtle)] text-[var(--t-brand)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

function CaseCard({ c }: { c: SiiCaseFull }) {
  return (
    <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/sii/${c.display_id}`}
            className="break-all font-mono text-xs font-semibold text-[var(--t-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-border-focus)] focus-visible:ring-offset-2"
          >
            {c.display_id}
          </Link>
          <div className="mt-2 text-sm font-semibold text-[var(--t-text-primary)]">
            {c.classification ?? c.category ?? "Sin clasificar"}
          </div>
        </div>
        <StatusBadge label={c.status ?? "Sin estado"} tone={toneFor(c.status)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Recibido</dt>
          <dd className="mt-1 text-[var(--t-text-primary)]">{c.received_date ?? "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">País</dt>
          <dd className="mt-1 text-[var(--t-text-primary)]">{c.country ?? "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Canal</dt>
          <dd className="mt-1 text-[var(--t-text-primary)]">{c.channel ?? "-"}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Investigador</dt>
          <dd className="mt-1 text-[var(--t-text-primary)]">{c.investigator_name ?? "Sin asignar"}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function SiiDashboard() {
  const { data: cases = [], isLoading } = useSiiCasesList();

  const isClosed = (s: string | null) => !!s && s.toUpperCase().startsWith("CERRAD");
  const active = cases.filter((c) => !isClosed(c.status)).length;
  const closed = cases.length - active;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 text-[var(--t-text-primary)] sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--t-border-default)] bg-[var(--t-surface-card)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--t-brand)]">
            <FileLock2 className="h-3.5 w-3.5" />
            Zona segregada
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Intake SII</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--t-text-secondary)] sm:text-base">
            Recepción, clasificación y seguimiento de comunicaciones del canal interno con acceso restringido, trazabilidad independiente y protección de identidad.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            className="bg-[var(--t-brand)] text-[var(--t-text-inverse)] hover:bg-[var(--t-brand-hover)] focus-visible:ring-[var(--t-border-focus)]"
          >
            <a href="#bandeja-sii">
              Abrir bandeja segura <ChevronRight className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] text-[var(--t-text-primary)] hover:bg-[var(--t-surface-subtle)]"
          >
            <Link to="/documentacion">Marco y guía</Link>
          </Button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[var(--t-text-primary)]">Entrada segura de comunicaciones</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">
                Flujo mínimo de admisión antes de abrir una investigación formal.
              </p>
            </div>
            <span className="w-fit rounded-md bg-[var(--t-surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--t-brand)]">
              Intake protegido
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {intakeSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-md border border-[var(--t-border-subtle)] bg-[var(--t-surface-page)] p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--t-surface-subtle)] text-[var(--t-brand)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-[var(--t-text-primary)]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">{step.body}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--t-surface-subtle)] text-[var(--t-brand)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[var(--t-text-primary)]">Controles de confidencialidad</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">
                Requisitos visibles antes de consultar o clasificar un caso.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {guardrails.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--t-text-primary)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--t-status-success)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Casos activos" value={active} icon={FolderOpen} />
        <KpiTile label="Casos cerrados (ejercicio)" value={closed} icon={Archive} />
        <KpiTile label="Plazo medio de respuesta" value="5 días" icon={AlertOctagon} />
        <KpiTile label="Casos en bandeja" value={cases.length} icon={Inbox} />
      </div>

      <section id="bandeja-sii" className="mt-6 scroll-mt-20">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--t-text-primary)]">Bandeja de investigación</h2>
            <p className="text-sm text-[var(--t-text-secondary)]">
              Vista operativa para priorizar, reasignar o continuar casos ya admitidos.
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">
            {cases.length} referencias
          </span>
        </div>

        <Card className="hidden overflow-hidden border-[var(--t-border-default)] bg-[var(--t-surface-card)] lg:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--t-surface-muted)] hover:bg-[var(--t-surface-muted)]">
                <TableHead className="text-[var(--t-text-secondary)]">Referencia</TableHead>
                <TableHead className="text-[var(--t-text-secondary)]">Recibido</TableHead>
                <TableHead className="text-[var(--t-text-secondary)]">Canal</TableHead>
                <TableHead className="text-[var(--t-text-secondary)]">Clasificación</TableHead>
                <TableHead className="text-[var(--t-text-secondary)]">País</TableHead>
                <TableHead className="text-[var(--t-text-secondary)]">Estado</TableHead>
                <TableHead className="text-[var(--t-text-secondary)]">Investigador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-[var(--t-text-secondary)]">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && cases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-[var(--t-text-secondary)]">
                    No hay casos registrados.
                  </TableCell>
                </TableRow>
              )}
              {cases.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-[var(--t-surface-subtle)]/60">
                  <TableCell className="font-mono text-xs font-semibold">
                    <Link to={`/sii/${c.display_id}`} className="text-[var(--t-brand)] hover:underline">
                      {c.display_id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--t-text-primary)]">{c.received_date ?? "-"}</TableCell>
                  <TableCell className="text-sm text-[var(--t-text-primary)]">{c.channel ?? "-"}</TableCell>
                  <TableCell className="text-sm text-[var(--t-text-primary)]">{c.classification ?? c.category ?? "-"}</TableCell>
                  <TableCell className="text-sm text-[var(--t-text-primary)]">{c.country ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge label={c.status ?? "-"} tone={toneFor(c.status)} />
                  </TableCell>
                  <TableCell className="text-sm text-[var(--t-text-primary)]">{c.investigator_name ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div data-testid="sii-mobile-case-list" className="grid gap-3 lg:hidden">
          {isLoading && (
            <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 text-center text-sm text-[var(--t-text-secondary)]">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Cargando casos.
            </Card>
          )}
          {!isLoading && cases.length === 0 && (
            <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 text-center text-sm text-[var(--t-text-secondary)]">
              No hay casos registrados.
            </Card>
          )}
          {cases.map((c) => (
            <CaseCard key={c.id} c={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
