import type { LucideIcon } from "lucide-react";

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

export interface SecretariaNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  requiresEntity?: boolean;
  selectedEntityRoute?: boolean;
}

export interface SecretariaNavGroup {
  label: string;
  items: SecretariaNavItem[];
}

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
