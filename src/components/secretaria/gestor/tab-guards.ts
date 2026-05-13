/**
 * RBAC por tab para la consola unificada del Gestor de Plantillas.
 *
 * - READ_ROLES (SECRETARIO / COMPLIANCE / ADMIN_TENANT) tienen acceso a las
 *   tabs de lectura (Dashboard, Catálogo, Cobertura legal, Métricas,
 *   Auditoría).
 * - WRITE_ROLES (ADMIN_TENANT) tienen acceso a las tabs que escriben o
 *   ejecutan procesos sensibles (Importar, Validación, Configuración).
 *
 * Si el usuario no tiene rol asignado todavía (carga inicial), `visibleTabs`
 * está vacío y el shell debe redirigir a Dashboard o mostrar fallback.
 *
 * Sprint 1 — Task 5.2.
 */
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";

export type TabId =
  | "dashboard"
  | "catalogo"
  | "cobertura"
  | "importar"
  | "metricas"
  | "auditoria"
  | "validacion"
  | "configuracion";

export const TAB_LABELS: Record<TabId, string> = {
  dashboard: "Dashboard",
  catalogo: "Catálogo",
  cobertura: "Cobertura legal",
  importar: "Importar",
  metricas: "Métricas",
  auditoria: "Auditoría",
  validacion: "Validación",
  configuracion: "Configuración",
};

const READ_ROLES = ["SECRETARIO", "COMPLIANCE", "ADMIN_TENANT"] as const;
const WRITE_ROLES = ["ADMIN_TENANT"] as const;

export const TAB_PERMISSIONS: Record<TabId, readonly string[]> = {
  dashboard: READ_ROLES,
  catalogo: READ_ROLES,
  cobertura: READ_ROLES,
  metricas: READ_ROLES,
  auditoria: READ_ROLES,
  importar: WRITE_ROLES,
  validacion: WRITE_ROLES,
  configuracion: WRITE_ROLES,
};

export interface UseTabAccessResult {
  /** Devuelve true si el rol actual puede acceder a la pestaña indicada. */
  canAccess: (tab: TabId) => boolean;
  /** Lista de pestañas visibles para el rol actual, en orden declarado. */
  visibleTabs: TabId[];
  /** Carga inicial de identidad (auth + rbac). */
  isLoading: boolean;
}

export function useTabAccess(): UseTabAccessResult {
  const { user, loading: userLoading } = useCurrentUser();
  const { roles, isLoading: rolesLoading } = useUserRole(user?.id);

  const canAccess = (tab: TabId) =>
    TAB_PERMISSIONS[tab].some((r) => roles.includes(r));

  const visibleTabs: TabId[] = (Object.keys(TAB_PERMISSIONS) as TabId[]).filter(canAccess);

  return {
    canAccess,
    visibleTabs,
    isLoading: userLoading || rolesLoading,
  };
}
