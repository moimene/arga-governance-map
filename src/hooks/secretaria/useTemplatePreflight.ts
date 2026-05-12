/**
 * Hook read-only para el paso 3 del wizard de importación.
 *
 * No escribe en Supabase: solo parsea el JSON, carga contexto Gate PRE y
 * devuelve el resultado para que el usuario decida si corrige o reconoce
 * warnings antes del paso explícito de creación del borrador.
 */

import { useMutation } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import {
  runTemplateImportPreflight,
  type TemplateImportPreflightResult,
} from "@/lib/secretaria/template-admin/import-preflight";

export type TemplatePreflightRequest = { json: unknown };
export type TemplatePreflightResult = TemplateImportPreflightResult;

export function useTemplatePreflight() {
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (req: TemplatePreflightRequest): Promise<TemplatePreflightResult> => {
      if (!tenantId) throw new Error("tenantId requerido");
      return runTemplateImportPreflight({
        json: req.json,
        tenantId,
        requireWarningAck: false,
      });
    },
  });
}
