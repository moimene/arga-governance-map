import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Bell, BookOpen, FileSignature,
  Users, FileText, Library, ChevronLeft, Gavel,
  ScrollText, Building2, Layers, Briefcase, Calendar, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/secretaria/GlobalSearch";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard",                to: "/secretaria",                          icon: LayoutDashboard, end: true },
  { label: "Board Pack",               to: "/secretaria/board-pack",               icon: Briefcase },
  { label: "Convocatorias",            to: "/secretaria/convocatorias",            icon: Bell },
  { label: "Reuniones",                to: "/secretaria/reuniones",                icon: Users },
  { label: "Actas",                    to: "/secretaria/actas",                    icon: FileSignature },
  { label: "Decisiones unipersonales", to: "/secretaria/decisiones-unipersonales", icon: Building2 },
  { label: "Acuerdos sin sesión",      to: "/secretaria/acuerdos-sin-sesion",      icon: ScrollText },
  { label: "Tramitador registral",     to: "/secretaria/tramitador",               icon: Gavel },
  { label: "Libros obligatorios",      to: "/secretaria/libros",                   icon: Library },
  { label: "Plantillas",               to: "/secretaria/plantillas",               icon: FileText },
  { label: "Gestor plantillas",        to: "/secretaria/gestor-plantillas",        icon: Layers },
  { label: "Calendario",               to: "/secretaria/calendario",               icon: Calendar },
  { label: "Multi-jurisdicción",        to: "/secretaria/multi-jurisdiccion",       icon: Globe },
];

export function SecretariaLayout() {
  const navigate = useNavigate();

  return (
    <div
      className="garrigues-module flex min-h-screen w-full"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      {/* Sidebar Garrigues */}
      <aside className="flex w-[220px] shrink-0 flex-col bg-[hsl(var(--sidebar-background))]">
        {/* Module header */}
        <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--sidebar-border))] px-4">
          <BookOpen className="h-5 w-5 text-[hsl(var(--sidebar-foreground))]" />
          <span className="text-sm font-bold tracking-wide text-[hsl(var(--sidebar-foreground))]">
            Secretaría
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <GlobalSearch />
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "mb-0.5 flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-[hsl(var(--sidebar-accent))] font-semibold text-[hsl(var(--sidebar-foreground))]"
                      : "text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))]"
                  )
                }
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Back to TGMS */}
        <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Volver al shell TGMS"
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[hsl(var(--sidebar-foreground))]/70 transition-colors hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Volver a TGMS</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-[var(--g-surface-page)]">
        {/* Breadcrumb bar */}
        <div className="flex h-10 items-center gap-2 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-6 text-[12px] text-[var(--g-text-secondary)]">
          <span>TGMS</span>
          <span>›</span>
          <span className="font-semibold text-[var(--g-brand-3308)]">Secretaría Societaria</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
