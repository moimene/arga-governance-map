import { useState } from "react";
import { LogOut, Settings, User as UserIcon, Shield, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { brandName } from "@/lib/tenant-brand-labels";
import { toast } from "sonner";

function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return "AG";
  const clean = nameOrEmail.replace(/^(dñ?a?|don|doña|dr|dra)\.?\s+/i, "").trim();
  const parts = clean.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (clean || nameOrEmail).slice(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  SECRETARIO: "Secretaría General",
  CONSEJERO: "Consejo de Administración",
  COMPLIANCE: "Cumplimiento y Riesgos",
  ADMIN_TENANT: "Administración Corporativa",
  AUDITOR: "Auditoría Interna",
};

const DEMO_ROLES = [
  { code: "SECRETARIO", label: "Secretaría General" },
  { code: "CONSEJERO", label: "Consejero / Vocal" },
  { code: "COMPLIANCE", label: "Oficial de Cumplimiento" },
  { code: "ADMIN_TENANT", label: "Administrador Global" },
  { code: "AUDITOR", label: "Auditor Interno" },
];

export function UserMenu() {
  const { user, logout, signIn } = useAuth();
  const { primaryRole, displayName } = useCurrentUserRole();
  const branding = useTenantBranding();
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);

  const activeRoleCode = simulatedRole ?? primaryRole ?? "SECRETARIO";
  const roleLabel = ROLE_LABELS[activeRoleCode] ?? activeRoleCode;
  const orgName = brandName(branding);

  const fullName =
    displayName ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split("@")[0] : "Dña. Lucía Paredes Vega");

  const email = user?.email || "demo@arga-seguros.com";
  const initials = getInitials(fullName);

  const handleSelectDemoRole = (roleCode: string) => {
    setSimulatedRole(roleCode);
    toast.info(`Rol simulado: ${ROLE_LABELS[roleCode] ?? roleCode}`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sesión cerrada correctamente");
    } catch (e) {
      console.error("Error logging out:", e);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full p-0 ring-offset-background transition-colors hover:ring-2 hover:ring-[var(--t-border-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-border-focus)]"
          aria-label={`Menú de usuario: ${fullName}`}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className="text-xs font-bold text-white"
              style={{ background: "var(--t-brand, #E8112D)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="font-semibold text-foreground text-sm truncate">{fullName}</div>
          <div className="text-xs font-normal text-muted-foreground truncate">{email}</div>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--t-brand)]">
            <Shield className="h-3 w-3" />
            <span className="truncate">{roleLabel} — {orgName}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer text-xs">
            <Shield className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <span>Perfil / Rol de acceso</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Simulación de rol (Demo)
            </div>
            {DEMO_ROLES.map((r) => (
              <DropdownMenuItem
                key={r.code}
                onClick={() => handleSelectDemoRole(r.code)}
                className="flex items-center justify-between cursor-pointer text-xs"
              >
                <span>{r.label}</span>
                {activeRoleCode === r.code && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem className="cursor-pointer text-xs">
          <UserIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          <span>Mi perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-xs">
          <Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          <span>Configuración</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            try {
              toast.info("Cambiando al entorno Garrigues Demo...");
              await logout();
              const { error } = await signIn("demo@garrigues-demo.dev", "TGMSdemo2026!");
              if (error) {
                toast.error(`Error al cambiar: ${error.message}`);
                return;
              }
              toast.success("Conectado a Garrigues Corporate Solutions");
              window.location.href = "/secretaria";
            } catch (e) {
              console.error(e);
            }
          }}
          className="cursor-pointer text-xs text-[var(--g-brand-3308, #004438)] font-medium hover:bg-muted"
        >
          <span className="mr-2 h-2.5 w-2.5 rounded-full bg-[#004438]" />
          <span>Cambiar a Entorno Garrigues</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive cursor-pointer text-xs font-medium"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
