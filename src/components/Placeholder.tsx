import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Construction } from "lucide-react";

interface PlaceholderProps {
  title: string;
  subtitle?: string;
}

export function Placeholder({ title, subtitle }: PlaceholderProps) {
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <Card className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Construction className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {subtitle ?? "Este módulo se implementará en la siguiente iteración. La estructura, datos y permisos están preparados."}
          </p>
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/"><ArrowLeft className="h-4 w-4" />Volver al Dashboard</Link>
        </Button>
      </Card>
    </div>
  );
}
