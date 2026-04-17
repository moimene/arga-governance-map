import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  useAllNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadCount,
} from "@/hooks/useNotifications";
import type { NotificationRow } from "@/hooks/useDashboardData";

const iconFor = (t: string) =>
  t === "error" ? AlertTriangle : t === "warning" ? AlertCircle : Info;
const dotFor = (t: string) =>
  t === "error" ? "bg-destructive" : t === "warning" ? "bg-status-warning" : "bg-primary";
const colorFor = (t: string) =>
  t === "error" ? "text-destructive" : t === "warning" ? "text-status-warning" : "text-primary";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `Hace ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Hace ${d} d`;
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useAllNotifications();
  const { data: unread = 0 } = useUnreadCount();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const handleOpen = (n: NotificationRow) => {
    if (!n.is_read) markOne.mutate(n.id);
    setOpen(false);
    if (n.route) navigate(n.route);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5 text-foreground" />
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
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">Sin notificaciones.</div>
          )}
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-accent/50",
                  !n.is_read ? "bg-accent/20" : "bg-card",
                )}
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotFor(n.type))} />
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", colorFor(n.type))} />
                <div className="flex-1">
                  <div className={cn("text-sm font-medium leading-snug", n.is_read ? "text-muted-foreground" : "text-foreground")}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.body}</div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.created_at)}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <button
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como leídas
          </button>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/notificaciones");
            }}
            className="text-xs font-medium text-muted-foreground hover:text-primary"
          >
            Ver todas
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
