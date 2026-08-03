import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";

export interface EADInterpositionRecipient {
  personId: string;
  email: string;
}

export interface CreateEADInterpositionDraftInput {
  entityId: string;
  bodyId: string;
  agreementId?: string | null;
  subject: string;
  body: string;
  recipients: EADInterpositionRecipient[];
  sourceDomain: "NO_SESSION_RESOLUTION";
  sourceId: string;
}

/**
 * Resultado deliberadamente limitado a hechos que TGMS puede acreditar.
 * El alta no llama al proveedor, no programa un envío y no genera una prueba
 * de entrega o custodia EAD Trust.
 */
export interface EADInterpositionDraftResult {
  ok: true;
  communicationId: string;
  status: "BORRADOR";
  providerInteraction: false;
  deliveryProven: false;
  providerArchiveProven: false;
}

async function sha512Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-512", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Entrada canónica de nuevas capturas EAD.
 *
 * Persiste un borrador gobernado de interposición y mensajería básica. El
 * servidor impone estado BORRADOR, canal físico neutro y ausencia de fechas,
 * dispatcher, firma, ERDS o interacción con el proveedor. La activación real
 * de Notice Manager/Evidence Manager requerirá un contrato y un adaptador
 * server-side acreditados; el navegador nunca puede inventar esos hechos.
 */
export function useEADInterpositionCommunication() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const createInterpositionDraft = useMutation<
    EADInterpositionDraftResult,
    Error,
    CreateEADInterpositionDraftInput
  >({
    mutationFn: async (input) => {
      if (!tenantId) throw new Error("No hay un tenant activo para registrar la comunicación.");
      if (!input.entityId || !input.bodyId || !input.sourceId) {
        throw new Error("Falta el origen societario de la comunicación.");
      }

      const recipients = input.recipients.map((recipient) => ({
        personId: recipient.personId.trim(),
        email: recipient.email.trim(),
      }));
      if (recipients.some((recipient) => !recipient.personId || !recipient.email)) {
        throw new Error("El censo contiene una persona sin identificador o sin dirección electrónica.");
      }
      if (new Set(recipients.map((recipient) => recipient.personId)).size !== recipients.length) {
        throw new Error("El censo contiene destinatarios duplicados.");
      }
      if (recipients.length === 0) {
        throw new Error("No hay destinatarios vigentes con dirección electrónica.");
      }

      const bodyHashSha512 = await sha512Hex(input.body);
      const { data: communicationId, error } = await supabase.rpc(
        "fn_create_ead_interposition_draft",
        {
          p_comm: {
            tenant_id: tenantId,
            entity_id: input.entityId,
            body_id: input.bodyId,
            agreement_id: input.agreementId ?? null,
            asunto: input.subject,
            cuerpo_render: input.body,
            cuerpo_hash_sha512: bodyHashSha512,
            source_domain: input.sourceDomain,
            source_id: input.sourceId,
          },
          p_recipients: recipients.map((recipient) => ({
            person_id: recipient.personId,
            destino_primario: recipient.email,
          })),
        },
      );

      if (error || !communicationId) {
        throw new Error(error?.message ?? "No se pudo registrar el borrador de interposición EAD.");
      }

      return {
        ok: true,
        communicationId: communicationId as string,
        status: "BORRADOR",
        providerInteraction: false,
        deliveryProven: false,
        providerArchiveProven: false,
      };
    },
    onSuccess: ({ communicationId }) => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      queryClient.invalidateQueries({ queryKey: ["communication", communicationId] });
    },
  });

  return { createInterpositionDraft };
}

/** @deprecated Conservado solo para imports históricos; no representa ERDS. */
export const useERDSNotification = useEADInterpositionCommunication;
