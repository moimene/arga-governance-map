import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "./StatusBadge";
import type { ComponentProps } from "react";

const tooltipMap: Record<string, string> = {
  // Policy lifecycle
  "VIGENTE": "La política está en vigor. Revisión próxima: ver fecha en la columna.",
  "EN REVISIÓN": "La política está siendo revisada. Se espera nueva versión antes de la fecha indicada.",
  "PENDIENTE APROBACIÓN": "El texto está consolidado. Pendiente de aprobación por el Consejo de Administración.",
  "BORRADOR": "Documento en elaboración. No tiene efectos jurídicos hasta su aprobación.",
  // Finding severity
  "CRÍTICA": "Severidad máxima. Requiere atención inmediata y escalado a dirección.",
  "ALTA": "Severidad alta. Acción correctiva en <30 días.",
  "MEDIA": "Severidad media. Acción correctiva en <90 días.",
  "BAJA": "Severidad baja. Acción correctiva en el siguiente ciclo de revisión.",
  // Materiality
  "Crítica": "Entidad sistémica del grupo. Impacto en solvencia consolidada.",
  "Alta": "Entidad de importancia significativa. Supervisión reforzada.",
  "Media": "Entidad con relevancia operativa moderada.",
  "Baja": "Entidad de impacto limitado. Supervisión estándar.",
  // Coverage
  "SIN COBERTURA": "No hay ningún control asignado. Esta obligación está totalmente desprotegida.",
  "PARCIAL": "El control asignado no cubre completamente la obligación. Revisar evidencias.",
  "COMPLETA": "La obligación está cubierta con controles validados.",
};

type Props = ComponentProps<typeof StatusBadge> & { tip?: string };

export function StatusBadgeTip({ tip, label, ...rest }: Props) {
  const text = tip ?? tooltipMap[label];
  if (!text) return <StatusBadge label={label} {...rest} />;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex"><StatusBadge label={label} {...rest} /></span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
