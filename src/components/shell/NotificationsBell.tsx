import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notifications as initialNotifications, type Notification } from "@/data/notifications";
import { cn } from "@/lib/utils";
import { useState } from "react";

const iconMap = { critical: AlertTriangle, warning: AlertCircle, info: Info } as const;
const dotMap = {
  critical: "bg-destructive",
  warning: "bg-status-warning",
  info: "bg-primary",
} as const;

const routeMap: Record<number, string> = {
  1: "/hallazgos/HALL-008",
  2: "/organos/consejo-administracion/reuniones/cda-22-04-2026",
  3: "/politicas/PR-003",
  4: "/delegaciones/carlos-vaz-latam",
  5: "/hallazgos/HALL-010",
  6: "/obligaciones/OBL-DORA-003",
  7: "/conflictos",
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>(initialNotifications);
  const unread = items.filter((n) => !n.read).length;

  const markAll = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const open = (n: Notification) => {
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    const route = routeMap[n.id];
    if (route) navigate(route);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="font-semibold">Notificaciones</div>
          <span className="text-xs text-muted-foreground">{unread} sin leer</span>
        </div>
        <div className="max-h-[440px] overflow-auto">
          {items.map((n) => {
            const Icon = iconMap[n.type];
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-accent/50",
                  !n.read ? "bg-accent/20" : "bg-card",
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotMap[n.type])} />
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", n.type === "critical" ? "text-destructive" : n.type === "warning" ? "text-status-warning" : "text-primary")} />
                <div className="flex-1">
                  <div className={cn("text-sm leading-snug", n.read ? "text-muted-foreground" : "text-foreground")}>{n.text}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{n.time}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como leídas
          </button>
          <button className="text-xs font-medium text-muted-foreground hover:text-primary">Ver todas las notificaciones</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
