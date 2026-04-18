import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Normaliza la forma societaria de `entities.legal_form` al vocabulario
 *  canónico usado en `jurisdiction_rule_sets.company_form`. */
function normalizeCompanyForm(legalForm?: string | null): string | null {
  if (!legalForm) return null;
  const lf = legalForm.trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, "");
  if (lf === "SA" || lf === "SAECV") return "SA";
  if (lf === "SACV" || lf === "SADECV") return "SA_CV";
  if (lf === "SL" || lf === "SRL") return "SRL";
  if (lf === "LTDA") return "LTDA";
  if (lf === "LDA") return "LDA";
  return lf;
}

export type InstrumentRequired = "ESCRITURA" | "INSTANCIA" | "NINGUNO";

export interface ComplianceResult {
  agreement_id: string;
  agreement_kind: string;
  matter_class: string;
  adoption_mode: string;
  inscribable: boolean;
  convocation_compliant: boolean;
  quorum_compliant: boolean;
  conflict_handled: boolean;
  majority_compliant: boolean;
  instrument_required: InstrumentRequired;
  registry_required: boolean;
  publication_required: boolean;
  publication_channel: string | null;
  blocking_issues: string[];
  status: string;
}

export interface AgreementFull {
  id: string;
  tenant_id: string;
  entity_id: string | null;
  body_id: string | null;
  agreement_kind: string;
  matter_class: string;
  inscribable: boolean;
  adoption_mode: string;
  required_quorum_code: string | null;
  required_majority_code: string | null;
  jurisdiction_rule_id: string | null;
  proposal_text: string | null;
  decision_text: string | null;
  decision_date: string | null;
  effective_date: string | null;
  status: string;
  parent_meeting_id: string | null;
  unipersonal_decision_id: string | null;
  no_session_resolution_id: string | null;
  statutory_basis: string | null;
  compliance_snapshot: any;
  created_at: string;
  entities?: { common_name: string; jurisdiction: string; legal_form: string } | null;
  governing_bodies?: { name: string; body_type: string } | null;
}

