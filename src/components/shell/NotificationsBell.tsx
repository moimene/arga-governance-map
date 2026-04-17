import { Bell, AlertTriangle, AlertCircle, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notifications } from "@/data/notifications";
import { cn } from "@/lib/utils";

const iconMap = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
} as const;

const toneMap = {
  critical: "text-status-critical",
  warning: "text-status-warning",
  info: "text-primary",
} as const;

export function NotificationsBell() {
  const unread = notifications.filter((n) => !n.read).length;
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
          <button className="text-xs text-primary hover:underline">Marcar todas como leídas</button>
        </div>
        <div className="max-h-[440px] overflow-auto">
          {notifications.map((n) => {
            const Icon = iconMap[n.type];
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 border-b border-border/60 px-4 py-3 hover:bg-accent/50",
                  !n.read && "bg-accent/20",
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneMap[n.type])} />
                <div className="flex-1">
                  <div className="text-sm leading-snug text-foreground">{n.text}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{n.time}</div>
                </div>
                {n.read && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
