import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, AlertTriangle, Bell, CheckCheck, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { notifications as initialNotifications, type NotifType, type Notification } from "@/data/notifications";
import { cn } from "@/lib/utils";

const iconMap = { critical: AlertTriangle, warning: AlertCircle, info: Info } as const;
const dotMap = {
  critical: "bg-destructive",
  warning: "bg-status-warning",
  info: "bg-primary",
} as const;

type Filter = "all" | NotifType | "unread";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "No leídas" },
  { id: "critical", label: "Críticas" },
  { id: "warning", label: "Avisos" },
  { id: "info", label: "Informativas" },
];

export default function Notificaciones() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((n) => !n.read).length,
      critical: items.filter((n) => n.type === "critical").length,
      warning: items.filter((n) => n.type === "warning").length,
      info: items.filter((n) => n.type === "info").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !n.read);
    return items.filter((n) => n.type === filter);
  }, [items, filter]);

  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const open = (n: Notification) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    navigate(n.route);
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Notificaciones</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.unread} sin leer · {counts.all} en total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} className="gap-2">
          <CheckCheck className="h-4 w-4" /> Marcar todas como leídas
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {f.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                filter === f.id ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-muted-foreground">
            No hay notificaciones en este filtro.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((n) => {
              const Icon = iconMap[n.type];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => open(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-accent/50",
                      !n.read && "bg-accent/20",
                    )}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotMap[n.type])} />
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        n.type === "critical"
                          ? "text-destructive"
                          : n.type === "warning"
                            ? "text-status-warning"
                            : "text-primary",
                      )}
                    />
                    <div className="flex-1">
                      <div className={cn("text-sm leading-snug", n.read ? "text-muted-foreground" : "text-foreground")}>
                        {n.text}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{n.time}</div>
                    </div>
                    {!n.read && (
                      <span className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Nuevo
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
