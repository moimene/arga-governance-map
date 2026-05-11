/**
 * Hook `useReclassifyAgendaItemKind` (v1.3).
 *
 * Spec: docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md §7.1
 * Plan: docs/superpowers/plans/2026-05-12-agenda-item-kind-implementation.md Task 5
 *
 * Mutation que reclasifica `agenda_items.kind`. Pipeline:
 *  1) RBAC: solo SECRETARIO (v1.0 simplificado; v1.1 hace check por reunión).
 *  2) Resuelve meta de reunión (status, body_type via JOIN, is_universal via
 *     `quorum_data.is_universal`).
 *  3) Lee current kind del punto.
 *  4) Aplica matriz P7 (`checkReclassificationAllowed`).
 *  5) RPC `set_kind_change_context(p_motivo, p_user_id)` → setea session vars
 *     ANTES del UPDATE para que trigger T3 capture autor + motivo en
 *     `agenda_item_kind_changelog`.
 *  6) UPDATE `agenda_items.kind`.
 *  7) Invalida queries: `agenda_items[meeting_id]` y `agenda_item_kind_changelog[id]`.
 *
 * CHECK BD: `motivo` mínimo 3 caracteres — el cliente puede validar antes,
 * pero el trigger T3 fallará si no se cumple.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import type { AgendaItemKind } from "@/lib/secretaria/agenda-kind";
import {
  checkReclassificationAllowed,
  type OrganType,
} from "@/lib/secretaria/reclassification-matrix";

interface ReclassifyParams {
  agendaItemId: string;
  meetingId: string;
  newKind: AgendaItemKind;
  /** Mínimo 3 caracteres (CHECK BD). */
  motivo: string;
}

type MeetingMetaRow = {
  status: string | null;
  quorum_data: { is_universal?: boolean } | null;
  governing_bodies?: { body_type?: string | null } | null;
};

type AgendaItemKindRow = {
  kind: string | null;
};

export function useReclassifyAgendaItemKind() {
  const { user } = useCurrentUser();
  const { roles } = useUserRole(user?.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReclassifyParams) => {
      // 0. Sanity: usuario autenticado
      if (!user?.id) {
        throw new Error("401: usuario no autenticado");
      }

      // 0b. Motivo sanity (mejor UX antes que esperar al CHECK BD)
      if (!params.motivo || params.motivo.trim().length < 3) {
        throw new Error("motivo: mínimo 3 caracteres");
      }

      // 1. RBAC: solo SECRETARIO
      // v1.0 simplificado a check de rol global. v1.1 hace
      // `assertUserIsSecretarioOfMeeting(user.id, meetingId)` con join a
      // `meetings.secretary_id` + condiciones_persona.
      if (!roles.includes("SECRETARIO")) {
        throw new Error(
          "403: solo SECRETARIO del órgano puede reclasificar puntos del orden del día",
        );
      }

      // 2. Resolver meta de reunión (status + organType + isUniversal)
      const { data: meeting, error: mErr } = await supabase
        .from("meetings")
        .select("status, quorum_data, governing_bodies(body_type)")
        .eq("id", params.meetingId)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!meeting) throw new Error(`Meeting ${params.meetingId} no encontrada`);
      const meta = meeting as MeetingMetaRow;

      const organType: OrganType | undefined =
        meta.governing_bodies?.body_type ?? undefined;
      const isUniversal: boolean | undefined =
        meta.quorum_data?.is_universal === true ? true : undefined;

      // 3. Resolver current kind del punto
      const { data: agendaItem, error: aErr } = await supabase
        .from("agenda_items")
        .select("kind")
        .eq("id", params.agendaItemId)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!agendaItem) {
        throw new Error(`agenda_item ${params.agendaItemId} no encontrado`);
      }
      const currentKind = ((agendaItem as AgendaItemKindRow).kind ??
        "DELIBERATIVO") as AgendaItemKind;

      // 4. Aplicar matriz P7
      const matrixCheck = checkReclassificationAllowed({
        meetingStatus: meta.status ?? "DRAFT",
        currentKind,
        newKind: params.newKind,
        organType,
        isUniversal,
      });
      if (!matrixCheck.allowed) {
        throw new Error(`Matriz P7: ${matrixCheck.reason ?? "reclasificación denegada"}`);
      }

      // 5+6. RPC consolidado seguro (Codex P1 #1 v2).
      //
      // Server-side validations dentro del RPC:
      //  - auth.uid() como caller (NO acepta p_user_id forgeable)
      //  - fn_secretaria_assert_tenant_access valida tenant del agenda_item
      //  - rbac_user_roles JOIN rbac_roles valida rol SECRETARIO
      //  - service_role bypasea (scripts/backfill/tests)
      //
      // El RBAC client-side (useUserRole) queda como UX-hint para deshabilitar
      // la UI antes de llamar al RPC, pero NO es la fuente de verdad.
      const { error: rpcError } = await supabase.rpc("reclassify_agenda_item_kind", {
        p_agenda_item_id: params.agendaItemId,
        p_meeting_id: params.meetingId,
        p_new_kind: params.newKind,
        p_motivo: params.motivo,
      });
      if (rpcError) throw rpcError;

      return { agendaItemId: params.agendaItemId, newKind: params.newKind };
    },
    onSuccess: (_data, vars) => {
      // Invalida lista de agenda_items de la reunión + changelog del punto
      queryClient.invalidateQueries({
        queryKey: ["agenda_items", vars.meetingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["agenda_item_kind_changelog", vars.agendaItemId],
      });
    },
  });
}
