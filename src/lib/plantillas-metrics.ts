/**
 * Pure plantillas metrics computation utility
 * No Supabase dependencies — testable in isolation
 */

export interface PlantillaProtegidaRow {
  id: string;
  tipo: string;
  adoption_mode: string | null;
  estado: string;
  created_at: string;
  fecha_aprobacion?: string | null;
}

export interface LeadingMetrics {
  velocidadRedaccion: number; // avg days from BORRADOR to APROBADA/ACTIVA
  ratioRetroceso: number; // % of templates that went backwards (hardcoded to 0 for now)
  brechaDisponibilidad: number; // % of templates NOT in ACTIVA state
  tiempoEnEstado: Record<string, number>; // avg days in current state per template
  coberturaModos: number; // % of adoption modes covered by ACTIVA templates
}

export interface LaggingMetrics {
  totalActivas: number;
  totalBorradores: number;
  totalAprobadas: number;
}

export interface PlantillasMetricsResult {
  leading: LeadingMetrics;
  lagging: LaggingMetrics;
  alertas: Array<{
    tipo: 'WARNING' | 'ERROR';
    mensaje: string;
    plantilla_id?: string;
  }>;
}

/**
 * Calculate days between two ISO date strings
 */
function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Compute all leading and lagging metrics for a set of plantillas
 */
export function computePlantillasMetrics(
  plantillas: PlantillaProtegidaRow[]
): PlantillasMetricsResult {
  const now = new Date().toISOString();
  const alertas: Array<{ tipo: 'WARNING' | 'ERROR'; mensaje: string; plantilla_id?: string }> =
    [];

  // ============================================================================
  // LAGGING METRICS (simple counts by status)
  // ============================================================================

  const lagging: LaggingMetrics = {
    totalActivas: plantillas.filter((p) => p.estado === 'ACTIVA').length,
    totalBorradores: plantillas.filter((p) => p.estado === 'BORRADOR').length,
    totalAprobadas: plantillas.filter((p) => p.estado === 'APROBADA').length,
  };

  // ============================================================================
  // LEADING METRICS
  // ============================================================================

  // 1. velocidadRedaccion: avg days from created_at to fecha_aprobacion for APROBADA/ACTIVA
  let velocidadRedaccion = 0;
  const approvableTemplates = plantillas.filter((p) =>
    ['APROBADA', 'ACTIVA'].includes(p.estado)
  );
  if (approvableTemplates.length > 0) {
    const totalDays = approvableTemplates.reduce((sum, p) => {
      const approvalDate = p.fecha_aprobacion || p.created_at; // fallback if no explicit approval
      const days = daysBetween(p.created_at, approvalDate);
      return sum + days;
    }, 0);
    velocidadRedaccion = Math.round(totalDays / approvableTemplates.length);
  }

  // 2. ratioRetroceso: 0 for now (would need audit trail)
  const ratioRetroceso = 0;

  // 3. brechaDisponibilidad: % of templates NOT in ACTIVA state
  let brechaDisponibilidad = 1.0; // 100% unavailable by default
  if (plantillas.length > 0) {
    const activasCount = lagging.totalActivas;
    brechaDisponibilidad = 1.0 - activasCount / plantillas.length;
  }

  // 4. tiempoEnEstado: days since last status change per template
  const tiempoEnEstado: Record<string, number> = {};
  plantillas.forEach((p) => {
    const changeDate = p.fecha_aprobacion || p.created_at;
    const days = daysBetween(changeDate, now);
    tiempoEnEstado[p.id] = days;
  });

  // 5. coberturaModos: % of adoption modes with at least one ACTIVA template
  const ADOPTION_MODES = ['MEETING', 'UNIVERSAL', 'NO_SESSION', 'UNIPERSONAL_SOCIO', 'UNIPERSONAL_ADMIN'];
  const activeTemplates = plantillas.filter((p) => p.estado === 'ACTIVA');
  const coveredModes = new Set<string>();
  activeTemplates.forEach((p) => {
    if (p.adoption_mode) {
      coveredModes.add(p.adoption_mode);
    }
  });
  const coberturaModos = ADOPTION_MODES.length > 0 ? coveredModes.size / ADOPTION_MODES.length : 0;

  const leading: LeadingMetrics = {
    velocidadRedaccion,
    ratioRetroceso,
    brechaDisponibilidad,
    tiempoEnEstado,
    coberturaModos,
  };

  // ============================================================================
  // ALERT GENERATION
  // ============================================================================

  // Alert 1: WARNING if coberturaModos < 80%
  if (coberturaModos < 0.8) {
    alertas.push({
      tipo: 'WARNING',
      mensaje: `Cobertura de modos de adopción ${Math.round(coberturaModos * 100)}% — inferior al 80%`,
    });
  }

  // Alert 2: ERROR if any template in BORRADOR for > 30 days
  plantillas.forEach((p) => {
    if (p.estado === 'BORRADOR') {
      const days = tiempoEnEstado[p.id];
      if (days > 30) {
        alertas.push({
          tipo: 'ERROR',
          mensaje: `Plantilla ${p.tipo} lleva ${days} días en borrador`,
          plantilla_id: p.id,
        });
      }
    }
  });

  // Alert 3: WARNING if brechaDisponibilidad > 50%
  if (brechaDisponibilidad > 0.5) {
    alertas.push({
      tipo: 'WARNING',
      mensaje: `Más del 50% de plantillas no están activas (${Math.round(brechaDisponibilidad * 100)}%)`,
    });
  }

  return {
    leading,
    lagging,
    alertas,
  };
}
