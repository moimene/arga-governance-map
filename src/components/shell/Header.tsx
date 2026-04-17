import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { ScopeNotice } from "./ScopeNotice";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";
import { Link, useLocation } from "react-router-dom";

export function Header() {
  const { pathname } = useLocation();
  const showNotice = pathname !== "/";
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-card px-5">
      <Link to="/" className="flex items-center gap-1.5 text-[20px] leading-none">
        <span className="font-bold text-primary">ARGA</span>
        <span className="font-medium text-muted-foreground">Seguros</span>
      </Link>

      <div className="ml-2"><ScopeSwitcher /></div>
      {showNotice && <ScopeNotice />}

      <div className="ml-2"><GlobalSearch /></div>

      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell />
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <CircleHelp className="h-5 w-5 text-muted-foreground" />
        </Button>
        <div className="ml-2"><UserMenu /></div>
      </div>
    </header>
  );
}
