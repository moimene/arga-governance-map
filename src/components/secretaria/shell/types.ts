import type {
  VisibleSecretariaNavGroup,
  VisibleSecretariaNavItem,
} from "@/lib/secretaria/sidebar-visibility";

export type SecretariaMode = "grupo" | "sociedad";

export interface SecretariaEntityOption {
  id: string;
  name: string;
  legalName: string;
  jurisdiction: string;
  legalForm: string;
  status: string;
  materiality: string;
}

/**
 * Item de navegación visible (mismo contrato que el legacy SecretariaNavItem
 * pero con campo opcional `visibility` que el sidebar centralizado evalúa).
 */
export type SecretariaNavItem = VisibleSecretariaNavItem;
export type SecretariaNavGroup = VisibleSecretariaNavGroup;

export interface SecretariaScopeController {
  mode: SecretariaMode;
  selectedEntity: SecretariaEntityOption | null;
  entities: SecretariaEntityOption[];
  isLoadingEntities: boolean;
  currentSection: string;
  setMode: (mode: SecretariaMode) => void;
  setEntity: (entityId: string) => void;
  createScopedTo: (to: string) => string;
}