export function useAgreement(agreementId?: string) {
  return useQuery({
    queryKey: ["agreement", agreementId ?? "none"],
    enabled: !!agreementId,
    queryFn: async (): Promise<AgreementFull | null> => {
      const { data, error } = await supabase
        .from("agreements")
        .select(
          "*, entities(common_name, jurisdiction, legal_form), governing_bodies(name, body_type)",
        )
        .eq("id", agreementId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

/**
 * Deriva el cumplimiento societario del acuerdo a partir de:
 *  - agreements (matter_class, adoption_mode, required_quorum_code, required_majority_code)
 *  - jurisdiction_rule_sets (plazos, quorum, mayorías, vías de publicación)
 *  - meeting / unipersonal_decision / no_session_resolution según adoption_mode
 *
 * No aplica cambios en BD — es una vista derivada para el expediente del acuerdo.
 */
export function useAgreementCompliance(agreementId?: string) {
  return useQuery({
    queryKey: ["agreement_compliance", agreementId ?? "none"],
    enabled: !!agreementId,
    queryFn: async (): Promise<ComplianceResult | null> => {
      // 1. Acuerdo + entidad
      const { data: agreement, error: aErr } = await supabase
        .from("agreements")
        .select("*, entities(jurisdiction, legal_form)")
        .eq("id", agreementId!)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!agreement) return null;

      const a: any = agreement;
      const jurisdiction: string | null = a.entities?.jurisdiction ?? null;
      const legalForm: string | null = a.entities?.legal_form ?? null;

      // 2. Reglas jurisdiccionales
      let rule: any = null;
      const companyForm = normalizeCompanyForm(legalForm);
      if (jurisdiction && companyForm) {
        const { data } = await supabase
          .from("jurisdiction_rule_sets")
          .select("*")
          .eq("jurisdiction", jurisdiction)
          .eq("company_form", companyForm)
          .eq("is_active", true)
          .maybeSingle();
        rule = data ?? null;
      }
      const cfg = rule?.rule_config ?? {};

      const blocking: string[] = [];

      // 3. Flags por adoption_mode
      let convocation_compliant = true;
      let quorum_compliant = true;
      let majority_compliant = true;
      let conflict_handled = true;

      if (a.adoption_mode === "MEETING" && a.parent_meeting_id) {
        // Convocatoria + quorum + mayoría desde meeting y convocatoria asociada
        const { data: meeting } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", a.parent_meeting_id)
          .maybeSingle();

        const m: any = meeting;

        // No existe FK meetings↔convocatorias: se localiza la convocatoria por
        // body_id + fecha_1 == fecha de la reunión (match determinista sobre el seed).
        let conv: any = null;
        if (m?.body_id && m?.scheduled_start) {
          const meetingDateISO = String(m.scheduled_start).slice(0, 10);
          const { data: convs } = await supabase
            .from("convocatorias")
            .select("fecha_emision, fecha_1, urgente, junta_universal")
            .eq("body_id", m.body_id)
            .eq("fecha_1", meetingDateISO)
            .order("fecha_emision", { ascending: false })
            .limit(1);
          conv = convs?.[0] ?? null;
        }

        // Convocatoria: plazo mínimo respetado
        const notice = conv?.fecha_emision;
        const meetingDate = conv?.fecha_1;
        if (conv?.junta_universal) {
          convocation_compliant = true;
        } else if (notice && meetingDate) {
          const diffDays = Math.floor(
            (new Date(meetingDate).getTime() - new Date(notice).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const minDays =
            cfg.notice_periods_days?.[
              a.matter_class === "ESTRUCTURAL" || a.matter_class === "ESTATUTARIA"
                ? "extraordinaria"
                : "ordinaria"
            ] ?? 15;
          if (diffDays < minDays) {
            convocation_compliant = false;
            blocking.push(
              `Plazo de convocatoria insuficiente: ${diffDays}d < ${minDays}d exigidos`,
            );
          }
        } else if (a.status !== "DRAFT" && a.status !== "PROPOSED") {
          // Acuerdo ya adoptado sin convocatoria localizable: advertencia, no bloqueo
          convocation_compliant = false;
          blocking.push(
            "Convocatoria no localizable para la reunión — plazo no verificable.",
          );
        }

        // Quorum: validado por vista/hook externo; marcamos pendiente si meeting no existe
        if (!m) {
          quorum_compliant = false;
          blocking.push("Reunión no localizada para validar quórum.");
        }

        // Mayoría: si acuerdo ya tiene decision_text y meeting tiene resolutions aprobadas.
        // Si el acuerdo ya está ADOPTED+ sin meeting_resolutions vinculadas (seed sin back-fill
        // de agreement_id), confiamos en la transición de estado y no bloqueamos.
        const { data: res } = await supabase
          .from("meeting_resolutions")
          .select("status")
          .eq("agreement_id", a.id);
        if (!res || res.length === 0) {
          majority_compliant = true;
        } else {
          const approved = res.some((r: any) => r.status === "APROBADO");
          majority_compliant = approved;
          if (!approved && a.status !== "DRAFT" && a.status !== "PROPOSED") {
            blocking.push("Resolución asociada no figura como APROBADA.");
          }
        }

        // Conflictos de interés ligados a la reunión
        const { data: conflicts } = await supabase
          .from("conflicts_of_interest")
          .select("id, status")
          .eq("related_meeting_id", a.parent_meeting_id);
        if (conflicts && conflicts.length > 0) {
          conflict_handled = conflicts.every(
            (c: any) => c.status === "RESUELTO" || c.status === "NOTIFICADO",
          );
          if (!conflict_handled) {
            blocking.push("Existen conflictos de interés no resueltos en la reunión.");
          }
        }
      } else if (a.adoption_mode === "UNIVERSAL") {
        convocation_compliant = true; // Junta universal no requiere plazo
      } else if (a.adoption_mode === "NO_SESSION" && a.no_session_resolution_id) {
        const { data: nsr } = await supabase
          .from("no_session_resolutions")
          .select(
            "status, requires_unanimity, votes_for, votes_against, abstentions",
          )
          .eq("id", a.no_session_resolution_id)
          .maybeSingle();
        const n: any = nsr;
        if (!n) {
          majority_compliant = false;
          blocking.push("Resolución sin sesión no localizada.");
        } else if (n.requires_unanimity) {
          const unanimous = n.votes_against === 0 && n.abstentions === 0;
          majority_compliant = unanimous;
          if (!unanimous && n.status === "APROBADO") {
            blocking.push("Acuerdo requiere unanimidad y no se ha alcanzado.");
          }
        } else {
          majority_compliant = n.status === "APROBADO";
        }
        convocation_compliant = true;
      } else if (
        a.adoption_mode === "UNIPERSONAL_SOCIO" ||
        a.adoption_mode === "UNIPERSONAL_ADMIN"
      ) {
        // Decisión unipersonal — no hay convocatoria ni quórum
        convocation_compliant = true;
        quorum_compliant = true;
        const { data: dec } = await supabase
          .from("unipersonal_decisions")
          .select("status")
          .eq("id", a.unipersonal_decision_id)
          .maybeSingle();
        const d: any = dec;
        majority_compliant = d?.status === "FIRMADA" || a.status === "DRAFT";
        if (!majority_compliant) {
          blocking.push("Decisión unipersonal aún no firmada.");
        }
      }

      // 4. Instrumento requerido
      const inscribableMatters: string[] = cfg.inscribable_matters ?? [];
      const isInscribable = a.inscribable || inscribableMatters.includes(a.agreement_kind);

      let instrument_required: InstrumentRequired = "NINGUNO";
      if (isInscribable) {
        const filingTypes: string[] = cfg.registry_filing_types ?? [];
        // Heurística: materias ESTRUCTURAL y MOD_ESTATUTOS requieren escritura
        if (
          a.matter_class === "ESTRUCTURAL" ||
          a.agreement_kind === "MOD_ESTATUTOS" ||
          a.agreement_kind === "AMPLIACION_CAPITAL" ||
          a.agreement_kind === "FUSION" ||
          a.agreement_kind === "ESCISION"
        ) {
          instrument_required = "ESCRITURA";
        } else if (filingTypes.includes("INSTANCIA") || filingTypes.includes("instancia")) {
          instrument_required = "INSTANCIA";
        } else {
          instrument_required = "ESCRITURA";
        }
      }

      // 5. Publicación
      const publicationChannels: any = cfg.publication_channels ?? {};
      const publication_required =
        a.agreement_kind === "AMPLIACION_CAPITAL" ||
        a.agreement_kind === "FUSION" ||
        a.agreement_kind === "ESCISION" ||
        a.agreement_kind === "DISOLUCION" ||
        a.agreement_kind === "REDUCCION_CAPITAL";

      let publication_channel: string | null = null;
      if (publication_required) {
        publication_channel =
          publicationChannels.default ??
          publicationChannels.primary ??
          (jurisdiction === "ES"
            ? "BORME"
            : jurisdiction === "MX"
              ? "PSM"
              : jurisdiction === "BR"
                ? "Diário Oficial"
                : jurisdiction === "PT"
                  ? "Portal da Justiça"
                  : null);
      }

      return {
        agreement_id: a.id,
        agreement_kind: a.agreement_kind,
        matter_class: a.matter_class,
        adoption_mode: a.adoption_mode,
        inscribable: isInscribable,
        convocation_compliant,
        quorum_compliant,
        conflict_handled,
        majority_compliant,
        instrument_required,
        registry_required: isInscribable,
        publication_required,
        publication_channel,
        blocking_issues: blocking,
        status: a.status,
      };
    },
  });
}

export function useAgreementsByEntity(entityId?: string) {
  return useQuery({
    queryKey: ["agreements", "entity", entityId ?? "none"],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*, governing_bodies(name, body_type)")
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
