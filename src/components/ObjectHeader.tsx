import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

export interface Crumb { label: string; to?: string }

interface ObjectHeaderProps {
  crumbs: Crumb[];
  title: string;
  badges?: ReactNode;
  metadata?: ReactNode;
  owner?: ReactNode;
  actions?: ReactNode;
}

export function ObjectHeader({ crumbs, title, badges, metadata, owner, actions }: ObjectHeaderProps) {
  return (
    <>
      <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span className="text-foreground">{c.label}</span>}
          </span>
        ))}
      </nav>
      <Card className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {metadata && <div className="mt-1 text-sm text-muted-foreground">{metadata}</div>}
            {owner && <div className="mt-3 text-sm">{owner}</div>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>}
        </div>
      </Card>
    </>
  );
}
