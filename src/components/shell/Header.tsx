import { CircleHelp, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { ScopeNotice } from "./ScopeNotice";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";
import { Link, useLocation } from "react-router-dom";
import { useSidebarMobile } from "./useSidebarMobile";

export function Header() {
  const { pathname } = useLocation();
  const showNotice = pathname !== "/";
  const { toggle } = useSidebarMobile();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b border-border bg-card px-3 sm:px-5">
      <button
        type="button"
        onClick={toggle}
        aria-label="Abrir menú de navegación"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link to="/" className="flex items-center gap-1.5 text-[20px] leading-none">
        <span className="font-bold text-primary">ARGA</span>
        <span className="hidden sm:inline font-medium text-muted-foreground">Seguros</span>
      </Link>

      <div className="ml-2 hidden sm:block"><ScopeSwitcher /></div>
      {showNotice && <div className="hidden lg:block"><ScopeNotice /></div>}

      <div className="ml-2 hidden md:block"><GlobalSearch /></div>

      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell />
        <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:inline-flex">
          <CircleHelp className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div className="ml-1 sm:ml-2"><UserMenu /></div>
      </div>
    </header>
  );
}
