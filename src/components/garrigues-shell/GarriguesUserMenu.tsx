import { forwardRef } from "react";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useTenantContext } from "@/context/TenantContext";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { brandName } from "@/lib/tenant-brand-labels";
import { resolveLoginBrand } from "@/lib/login-brands";
import { toast } from "sonner";

function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return "U";
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

export const GarriguesUserMenu = forwardRef<HTMLButtonElement>((_props, ref) => {
  const { user, logout, signIn } = useAuth();
  const { roleCode } = useTenantContext();
  const branding = useTenantBranding();

  const fullName =
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split("@")[0] : "Usuario");

  const email = user?.email || "";
  const initials = getInitials(fullName || email);

  const roleText = roleCode ? ROLE_LABELS[roleCode] ?? roleCode : "Secretaría General";
  const orgText = brandName(branding);
  const subtitle = `${roleText} — ${orgText}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={`Menú de usuario: ${fullName}`}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] transition-colors hover:border-[var(--g-brand-3308)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="garrigues-module w-64 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-1.5 shadow-lg"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <DropdownMenuLabel className="px-2 py-1.5">
          <div className="font-semibold text-[13px] text-[var(--g-text-primary)]">
            {fullName}
          </div>
          {email && (
            <div className="truncate text-[11px] text-[var(--g-text-secondary)]">
              {email}
            </div>
          )}
          <div className="mt-1 text-[10px] font-medium text-[var(--g-brand-3308)]">
            {subtitle}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 bg-[var(--g-border-subtle)]" />

        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[13px] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <UserIcon className="h-4 w-4 text-[var(--g-text-secondary)]" />
          <span>Mi perfil</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[13px] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Settings className="h-4 w-4 text-[var(--g-text-secondary)]" />
          <span>Configuración</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-[var(--g-border-subtle)]" />

        <DropdownMenuItem
          onClick={async () => {
            try {
              const target = resolveLoginBrand("");
              toast.info(`Cambiando a entorno ${target.nombre}...`);
              await logout();
              const { error } = await signIn(target.demoEmail, target.demoPassword);
              if (error) {
                toast.error(`Error al cambiar: ${error.message}`);
                return;
              }
              toast.success(`Conectado a ${target.nombre}`);
              window.location.href = target.defaultPath;
            } catch (e) {
              console.error(e);
            }
          }}
          className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[13px] text-[var(--g-text-primary)] font-medium transition-colors hover:bg-[var(--g-surface-subtle)] focus:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8112D]" />
          <span>Cambiar a Entorno Corporativo</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 bg-[var(--g-border-subtle)]" />

        <DropdownMenuItem
          onClick={() => logout()}
          className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[13px] text-[var(--status-error)] transition-colors hover:bg-[var(--g-surface-subtle)] focus:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

GarriguesUserMenu.displayName = "GarriguesUserMenu";
