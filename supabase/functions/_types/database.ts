export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          created_at: string | null
          due_date: string | null
          finding_id: string
          id: string
          progress_pct: number | null
          responsible_id: string | null
          status: string | null
          tenant_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          due_date?: string | null
          finding_id: string
          id?: string
          progress_pct?: number | null
          responsible_id?: string | null
          status?: string | null
          tenant_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          due_date?: string | null
          finding_id?: string
          id?: string
          progress_pct?: number | null
          responsible_id?: string | null
          status?: string | null
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          meeting_id: string
          order_number: number
          tenant_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          meeting_id: string
          order_number: number
          tenant_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          meeting_id?: string
          order_number?: number
          tenant_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          adoption_mode: string
          agreement_kind: string
          approved_by: string | null
          body_id: string | null
          code: string | null
          compliance_explain: Json | null
          compliance_snapshot: Json | null
          created_at: string
          created_by: string | null
          decision_date: string | null
          decision_text: string | null
          effective_date: string | null
          entity_id: string | null
          evidence_id: string | null
          execution_mode: Json | null
          gate_hash: string | null
          id: string
          inscribable: boolean
          jurisdiction_rule_id: string | null
          legal_hold: boolean | null
          matter_class: string
          no_session_resolution_id: string | null
          parent_meeting_id: string | null
          policy_id: string | null
          proposal_text: string | null
          required_majority_code: string | null
          required_quorum_code: string | null
          retention_policy_id: string | null
          rule_pack_id: string | null
          rule_pack_version: string | null
          status: string
          statutory_basis: string | null
          tenant_id: string
          unipersonal_decision_id: string | null
          updated_at: string
          verified_by: string | null
        }
        Insert: {
          adoption_mode: string
          agreement_kind: string
          approved_by?: string | null
          body_id?: string | null
          code?: string | null
          compliance_explain?: Json | null
          compliance_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          decision_text?: string | null
          effective_date?: string | null
          entity_id?: string | null
          evidence_id?: string | null
          execution_mode?: Json | null
          gate_hash?: string | null
          id?: string
          inscribable?: boolean
          jurisdiction_rule_id?: string | null
          legal_hold?: boolean | null
          matter_class: string
          no_session_resolution_id?: string | null
          parent_meeting_id?: string | null
          policy_id?: string | null
          proposal_text?: string | null
          required_majority_code?: string | null
          required_quorum_code?: string | null
          retention_policy_id?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          status?: string
          statutory_basis?: string | null
          tenant_id: string
          unipersonal_decision_id?: string | null
          updated_at?: string
          verified_by?: string | null
        }
        Update: {
          adoption_mode?: string
          agreement_kind?: string
          approved_by?: string | null
          body_id?: string | null
          code?: string | null
          compliance_explain?: Json | null
          compliance_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          decision_text?: string | null
          effective_date?: string | null
          entity_id?: string | null
          evidence_id?: string | null
          execution_mode?: Json | null
          gate_hash?: string | null
          id?: string
          inscribable?: boolean
          jurisdiction_rule_id?: string | null
          legal_hold?: boolean | null
          matter_class?: string
          no_session_resolution_id?: string | null
          parent_meeting_id?: string | null
          policy_id?: string | null
          proposal_text?: string | null
          required_majority_code?: string | null
          required_quorum_code?: string | null
          retention_policy_id?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          status?: string
          statutory_basis?: string | null
          tenant_id?: string
          unipersonal_decision_id?: string | null
          updated_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreements_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_jurisdiction_rule_id_fkey"
            columns: ["jurisdiction_rule_id"]
            isOneToOne: false
            referencedRelation: "jurisdiction_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_no_session_resolution_id_fkey"
            columns: ["no_session_resolution_id"]
            isOneToOne: false
            referencedRelation: "no_session_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_parent_meeting_id_fkey"
            columns: ["parent_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_retention_policy_id_fkey"
            columns: ["retention_policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_rule_pack_id_fkey"
            columns: ["rule_pack_id"]
            isOneToOne: false
            referencedRelation: "rule_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_unipersonal_decision_id_fkey"
            columns: ["unipersonal_decision_id"]
            isOneToOne: false
            referencedRelation: "unipersonal_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_compliance_checks: {
        Row: {
          checked_at: string | null
          checked_by_id: string | null
          created_at: string | null
          description: string | null
          evidence_url: string | null
          id: string
          requirement_code: string
          requirement_title: string | null
          status: string | null
          system_id: string | null
        }
        Insert: {
          checked_at?: string | null
          checked_by_id?: string | null
          created_at?: string | null
          description?: string | null
          evidence_url?: string | null
          id?: string
          requirement_code: string
          requirement_title?: string | null
          status?: string | null
          system_id?: string | null
        }
        Update: {
          checked_at?: string | null
          checked_by_id?: string | null
          created_at?: string | null
          description?: string | null
          evidence_url?: string | null
          id?: string
          requirement_code?: string
          requirement_title?: string | null
          status?: string | null
          system_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_compliance_checks_checked_by_id_fkey"
            columns: ["checked_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_compliance_checks_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_incidents: {
        Row: {
          closed_at: string | null
          corrective_action: string | null
          description: string | null
          id: string
          reported_at: string | null
          root_cause: string | null
          severity: string | null
          status: string | null
          system_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          closed_at?: string | null
          corrective_action?: string | null
          description?: string | null
          id?: string
          reported_at?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string | null
          system_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          closed_at?: string | null
          corrective_action?: string | null
          description?: string | null
          id?: string
          reported_at?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string | null
          system_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_incidents_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_risk_assessments: {
        Row: {
          assessment_date: string | null
          assessor_id: string | null
          created_at: string | null
          findings: Json | null
          framework: string | null
          id: string
          notes: string | null
          score: number | null
          status: string | null
          system_id: string | null
        }
        Insert: {
          assessment_date?: string | null
          assessor_id?: string | null
          created_at?: string | null
          findings?: Json | null
          framework?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string | null
          system_id?: string | null
        }
        Update: {
          assessment_date?: string | null
          assessor_id?: string | null
          created_at?: string | null
          findings?: Json | null
          framework?: string | null
          id?: string
          notes?: string | null
          score?: number | null
          status?: string | null
          system_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_risk_assessments_assessor_id_fkey"
            columns: ["assessor_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_risk_assessments_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_systems: {
        Row: {
          created_at: string | null
          deployment_date: string | null
          description: string | null
          id: string
          name: string
          owner_id: string | null
          risk_level: string | null
          status: string | null
          system_type: string | null
          tenant_id: string
          use_case: string | null
          vendor: string | null
        }
        Insert: {
          created_at?: string | null
          deployment_date?: string | null
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          risk_level?: string | null
          status?: string | null
          system_type?: string | null
          tenant_id: string
          use_case?: string | null
          vendor?: string | null
        }
        Update: {
          created_at?: string | null
          deployment_date?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          risk_level?: string | null
          status?: string | null
          system_type?: string | null
          tenant_id?: string
          use_case?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_systems_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          agenda_item_index: number | null
          convocatoria_id: string | null
          file_hash: string | null
          file_name: string
          file_url: string
          id: string
          tenant_id: string
          uploaded_at: string
        }
        Insert: {
          agenda_item_index?: number | null
          convocatoria_id?: string | null
          file_hash?: string | null
          file_name: string
          file_url: string
          id?: string
          tenant_id: string
          uploaded_at?: string
        }
        Update: {
          agenda_item_index?: number | null
          convocatoria_id?: string | null
          file_hash?: string | null
          file_name?: string
          file_url?: string
          id?: string
          tenant_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
        ]
      }
      attestations: {
        Row: {
          campaign: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          person_id: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          campaign?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          person_id?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          campaign?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          person_id?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attestations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attestations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string | null
          current_hash: string | null
          delta: Json | null
          hash_sha512: string | null
          id: string
          ip_address: unknown
          legal_hold: boolean | null
          object_id: string | null
          object_type: string | null
          previous_hash: string | null
          record_id: string | null
          retention_until: string | null
          table_name: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          current_hash?: string | null
          delta?: Json | null
          hash_sha512?: string | null
          id?: string
          ip_address?: unknown
          legal_hold?: boolean | null
          object_id?: string | null
          object_type?: string | null
          previous_hash?: string | null
          record_id?: string | null
          retention_until?: string | null
          table_name?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string | null
          current_hash?: string | null
          delta?: Json | null
          hash_sha512?: string | null
          id?: string
          ip_address?: unknown
          legal_hold?: boolean | null
          object_id?: string | null
          object_type?: string | null
          previous_hash?: string | null
          record_id?: string | null
          retention_until?: string | null
          table_name?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      bcm_bia: {
        Row: {
          approved_at: string | null
          created_at: string | null
          entity_id: string | null
          function_name: string
          id: string
          is_critical: boolean | null
          mtd_objective: number | null
          rpo_objective: number | null
          rto_objective: number | null
          tenant_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          entity_id?: string | null
          function_name: string
          id?: string
          is_critical?: boolean | null
          mtd_objective?: number | null
          rpo_objective?: number | null
          rto_objective?: number | null
          tenant_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          entity_id?: string | null
          function_name?: string
          id?: string
          is_critical?: boolean | null
          mtd_objective?: number | null
          rpo_objective?: number | null
          rto_objective?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bcm_bia_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bcm_bia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bcm_plans: {
        Row: {
          bia_id: string | null
          created_at: string | null
          id: string
          last_test_date: string | null
          next_test_date: string | null
          plan_code: string
          plan_type: string | null
          tenant_id: string
          test_result: string | null
        }
        Insert: {
          bia_id?: string | null
          created_at?: string | null
          id?: string
          last_test_date?: string | null
          next_test_date?: string | null
          plan_code: string
          plan_type?: string | null
          tenant_id: string
          test_result?: string | null
        }
        Update: {
          bia_id?: string | null
          created_at?: string | null
          id?: string
          last_test_date?: string | null
          next_test_date?: string | null
          plan_code?: string
          plan_type?: string | null
          tenant_id?: string
          test_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bcm_plans_bia_id_fkey"
            columns: ["bia_id"]
            isOneToOne: false
            referencedRelation: "bcm_bia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bcm_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_holdings: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          entity_id: string
          holder_person_id: string
          id: string
          is_treasury: boolean
          metadata: Json
          numero_titulos: number
          porcentaje_capital: number | null
          share_class_id: string | null
          tenant_id: string
          voting_rights: boolean
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          entity_id: string
          holder_person_id: string
          id?: string
          is_treasury?: boolean
          metadata?: Json
          numero_titulos: number
          porcentaje_capital?: number | null
          share_class_id?: string | null
          tenant_id: string
          voting_rights?: boolean
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          entity_id?: string
          holder_person_id?: string
          id?: string
          is_treasury?: boolean
          metadata?: Json
          numero_titulos?: number
          porcentaje_capital?: number | null
          share_class_id?: string | null
          tenant_id?: string
          voting_rights?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "capital_holdings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_holdings_holder_person_id_fkey"
            columns: ["holder_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_holdings_share_class_id_fkey"
            columns: ["share_class_id"]
            isOneToOne: false
            referencedRelation: "share_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      censo_snapshot: {
        Row: {
          audit_worm_id: string | null
          body_id: string | null
          capital_total_base: number | null
          created_at: string
          entity_id: string
          id: string
          meeting_id: string
          payload: Json
          session_kind: string
          snapshot_type: string
          tenant_id: string
          total_partes: number
        }
        Insert: {
          audit_worm_id?: string | null
          body_id?: string | null
          capital_total_base?: number | null
          created_at?: string
          entity_id: string
          id?: string
          meeting_id: string
          payload: Json
          session_kind: string
          snapshot_type: string
          tenant_id: string
          total_partes: number
        }
        Update: {
          audit_worm_id?: string | null
          body_id?: string | null
          capital_total_base?: number | null
          created_at?: string
          entity_id?: string
          id?: string
          meeting_id?: string
          payload?: Json
          session_kind?: string
          snapshot_type?: string
          tenant_id?: string
          total_partes?: number
        }
        Relationships: [
          {
            foreignKeyName: "censo_snapshot_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "censo_snapshot_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_censo_snapshot_worm"
            columns: ["audit_worm_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          agreement_id: string | null
          agreements_certified: string[] | null
          certifier_id: string | null
          content: string | null
          created_at: string
          created_by: string | null
          evidence_id: string | null
          hash_sha512: string | null
          id: string
          jurisdictional_requirements: Json | null
          legal_hold: boolean | null
          minute_id: string | null
          requires_qualified_signature: boolean | null
          signature_status: string | null
          tenant_id: string
          verified_by: string | null
        }
        Insert: {
          agreement_id?: string | null
          agreements_certified?: string[] | null
          certifier_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          evidence_id?: string | null
          hash_sha512?: string | null
          id?: string
          jurisdictional_requirements?: Json | null
          legal_hold?: boolean | null
          minute_id?: string | null
          requires_qualified_signature?: boolean | null
          signature_status?: string | null
          tenant_id: string
          verified_by?: string | null
        }
        Update: {
          agreement_id?: string | null
          agreements_certified?: string[] | null
          certifier_id?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          evidence_id?: string | null
          hash_sha512?: string | null
          id?: string
          jurisdictional_requirements?: Json | null
          legal_hold?: boolean | null
          minute_id?: string | null
          requires_qualified_signature?: boolean | null
          signature_status?: string | null
          tenant_id?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_certifier_id_fkey"
            columns: ["certifier_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "minutes"
            referencedColumns: ["id"]
          },
        ]
      }
      condiciones_persona: {
        Row: {
          body_id: string | null
          created_at: string
          entity_id: string
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          metadata: Json
          person_id: string
          representative_person_id: string | null
          tenant_id: string
          tipo_condicion: string
        }
        Insert: {
          body_id?: string | null
          created_at?: string
          entity_id: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio: string
          id?: string
          metadata?: Json
          person_id: string
          representative_person_id?: string | null
          tenant_id: string
          tipo_condicion: string
        }
        Update: {
          body_id?: string | null
          created_at?: string
          entity_id?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          metadata?: Json
          person_id?: string
          representative_person_id?: string | null
          tenant_id?: string
          tipo_condicion?: string
        }
        Relationships: [
          {
            foreignKeyName: "condiciones_persona_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condiciones_persona_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condiciones_persona_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condiciones_persona_representative_person_id_fkey"
            columns: ["representative_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      conflicto_interes: {
        Row: {
          agreement_id: string
          capital_afectado: number | null
          created_at: string | null
          id: string
          mandate_id: string
          motivo: string | null
          resuelto_por: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          agreement_id: string
          capital_afectado?: number | null
          created_at?: string | null
          id?: string
          mandate_id: string
          motivo?: string | null
          resuelto_por?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          agreement_id?: string
          capital_afectado?: number | null
          created_at?: string | null
          id?: string
          mandate_id?: string
          motivo?: string | null
          resuelto_por?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflicto_interes_agreement_fk"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicto_interes_mandate_fk"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicto_interes_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conflicts_of_interest: {
        Row: {
          code: string | null
          conflict_type: string | null
          created_at: string | null
          declared_at: string | null
          description: string | null
          id: string
          person_id: string | null
          related_agenda_item_id: string | null
          related_finding_id: string | null
          related_meeting_id: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          code?: string | null
          conflict_type?: string | null
          created_at?: string | null
          declared_at?: string | null
          description?: string | null
          id?: string
          person_id?: string | null
          related_agenda_item_id?: string | null
          related_finding_id?: string | null
          related_meeting_id?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          code?: string | null
          conflict_type?: string | null
          created_at?: string | null
          declared_at?: string | null
          description?: string | null
          id?: string
          person_id?: string | null
          related_agenda_item_id?: string | null
          related_finding_id?: string | null
          related_meeting_id?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflicts_of_interest_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_of_interest_related_agenda_item_id_fkey"
            columns: ["related_agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_of_interest_related_finding_id_fkey"
            columns: ["related_finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_of_interest_related_meeting_id_fkey"
            columns: ["related_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conflicts_of_interest_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consejero_retribucion: {
        Row: {
          body_id: string
          created_at: string | null
          ejercicio: number
          entity_id: string
          id: string
          ilp_csm_peso_pct: number | null
          ilp_diferido_anos_adicionales: number | null
          ilp_esg_peso_pct: number | null
          ilp_instrumento: string | null
          ilp_pct_diferido: number | null
          ilp_pct_inmediato: number | null
          ilp_periodo_devengo_anos: number | null
          ilp_rcgnv_peso_pct: number | null
          ilp_roe_peso_pct: number | null
          ilp_tsr_peso_pct: number | null
          prevision_presidente_adicional_pct: number | null
          prevision_seguro_vida_pct: number | null
          rf_consejero_director_general: number | null
          rf_coordinador_independiente: number | null
          rf_director_general_adjunto: number | null
          rf_presidente: number | null
          rf_presidente_comision_auditoria: number | null
          rf_presidente_comision_nombramientos: number | null
          rf_presidente_comision_retribuciones: number | null
          rf_presidente_comision_riesgos: number | null
          rf_vicepresidente_1: number | null
          rf_vicepresidente_cda: number | null
          rf_vocal_cda: number | null
          rf_vocal_comision_auditoria: number | null
          rf_vocal_comision_nombramientos: number | null
          rf_vocal_comision_retribuciones: number | null
          rf_vocal_comision_riesgos: number | null
          rva_ajuste_roe_pct: number | null
          rva_diferido_anos: number | null
          rva_metrica_principal: string | null
          rva_pct_diferido: number | null
          rva_pct_inmediato: number | null
          rva_techo_individual: string | null
          techo_jga_no_ejecutivos: number | null
          tenant_id: string
        }
        Insert: {
          body_id: string
          created_at?: string | null
          ejercicio?: number
          entity_id: string
          id?: string
          ilp_csm_peso_pct?: number | null
          ilp_diferido_anos_adicionales?: number | null
          ilp_esg_peso_pct?: number | null
          ilp_instrumento?: string | null
          ilp_pct_diferido?: number | null
          ilp_pct_inmediato?: number | null
          ilp_periodo_devengo_anos?: number | null
          ilp_rcgnv_peso_pct?: number | null
          ilp_roe_peso_pct?: number | null
          ilp_tsr_peso_pct?: number | null
          prevision_presidente_adicional_pct?: number | null
          prevision_seguro_vida_pct?: number | null
          rf_consejero_director_general?: number | null
          rf_coordinador_independiente?: number | null
          rf_director_general_adjunto?: number | null
          rf_presidente?: number | null
          rf_presidente_comision_auditoria?: number | null
          rf_presidente_comision_nombramientos?: number | null
          rf_presidente_comision_retribuciones?: number | null
          rf_presidente_comision_riesgos?: number | null
          rf_vicepresidente_1?: number | null
          rf_vicepresidente_cda?: number | null
          rf_vocal_cda?: number | null
          rf_vocal_comision_auditoria?: number | null
          rf_vocal_comision_nombramientos?: number | null
          rf_vocal_comision_retribuciones?: number | null
          rf_vocal_comision_riesgos?: number | null
          rva_ajuste_roe_pct?: number | null
          rva_diferido_anos?: number | null
          rva_metrica_principal?: string | null
          rva_pct_diferido?: number | null
          rva_pct_inmediato?: number | null
          rva_techo_individual?: string | null
          techo_jga_no_ejecutivos?: number | null
          tenant_id: string
        }
        Update: {
          body_id?: string
          created_at?: string | null
          ejercicio?: number
          entity_id?: string
          id?: string
          ilp_csm_peso_pct?: number | null
          ilp_diferido_anos_adicionales?: number | null
          ilp_esg_peso_pct?: number | null
          ilp_instrumento?: string | null
          ilp_pct_diferido?: number | null
          ilp_pct_inmediato?: number | null
          ilp_periodo_devengo_anos?: number | null
          ilp_rcgnv_peso_pct?: number | null
          ilp_roe_peso_pct?: number | null
          ilp_tsr_peso_pct?: number | null
          prevision_presidente_adicional_pct?: number | null
          prevision_seguro_vida_pct?: number | null
          rf_consejero_director_general?: number | null
          rf_coordinador_independiente?: number | null
          rf_director_general_adjunto?: number | null
          rf_presidente?: number | null
          rf_presidente_comision_auditoria?: number | null
          rf_presidente_comision_nombramientos?: number | null
          rf_presidente_comision_retribuciones?: number | null
          rf_presidente_comision_riesgos?: number | null
          rf_vicepresidente_1?: number | null
          rf_vicepresidente_cda?: number | null
          rf_vocal_cda?: number | null
          rf_vocal_comision_auditoria?: number | null
          rf_vocal_comision_nombramientos?: number | null
          rf_vocal_comision_retribuciones?: number | null
          rf_vocal_comision_riesgos?: number | null
          rva_ajuste_roe_pct?: number | null
          rva_diferido_anos?: number | null
          rva_metrica_principal?: string | null
          rva_pct_diferido?: number | null
          rva_pct_inmediato?: number | null
          rva_techo_individual?: string | null
          techo_jga_no_ejecutivos?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consejero_retribucion_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consejero_retribucion_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      controls: {
        Row: {
          code: string
          created_at: string | null
          id: string
          last_test_date: string | null
          name: string
          next_test_date: string | null
          obligation_id: string | null
          owner_id: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          last_test_date?: string | null
          name: string
          next_test_date?: string | null
          obligation_id?: string | null
          owner_id?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          last_test_date?: string | null
          name?: string
          next_test_date?: string | null
          obligation_id?: string | null
          owner_id?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "controls_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convocatorias: {
        Row: {
          body_id: string | null
          created_at: string
          estado: string
          fecha_1: string | null
          fecha_2: string | null
          fecha_emision: string | null
          id: string
          immutable_at: string | null
          is_second_call: boolean
          junta_universal: boolean
          modalidad: string
          publication_channels: string[] | null
          publication_evidence_url: string | null
          statutory_basis: string | null
          tenant_id: string
          updated_at: string
          urgente: boolean
        }
        Insert: {
          body_id?: string | null
          created_at?: string
          estado?: string
          fecha_1?: string | null
          fecha_2?: string | null
          fecha_emision?: string | null
          id?: string
          immutable_at?: string | null
          is_second_call?: boolean
          junta_universal?: boolean
          modalidad?: string
          publication_channels?: string[] | null
          publication_evidence_url?: string | null
          statutory_basis?: string | null
          tenant_id: string
          updated_at?: string
          urgente?: boolean
        }
        Update: {
          body_id?: string | null
          created_at?: string
          estado?: string
          fecha_1?: string | null
          fecha_2?: string | null
          fecha_emision?: string | null
          id?: string
          immutable_at?: string | null
          is_second_call?: boolean
          junta_universal?: boolean
          modalidad?: string
          publication_channels?: string[] | null
          publication_evidence_url?: string | null
          statutory_basis?: string | null
          tenant_id?: string
          updated_at?: string
          urgente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "convocatorias_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      country_packs: {
        Row: {
          active_modules: string[]
          country_code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          pack_name: string
          tenant_id: string
        }
        Insert: {
          active_modules?: string[]
          country_code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pack_name: string
          tenant_id: string
        }
        Update: {
          active_modules?: string[]
          country_code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pack_name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "country_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          abstentions: number | null
          agenda_item_id: string | null
          approved: boolean | null
          created_at: string | null
          decision_type: string | null
          effective_date: string | null
          id: string
          meeting_id: string
          tenant_id: string | null
          title: string
          votes_against: number | null
          votes_for: number | null
        }
        Insert: {
          abstentions?: number | null
          agenda_item_id?: string | null
          approved?: boolean | null
          created_at?: string | null
          decision_type?: string | null
          effective_date?: string | null
          id?: string
          meeting_id: string
          tenant_id?: string | null
          title: string
          votes_against?: number | null
          votes_for?: number | null
        }
        Update: {
          abstentions?: number | null
          agenda_item_id?: string | null
          approved?: boolean | null
          created_at?: string | null
          decision_type?: string | null
          effective_date?: string | null
          id?: string
          meeting_id?: string
          tenant_id?: string | null
          title?: string
          votes_against?: number | null
          votes_for?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      deeds: {
        Row: {
          certification_id: string | null
          content: string | null
          created_at: string
          deed_date: string | null
          id: string
          notary: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          certification_id?: string | null
          content?: string | null
          created_at?: string
          deed_date?: string | null
          id?: string
          notary?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          certification_id?: string | null
          content?: string | null
          created_at?: string
          deed_date?: string | null
          id?: string
          notary?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deeds_certification_id_fkey"
            columns: ["certification_id"]
            isOneToOne: false
            referencedRelation: "certifications"
            referencedColumns: ["id"]
          },
        ]
      }
      delegations: {
        Row: {
          alert_t30: boolean | null
          alert_t60: boolean | null
          alert_t90: boolean | null
          code: string
          created_at: string | null
          delegate_id: string | null
          delegation_type: string | null
          end_date: string | null
          entity_id: string | null
          grantor_id: string | null
          id: string
          limits: string | null
          scope: string | null
          slug: string | null
          start_date: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          alert_t30?: boolean | null
          alert_t60?: boolean | null
          alert_t90?: boolean | null
          code: string
          created_at?: string | null
          delegate_id?: string | null
          delegation_type?: string | null
          end_date?: string | null
          entity_id?: string | null
          grantor_id?: string | null
          id?: string
          limits?: string | null
          scope?: string | null
          slug?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          alert_t30?: boolean | null
          alert_t60?: boolean | null
          alert_t90?: boolean | null
          code?: string
          created_at?: string | null
          delegate_id?: string | null
          delegation_type?: string | null
          end_date?: string | null
          entity_id?: string | null
          grantor_id?: string | null
          id?: string
          limits?: string | null
          scope?: string | null
          slug?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delegations_delegate_id_fkey"
            columns: ["delegate_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegations_grantor_id_fkey"
            columns: ["grantor_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          body_type: string[] | null
          content_template: string | null
          id: string
          is_active: boolean
          locale: string
          template_code: string
          tenant_id: string
          title: string
          typology: string | null
          version: string
        }
        Insert: {
          body_type?: string[] | null
          content_template?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          template_code: string
          tenant_id: string
          title: string
          typology?: string | null
          version?: string
        }
        Update: {
          body_type?: string[] | null
          content_template?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          template_code?: string
          tenant_id?: string
          title?: string
          typology?: string | null
          version?: string
        }
        Relationships: []
      }
      entities: {
        Row: {
          admin_solidario_restricciones: Json | null
          common_name: string | null
          created_at: string | null
          entity_status: string | null
          es_cotizada: boolean | null
          es_unipersonal: boolean | null
          forma_administracion: string | null
          id: string
          jurisdiction: string | null
          legal_form: string | null
          legal_hold: boolean | null
          legal_name: string
          materiality: string | null
          ownership_percentage: number | null
          parent_entity_id: string | null
          person_id: string | null
          registration_number: string | null
          retention_policy_id: string | null
          secretary_owner_id: string | null
          slug: string
          solvency_ii_ratio: number | null
          tenant_id: string
          tipo_organo_admin: string | null
          tipo_social: string | null
        }
        Insert: {
          admin_solidario_restricciones?: Json | null
          common_name?: string | null
          created_at?: string | null
          entity_status?: string | null
          es_cotizada?: boolean | null
          es_unipersonal?: boolean | null
          forma_administracion?: string | null
          id?: string
          jurisdiction?: string | null
          legal_form?: string | null
          legal_hold?: boolean | null
          legal_name: string
          materiality?: string | null
          ownership_percentage?: number | null
          parent_entity_id?: string | null
          person_id?: string | null
          registration_number?: string | null
          retention_policy_id?: string | null
          secretary_owner_id?: string | null
          slug: string
          solvency_ii_ratio?: number | null
          tenant_id: string
          tipo_organo_admin?: string | null
          tipo_social?: string | null
        }
        Update: {
          admin_solidario_restricciones?: Json | null
          common_name?: string | null
          created_at?: string | null
          entity_status?: string | null
          es_cotizada?: boolean | null
          es_unipersonal?: boolean | null
          forma_administracion?: string | null
          id?: string
          jurisdiction?: string | null
          legal_form?: string | null
          legal_hold?: boolean | null
          legal_name?: string
          materiality?: string | null
          ownership_percentage?: number | null
          parent_entity_id?: string | null
          person_id?: string | null
          registration_number?: string | null
          retention_policy_id?: string | null
          secretary_owner_id?: string | null
          slug?: string
          solvency_ii_ratio?: number | null
          tenant_id?: string
          tipo_organo_admin?: string | null
          tipo_social?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entities_parent_entity_id_fkey"
            columns: ["parent_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_retention_policy_id_fkey"
            columns: ["retention_policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_entities_person_id"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_capital_profile: {
        Row: {
          capital_desembolsado: number | null
          capital_escriturado: number
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          entity_id: string
          estado: string
          id: string
          numero_titulos: number | null
          tenant_id: string
          valor_nominal: number | null
        }
        Insert: {
          capital_desembolsado?: number | null
          capital_escriturado: number
          created_at?: string
          currency?: string
          effective_from: string
          effective_to?: string | null
          entity_id: string
          estado?: string
          id?: string
          numero_titulos?: number | null
          tenant_id: string
          valor_nominal?: number | null
        }
        Update: {
          capital_desembolsado?: number | null
          capital_escriturado?: number
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          entity_id?: string
          estado?: string
          id?: string
          numero_titulos?: number | null
          tenant_id?: string
          valor_nominal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_capital_profile_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_bundle_artifacts: {
        Row: {
          artifact_hash: string
          artifact_ref: string
          artifact_type: string
          bundle_id: string
          created_at: string
          id: string
          metadata: Json | null
          timestamp_iso: string
        }
        Insert: {
          artifact_hash: string
          artifact_ref: string
          artifact_type: string
          bundle_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          timestamp_iso: string
        }
        Update: {
          artifact_hash?: string
          artifact_ref?: string
          artifact_type?: string
          bundle_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          timestamp_iso?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_bundle_artifacts_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_bundles: {
        Row: {
          agreement_id: string
          chain_of_custody: Json | null
          created_at: string
          document_url: string | null
          hash_sha512: string | null
          id: string
          legal_hold: boolean | null
          manifest: Json
          manifest_hash: string
          qseal_token: string | null
          reference_code: string | null
          signature_date: string | null
          signed_by: string | null
          status: string
          tenant_id: string
          tsq_token: string | null
        }
        Insert: {
          agreement_id: string
          chain_of_custody?: Json | null
          created_at?: string
          document_url?: string | null
          hash_sha512?: string | null
          id?: string
          legal_hold?: boolean | null
          manifest: Json
          manifest_hash: string
          qseal_token?: string | null
          reference_code?: string | null
          signature_date?: string | null
          signed_by?: string | null
          status?: string
          tenant_id?: string
          tsq_token?: string | null
        }
        Update: {
          agreement_id?: string
          chain_of_custody?: Json | null
          created_at?: string
          document_url?: string | null
          hash_sha512?: string | null
          id?: string
          legal_hold?: boolean | null
          manifest?: Json
          manifest_hash?: string
          qseal_token?: string | null
          reference_code?: string | null
          signature_date?: string | null
          signed_by?: string | null
          status?: string
          tenant_id?: string
          tsq_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_bundles_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      evidences: {
        Row: {
          control_id: string
          created_at: string | null
          ev_type: string | null
          file_url: string | null
          id: string
          legal_hold: boolean | null
          owner_id: string | null
          rejection_reason: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          control_id: string
          created_at?: string | null
          ev_type?: string | null
          file_url?: string | null
          id?: string
          legal_hold?: boolean | null
          owner_id?: string | null
          rejection_reason?: string | null
          status?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          control_id?: string
          created_at?: string | null
          ev_type?: string | null
          file_url?: string | null
          id?: string
          legal_hold?: boolean | null
          owner_id?: string | null
          rejection_reason?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidences_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exceptions: {
        Row: {
          approver_id: string | null
          code: string
          compensatory_controls: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          justification: string | null
          obligation_id: string | null
          requested_at: string | null
          requester_id: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          approver_id?: string | null
          code: string
          compensatory_controls?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          justification?: string | null
          obligation_id?: string | null
          requested_at?: string | null
          requester_id?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          approver_id?: string | null
          code?: string
          compensatory_controls?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          justification?: string | null
          obligation_id?: string | null
          requested_at?: string | null
          requester_id?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exceptions_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          closed_at: string | null
          code: string
          created_at: string | null
          due_date: string | null
          entity_id: string | null
          id: string
          obligation_id: string | null
          opened_at: string | null
          origin: string | null
          owner_id: string | null
          severity: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          closed_at?: string | null
          code: string
          created_at?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          obligation_id?: string | null
          opened_at?: string | null
          origin?: string | null
          owner_id?: string | null
          severity?: string | null
          status?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          closed_at?: string | null
          code?: string
          created_at?: string | null
          due_date?: string | null
          entity_id?: string | null
          id?: string
          obligation_id?: string | null
          opened_at?: string | null
          origin?: string | null
          owner_id?: string | null
          severity?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      governing_bodies: {
        Row: {
          body_type: string | null
          config: Json | null
          created_at: string | null
          entity_id: string | null
          id: string
          legal_hold: boolean | null
          name: string
          quorum_rule: Json | null
          slug: string
          tenant_id: string
        }
        Insert: {
          body_type?: string | null
          config?: Json | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          legal_hold?: boolean | null
          name: string
          quorum_rule?: Json | null
          slug: string
          tenant_id: string
        }
        Update: {
          body_type?: string | null
          config?: Json | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          legal_hold?: boolean | null
          name?: string
          quorum_rule?: Json | null
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governing_bodies_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governing_bodies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_module_nav: {
        Row: {
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          label: string
          module_id: string
          required_roles: string[] | null
          route: string
          section: string
          tenant_id: string
          view_key: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          label: string
          module_id: string
          required_roles?: string[] | null
          route: string
          section: string
          tenant_id: string
          view_key: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          label?: string
          module_id?: string
          required_roles?: string[] | null
          route?: string
          section?: string
          tenant_id?: string
          view_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_module_nav_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          approved_by: string | null
          assigned_to: string | null
          code: string
          containment_date: string | null
          country_code: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          detection_date: string | null
          entity_id: string | null
          evidence_id: string | null
          id: string
          incident_type: string | null
          is_major_incident: boolean | null
          legal_hold: boolean | null
          lessons_learned: string | null
          obligation_id: string | null
          regulatory_notification_required: boolean | null
          reported_by: string | null
          resolution_date: string | null
          retention_policy_id: string | null
          root_cause: string | null
          severity: string | null
          status: string | null
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          assigned_to?: string | null
          code?: string
          containment_date?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          detection_date?: string | null
          entity_id?: string | null
          evidence_id?: string | null
          id?: string
          incident_type?: string | null
          is_major_incident?: boolean | null
          legal_hold?: boolean | null
          lessons_learned?: string | null
          obligation_id?: string | null
          regulatory_notification_required?: boolean | null
          reported_by?: string | null
          resolution_date?: string | null
          retention_policy_id?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string | null
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          assigned_to?: string | null
          code?: string
          containment_date?: string | null
          country_code?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          detection_date?: string | null
          entity_id?: string | null
          evidence_id?: string | null
          id?: string
          incident_type?: string | null
          is_major_incident?: boolean | null
          legal_hold?: boolean | null
          lessons_learned?: string | null
          obligation_id?: string | null
          regulatory_notification_required?: boolean | null
          reported_by?: string | null
          resolution_date?: string | null
          retention_policy_id?: string | null
          root_cause?: string | null
          severity?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_retention_policy_id_fkey"
            columns: ["retention_policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jurisdiction_rule_sets: {
        Row: {
          company_form: string
          id: string
          is_active: boolean
          jurisdiction: string
          pack_id: string | null
          rule_config: Json | null
          statutory_override: boolean
          typology_code: string
        }
        Insert: {
          company_form: string
          id?: string
          is_active?: boolean
          jurisdiction: string
          pack_id?: string | null
          rule_config?: Json | null
          statutory_override?: boolean
          typology_code: string
        }
        Update: {
          company_form?: string
          id?: string
          is_active?: boolean
          jurisdiction?: string
          pack_id?: string | null
          rule_config?: Json | null
          statutory_override?: boolean
          typology_code?: string
        }
        Relationships: []
      }
      mandates: {
        Row: {
          body_id: string
          capital_participacion: number | null
          clase_accion: string | null
          created_at: string | null
          director_type: string | null
          end_date: string | null
          id: string
          person_id: string
          porcentaje_capital: number | null
          representative_person_id: string | null
          role: string
          start_date: string | null
          status: string | null
          tenant_id: string
          tiene_derecho_voto: boolean | null
        }
        Insert: {
          body_id: string
          capital_participacion?: number | null
          clase_accion?: string | null
          created_at?: string | null
          director_type?: string | null
          end_date?: string | null
          id?: string
          person_id: string
          porcentaje_capital?: number | null
          representative_person_id?: string | null
          role: string
          start_date?: string | null
          status?: string | null
          tenant_id: string
          tiene_derecho_voto?: boolean | null
        }
        Update: {
          body_id?: string
          capital_participacion?: number | null
          clase_accion?: string | null
          created_at?: string | null
          director_type?: string | null
          end_date?: string | null
          id?: string
          person_id?: string
          porcentaje_capital?: number | null
          representative_person_id?: string | null
          role?: string
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          tiene_derecho_voto?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "mandates_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_representative_person_id_fkey"
            columns: ["representative_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mandatory_books: {
        Row: {
          book_kind: string
          closed_at: string | null
          entity_id: string | null
          id: string
          legalization_deadline: string | null
          legalization_evidence_url: string | null
          legalization_status: string
          opened_at: string | null
          period: number
          status: string
          tenant_id: string
          volume_number: number
        }
        Insert: {
          book_kind: string
          closed_at?: string | null
          entity_id?: string | null
          id?: string
          legalization_deadline?: string | null
          legalization_evidence_url?: string | null
          legalization_status?: string
          opened_at?: string | null
          period: number
          status?: string
          tenant_id: string
          volume_number?: number
        }
        Update: {
          book_kind?: string
          closed_at?: string | null
          entity_id?: string | null
          id?: string
          legalization_deadline?: string | null
          legalization_evidence_url?: string | null
          legalization_status?: string
          opened_at?: string | null
          period?: number
          status?: string
          tenant_id?: string
          volume_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "mandatory_books_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          attendance_type: string
          capital_representado: number | null
          id: string
          meeting_id: string | null
          person_id: string | null
          represented_by_id: string | null
          shares_represented: number | null
          tenant_id: string | null
          via_representante: boolean | null
          voting_rights: number | null
        }
        Insert: {
          attendance_type?: string
          capital_representado?: number | null
          id?: string
          meeting_id?: string | null
          person_id?: string | null
          represented_by_id?: string | null
          shares_represented?: number | null
          tenant_id?: string | null
          via_representante?: boolean | null
          voting_rights?: number | null
        }
        Update: {
          attendance_type?: string
          capital_representado?: number | null
          id?: string
          meeting_id?: string | null
          person_id?: string | null
          represented_by_id?: string | null
          shares_represented?: number | null
          tenant_id?: string | null
          via_representante?: boolean | null
          voting_rights?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendees_represented_by_id_fkey"
            columns: ["represented_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_resolutions: {
        Row: {
          agenda_item_index: number
          agreement_id: string | null
          id: string
          meeting_id: string | null
          required_majority_code: string | null
          resolution_text: string | null
          resolution_type: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          agenda_item_index: number
          agreement_id?: string | null
          id?: string
          meeting_id?: string | null
          required_majority_code?: string | null
          resolution_text?: string | null
          resolution_type?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          agenda_item_index?: number
          agreement_id?: string | null
          id?: string
          meeting_id?: string | null
          required_majority_code?: string | null
          resolution_text?: string | null
          resolution_type?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_resolutions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_resolutions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_votes: {
        Row: {
          attendee_id: string | null
          conflict_flag: boolean
          id: string
          reason: string | null
          resolution_id: string | null
          tenant_id: string | null
          vote_value: string
        }
        Insert: {
          attendee_id?: string | null
          conflict_flag?: boolean
          id?: string
          reason?: string | null
          resolution_id?: string | null
          tenant_id?: string | null
          vote_value?: string
        }
        Update: {
          attendee_id?: string | null
          conflict_flag?: boolean
          id?: string
          reason?: string | null
          resolution_id?: string | null
          tenant_id?: string | null
          vote_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_votes_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "meeting_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_votes_resolution_id_fkey"
            columns: ["resolution_id"]
            isOneToOne: false
            referencedRelation: "meeting_resolutions"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          approved_by: string | null
          body_id: string
          confidentiality_level: string | null
          created_at: string | null
          created_by: string | null
          id: string
          legal_hold: boolean | null
          location: string | null
          meeting_type: string | null
          president_id: string | null
          quorum_data: Json | null
          scheduled_end: string | null
          scheduled_start: string | null
          secretary_id: string | null
          slug: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          approved_by?: string | null
          body_id: string
          confidentiality_level?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          legal_hold?: boolean | null
          location?: string | null
          meeting_type?: string | null
          president_id?: string | null
          quorum_data?: Json | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          secretary_id?: string | null
          slug: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          approved_by?: string | null
          body_id?: string
          confidentiality_level?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          legal_hold?: boolean | null
          location?: string | null
          meeting_type?: string | null
          president_id?: string | null
          quorum_data?: Json | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          secretary_id?: string | null
          slug?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_president_id_fkey"
            columns: ["president_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_secretary_id_fkey"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      minutes: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_locked: boolean
          meeting_id: string | null
          registered_at: string | null
          signed_at: string | null
          signed_by_president_id: string | null
          signed_by_secretary_id: string | null
          tenant_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          meeting_id?: string | null
          registered_at?: string | null
          signed_at?: string | null
          signed_by_president_id?: string | null
          signed_by_secretary_id?: string | null
          tenant_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_locked?: boolean
          meeting_id?: string | null
          registered_at?: string | null
          signed_at?: string | null
          signed_by_president_id?: string | null
          signed_by_secretary_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_signed_by_president_id_fkey"
            columns: ["signed_by_president_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_signed_by_secretary_id_fkey"
            columns: ["signed_by_secretary_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      no_session_expedientes: {
        Row: {
          agreement_id: string
          body_id: string
          condicion_adopcion: string
          created_at: string | null
          entity_id: string
          estado: string
          fecha_cierre: string | null
          id: string
          motivo_cierre: string | null
          propuesta_documentos: Json | null
          propuesta_fecha: string | null
          propuesta_firmada_por: string | null
          propuesta_texto: string | null
          rule_pack_id: string | null
          rule_pack_version: string | null
          snapshot_hash: string | null
          tenant_id: string
          tipo_proceso: string
          updated_at: string | null
          ventana_dias_habiles: number | null
          ventana_fin: string | null
          ventana_fuente: string | null
          ventana_inicio: string | null
        }
        Insert: {
          agreement_id: string
          body_id: string
          condicion_adopcion: string
          created_at?: string | null
          entity_id: string
          estado?: string
          fecha_cierre?: string | null
          id?: string
          motivo_cierre?: string | null
          propuesta_documentos?: Json | null
          propuesta_fecha?: string | null
          propuesta_firmada_por?: string | null
          propuesta_texto?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          snapshot_hash?: string | null
          tenant_id: string
          tipo_proceso: string
          updated_at?: string | null
          ventana_dias_habiles?: number | null
          ventana_fin?: string | null
          ventana_fuente?: string | null
          ventana_inicio?: string | null
        }
        Update: {
          agreement_id?: string
          body_id?: string
          condicion_adopcion?: string
          created_at?: string | null
          entity_id?: string
          estado?: string
          fecha_cierre?: string | null
          id?: string
          motivo_cierre?: string | null
          propuesta_documentos?: Json | null
          propuesta_fecha?: string | null
          propuesta_firmada_por?: string | null
          propuesta_texto?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          snapshot_hash?: string | null
          tenant_id?: string
          tipo_proceso?: string
          updated_at?: string | null
          ventana_dias_habiles?: number | null
          ventana_fin?: string | null
          ventana_fuente?: string | null
          ventana_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "no_session_expedientes_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_expedientes_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_expedientes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_expedientes_propuesta_firmada_por_fkey"
            columns: ["propuesta_firmada_por"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      no_session_notificaciones: {
        Row: {
          canal: string
          entregada_at: string | null
          enviada_at: string | null
          erds_delivered_at: string | null
          erds_delivery_ref: string | null
          erds_error_message: string | null
          erds_evidence_hash: string | null
          erds_evidence_id: string | null
          erds_status: string | null
          erds_tsq_token: string | null
          estado: string
          evidencia_hash: string | null
          evidencia_ref: string | null
          expediente_id: string
          id: string
          person_id: string
          tenant_id: string
        }
        Insert: {
          canal: string
          entregada_at?: string | null
          enviada_at?: string | null
          erds_delivered_at?: string | null
          erds_delivery_ref?: string | null
          erds_error_message?: string | null
          erds_evidence_hash?: string | null
          erds_evidence_id?: string | null
          erds_status?: string | null
          erds_tsq_token?: string | null
          estado?: string
          evidencia_hash?: string | null
          evidencia_ref?: string | null
          expediente_id: string
          id?: string
          person_id: string
          tenant_id: string
        }
        Update: {
          canal?: string
          entregada_at?: string | null
          enviada_at?: string | null
          erds_delivered_at?: string | null
          erds_delivery_ref?: string | null
          erds_error_message?: string | null
          erds_evidence_hash?: string | null
          erds_evidence_id?: string | null
          erds_status?: string | null
          erds_tsq_token?: string | null
          estado?: string
          evidencia_hash?: string | null
          evidencia_ref?: string | null
          expediente_id?: string
          id?: string
          person_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "no_session_notificaciones_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "no_session_expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_notificaciones_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      no_session_resolutions: {
        Row: {
          abstentions: number
          body_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          opened_at: string | null
          proposal_text: string | null
          requires_unanimity: boolean
          status: string
          tenant_id: string
          title: string
          votes_against: number
          votes_for: number
          voting_deadline: string | null
        }
        Insert: {
          abstentions?: number
          body_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          proposal_text?: string | null
          requires_unanimity?: boolean
          status?: string
          tenant_id: string
          title: string
          votes_against?: number
          votes_for?: number
          voting_deadline?: string | null
        }
        Update: {
          abstentions?: number
          body_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          proposal_text?: string | null
          requires_unanimity?: boolean
          status?: string
          tenant_id?: string
          title?: string
          votes_against?: number
          votes_for?: number
          voting_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "no_session_resolutions_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      no_session_respuestas: {
        Row: {
          capital_participacion: number | null
          es_consejero: boolean | null
          expediente_id: string
          fecha_respuesta: string | null
          firma_qes_ref: string | null
          firma_qes_timestamp: string | null
          id: string
          notificacion_certificada_ref: string | null
          ocsp_status: string | null
          person_id: string
          porcentaje_capital: number | null
          sentido: string
          tenant_id: string
          texto_respuesta: string | null
        }
        Insert: {
          capital_participacion?: number | null
          es_consejero?: boolean | null
          expediente_id: string
          fecha_respuesta?: string | null
          firma_qes_ref?: string | null
          firma_qes_timestamp?: string | null
          id?: string
          notificacion_certificada_ref?: string | null
          ocsp_status?: string | null
          person_id: string
          porcentaje_capital?: number | null
          sentido: string
          tenant_id: string
          texto_respuesta?: string | null
        }
        Update: {
          capital_participacion?: number | null
          es_consejero?: boolean | null
          expediente_id?: string
          fecha_respuesta?: string | null
          firma_qes_ref?: string | null
          firma_qes_timestamp?: string | null
          id?: string
          notificacion_certificada_ref?: string | null
          ocsp_status?: string | null
          person_id?: string
          porcentaje_capital?: number | null
          sentido?: string
          tenant_id?: string
          texto_respuesta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "no_session_respuestas_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "no_session_expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_respuestas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          route: string
          tenant_id: string
          title: string
          type: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          route: string
          tenant_id: string
          title: string
          type?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          route?: string
          tenant_id?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obligations: {
        Row: {
          code: string
          country_scope: string[] | null
          created_at: string | null
          criticality: string | null
          id: string
          legal_hold: boolean | null
          policy_id: string | null
          retention_policy_id: string | null
          source: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          code: string
          country_scope?: string[] | null
          created_at?: string | null
          criticality?: string | null
          id?: string
          legal_hold?: boolean | null
          policy_id?: string | null
          retention_policy_id?: string | null
          source?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          code?: string
          country_scope?: string[] | null
          created_at?: string | null
          criticality?: string | null
          id?: string
          legal_hold?: boolean | null
          policy_id?: string | null
          retention_policy_id?: string | null
          source?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_retention_policy_id_fkey"
            columns: ["retention_policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_rules: {
        Row: {
          created_at: string | null
          effective_date: string | null
          framework_code: string
          id: string
          local_adaptations: Json | null
          pack_id: string
        }
        Insert: {
          created_at?: string | null
          effective_date?: string | null
          framework_code: string
          id?: string
          local_adaptations?: Json | null
          pack_id: string
        }
        Update: {
          created_at?: string | null
          effective_date?: string | null
          framework_code?: string
          id?: string
          local_adaptations?: Json | null
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_rules_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "country_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      pacto_clausulas: {
        Row: {
          capital_minimo_pct: number | null
          condicion_detallada: string | null
          created_at: string | null
          efecto_incumplimiento: string | null
          estatutarizada: boolean | null
          id: string
          materia_ambito: Json
          pacto_id: string
          tipo: string
          titular_veto: string | null
          titulares: Json
          umbral_activacion: number | null
          ventana_respuesta_dias: number | null
        }
        Insert: {
          capital_minimo_pct?: number | null
          condicion_detallada?: string | null
          created_at?: string | null
          efecto_incumplimiento?: string | null
          estatutarizada?: boolean | null
          id?: string
          materia_ambito?: Json
          pacto_id: string
          tipo: string
          titular_veto?: string | null
          titulares?: Json
          umbral_activacion?: number | null
          ventana_respuesta_dias?: number | null
        }
        Update: {
          capital_minimo_pct?: number | null
          condicion_detallada?: string | null
          created_at?: string | null
          efecto_incumplimiento?: string | null
          estatutarizada?: boolean | null
          id?: string
          materia_ambito?: Json
          pacto_id?: string
          tipo?: string
          titular_veto?: string | null
          titulares?: Json
          umbral_activacion?: number | null
          ventana_respuesta_dias?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pacto_clausulas_pacto_id_fkey"
            columns: ["pacto_id"]
            isOneToOne: false
            referencedRelation: "pactos_parasociales"
            referencedColumns: ["id"]
          },
        ]
      }
      pacto_evaluacion_results: {
        Row: {
          agreement_id: string
          created_at: string | null
          explain: Json
          id: string
          pacto_id: string
          pacto_ok: boolean
          tenant_id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string | null
          explain?: Json
          id?: string
          pacto_id: string
          pacto_ok: boolean
          tenant_id: string
        }
        Update: {
          agreement_id?: string
          created_at?: string | null
          explain?: Json
          id?: string
          pacto_id?: string
          pacto_ok?: boolean
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacto_evaluacion_results_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacto_evaluacion_results_pacto_id_fkey"
            columns: ["pacto_id"]
            isOneToOne: false
            referencedRelation: "pactos_parasociales"
            referencedColumns: ["id"]
          },
        ]
      }
      pactos_parasociales: {
        Row: {
          capital_minimo_pct: number | null
          condicion_detallada: string | null
          created_at: string
          descripcion: string | null
          documento_ref: string | null
          entity_id: string | null
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          firmantes: Json
          id: string
          materias_aplicables: string[] | null
          notas: string | null
          tenant_id: string
          tipo_clausula: string
          titular_veto: string | null
          titulo: string
          umbral_activacion: number | null
          updated_at: string
        }
        Insert: {
          capital_minimo_pct?: number | null
          condicion_detallada?: string | null
          created_at?: string
          descripcion?: string | null
          documento_ref?: string | null
          entity_id?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          firmantes?: Json
          id?: string
          materias_aplicables?: string[] | null
          notas?: string | null
          tenant_id?: string
          tipo_clausula: string
          titular_veto?: string | null
          titulo: string
          umbral_activacion?: number | null
          updated_at?: string
        }
        Update: {
          capital_minimo_pct?: number | null
          condicion_detallada?: string | null
          created_at?: string
          descripcion?: string | null
          documento_ref?: string | null
          entity_id?: string | null
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          firmantes?: Json
          id?: string
          materias_aplicables?: string[] | null
          notas?: string | null
          tenant_id?: string
          tipo_clausula?: string
          titular_veto?: string | null
          titulo?: string
          umbral_activacion?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pactos_parasociales_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      parte_votante_current: {
        Row: {
          body_id: string | null
          denominator_weight: number
          entity_id: string
          exclusion_policy: string
          exclusion_reason: string | null
          generated_at: string
          id: string
          person_id: string
          source_id: string
          source_type: string
          tenant_id: string
          voting_rights: boolean
          voting_weight: number
        }
        Insert: {
          body_id?: string | null
          denominator_weight?: number
          entity_id: string
          exclusion_policy?: string
          exclusion_reason?: string | null
          generated_at?: string
          id?: string
          person_id: string
          source_id: string
          source_type: string
          tenant_id: string
          voting_rights: boolean
          voting_weight?: number
        }
        Update: {
          body_id?: string | null
          denominator_weight?: number
          entity_id?: string
          exclusion_policy?: string
          exclusion_reason?: string | null
          generated_at?: string
          id?: string
          person_id?: string
          source_id?: string
          source_type?: string
          tenant_id?: string
          voting_rights?: boolean
          voting_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "parte_votante_current_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parte_votante_current_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parte_votante_current_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          created_at: string | null
          denomination: string | null
          email: string | null
          full_name: string
          id: string
          person_type: string | null
          representative_person_id: string | null
          tax_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          denomination?: string | null
          email?: string | null
          full_name: string
          id?: string
          person_type?: string | null
          representative_person_id?: string | null
          tax_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          denomination?: string | null
          email?: string | null
          full_name?: string
          id?: string
          person_type?: string | null
          representative_person_id?: string | null
          tax_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_representative_person_id_fkey"
            columns: ["representative_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_protegidas: {
        Row: {
          activated_at: string | null
          adoption_mode: string | null
          approval_checklist: Json | null
          approved_by_role: string | null
          aprobada_por: string | null
          capa1_inmutable: string | null
          capa2_variables: Json | null
          capa3_editables: Json | null
          contenido_template: string | null
          content_hash_sha256: string | null
          contrato_variables_version: string | null
          created_at: string | null
          estado: string
          fecha_aprobacion: string | null
          id: string
          jurisdiccion: string
          materia: string | null
          materia_acuerdo: string | null
          notas_legal: string | null
          organo_tipo: string | null
          protecciones: Json | null
          referencia_legal: string | null
          review_date: string | null
          review_notes: string | null
          reviewed_by: string | null
          snapshot_rule_pack_required: boolean | null
          tenant_id: string
          tipo: string
          variables: Json | null
          version: string
          version_history: Json | null
        }
        Insert: {
          activated_at?: string | null
          adoption_mode?: string | null
          approval_checklist?: Json | null
          approved_by_role?: string | null
          aprobada_por?: string | null
          capa1_inmutable?: string | null
          capa2_variables?: Json | null
          capa3_editables?: Json | null
          contenido_template?: string | null
          content_hash_sha256?: string | null
          contrato_variables_version?: string | null
          created_at?: string | null
          estado?: string
          fecha_aprobacion?: string | null
          id?: string
          jurisdiccion?: string
          materia?: string | null
          materia_acuerdo?: string | null
          notas_legal?: string | null
          organo_tipo?: string | null
          protecciones?: Json | null
          referencia_legal?: string | null
          review_date?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          snapshot_rule_pack_required?: boolean | null
          tenant_id: string
          tipo: string
          variables?: Json | null
          version?: string
          version_history?: Json | null
        }
        Update: {
          activated_at?: string | null
          adoption_mode?: string | null
          approval_checklist?: Json | null
          approved_by_role?: string | null
          aprobada_por?: string | null
          capa1_inmutable?: string | null
          capa2_variables?: Json | null
          capa3_editables?: Json | null
          contenido_template?: string | null
          content_hash_sha256?: string | null
          contrato_variables_version?: string | null
          created_at?: string | null
          estado?: string
          fecha_aprobacion?: string | null
          id?: string
          jurisdiccion?: string
          materia?: string | null
          materia_acuerdo?: string | null
          notas_legal?: string | null
          organo_tipo?: string | null
          protecciones?: Json | null
          referencia_legal?: string | null
          review_date?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          snapshot_rule_pack_required?: boolean | null
          tenant_id?: string
          tipo?: string
          variables?: Json | null
          version?: string
          version_history?: Json | null
        }
        Relationships: []
      }
      policies: {
        Row: {
          approval_body_id: string | null
          approved_by: string | null
          classification: string | null
          created_at: string | null
          created_by: string | null
          current_version: number | null
          effective_date: string | null
          id: string
          legal_hold: boolean | null
          mandatory: boolean | null
          next_review_date: string | null
          normative_tier: string | null
          owner_function: string | null
          policy_code: string
          policy_type: string | null
          retention_policy_id: string | null
          scope_level: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          approval_body_id?: string | null
          approved_by?: string | null
          classification?: string | null
          created_at?: string | null
          created_by?: string | null
          current_version?: number | null
          effective_date?: string | null
          id?: string
          legal_hold?: boolean | null
          mandatory?: boolean | null
          next_review_date?: string | null
          normative_tier?: string | null
          owner_function?: string | null
          policy_code: string
          policy_type?: string | null
          retention_policy_id?: string | null
          scope_level?: string | null
          status?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          approval_body_id?: string | null
          approved_by?: string | null
          classification?: string | null
          created_at?: string | null
          created_by?: string | null
          current_version?: number | null
          effective_date?: string | null
          id?: string
          legal_hold?: boolean | null
          mandatory?: boolean | null
          next_review_date?: string | null
          normative_tier?: string | null
          owner_function?: string | null
          policy_code?: string
          policy_type?: string | null
          retention_policy_id?: string | null
          scope_level?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "policies_approval_body_id_fkey"
            columns: ["approval_body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_retention_policy_id_fkey"
            columns: ["retention_policy_id"]
            isOneToOne: false
            referencedRelation: "retention_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_agreements: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
          notes: string | null
          policy_id: string
          relationship_kind: string
          tenant_id: string
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
          notes?: string | null
          policy_id: string
          relationship_kind?: string
          tenant_id: string
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          policy_id?: string
          relationship_kind?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_agreements_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_agreements_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_agreements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      qtsp_signature_requests: {
        Row: {
          activated_at: string | null
          agreement_id: string | null
          completed_at: string | null
          created_by: string | null
          document_hash: string
          document_id: string | null
          document_type: string
          error_message: string | null
          evidence_id: string | null
          evidence_status: string | null
          id: string
          requested_at: string | null
          signatories: Json | null
          sr_id: string | null
          sr_status: string | null
          tenant_id: string
        }
        Insert: {
          activated_at?: string | null
          agreement_id?: string | null
          completed_at?: string | null
          created_by?: string | null
          document_hash: string
          document_id?: string | null
          document_type: string
          error_message?: string | null
          evidence_id?: string | null
          evidence_status?: string | null
          id?: string
          requested_at?: string | null
          signatories?: Json | null
          sr_id?: string | null
          sr_status?: string | null
          tenant_id?: string
        }
        Update: {
          activated_at?: string | null
          agreement_id?: string | null
          completed_at?: string | null
          created_by?: string | null
          document_hash?: string
          document_id?: string | null
          document_type?: string
          error_message?: string | null
          evidence_id?: string | null
          evidence_status?: string | null
          id?: string
          requested_at?: string | null
          signatories?: Json | null
          sr_id?: string | null
          sr_status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qtsp_signature_requests_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      rbac_roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_system: boolean | null
          permissions: Json
          role_code: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean | null
          permissions?: Json
          role_code: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean | null
          permissions?: Json
          role_code?: string
        }
        Relationships: []
      }
      rbac_user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          role_id: string
          tenant_id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rbac_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "rbac_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_filings: {
        Row: {
          agreement_id: string | null
          borme_ref: string | null
          conservatoria_ref: string | null
          created_at: string
          deed_id: string | null
          defect_details: Json | null
          diario_oficial_ref: string | null
          estimated_resolution: string | null
          filing_number: string | null
          filing_via: string
          id: string
          inscription_number: string | null
          jucerja_ref: string | null
          presentation_date: string | null
          psm_ref: string | null
          resolution_document_url: string | null
          siger_ref: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          borme_ref?: string | null
          conservatoria_ref?: string | null
          created_at?: string
          deed_id?: string | null
          defect_details?: Json | null
          diario_oficial_ref?: string | null
          estimated_resolution?: string | null
          filing_number?: string | null
          filing_via?: string
          id?: string
          inscription_number?: string | null
          jucerja_ref?: string | null
          presentation_date?: string | null
          psm_ref?: string | null
          resolution_document_url?: string | null
          siger_ref?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          borme_ref?: string | null
          conservatoria_ref?: string | null
          created_at?: string
          deed_id?: string | null
          defect_details?: Json | null
          diario_oficial_ref?: string | null
          estimated_resolution?: string | null
          filing_number?: string | null
          filing_via?: string
          id?: string
          inscription_number?: string | null
          jucerja_ref?: string | null
          presentation_date?: string | null
          psm_ref?: string | null
          resolution_document_url?: string | null
          siger_ref?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_filings_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_filings_deed_id_fkey"
            columns: ["deed_id"]
            isOneToOne: false
            referencedRelation: "deeds"
            referencedColumns: ["id"]
          },
        ]
      }
      regulatory_notifications: {
        Row: {
          ack_evidence_id: string | null
          authority: string
          created_at: string | null
          created_by: string | null
          hash_sha512: string | null
          id: string
          incident_id: string | null
          legal_hold: boolean | null
          notification_deadline: string | null
          notification_type: string | null
          reference_number: string | null
          status: string | null
          submitted_at: string | null
          tenant_id: string
        }
        Insert: {
          ack_evidence_id?: string | null
          authority: string
          created_at?: string | null
          created_by?: string | null
          hash_sha512?: string | null
          id?: string
          incident_id?: string | null
          legal_hold?: boolean | null
          notification_deadline?: string | null
          notification_type?: string | null
          reference_number?: string | null
          status?: string | null
          submitted_at?: string | null
          tenant_id: string
        }
        Update: {
          ack_evidence_id?: string | null
          authority?: string
          created_at?: string | null
          created_by?: string | null
          hash_sha512?: string | null
          id?: string
          incident_id?: string | null
          legal_hold?: boolean | null
          notification_deadline?: string | null
          notification_type?: string | null
          reference_number?: string | null
          status?: string | null
          submitted_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_notifications_ack_evidence_id_fkey"
            columns: ["ack_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_notifications_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      representaciones: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          entity_id: string
          evidence: Json
          id: string
          meeting_id: string | null
          porcentaje_delegado: number | null
          representative_person_id: string
          represented_person_id: string
          scope: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          entity_id: string
          evidence?: Json
          id?: string
          meeting_id?: string | null
          porcentaje_delegado?: number | null
          representative_person_id: string
          represented_person_id: string
          scope: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          entity_id?: string
          evidence?: Json
          id?: string
          meeting_id?: string | null
          porcentaje_delegado?: number | null
          representative_person_id?: string
          represented_person_id?: string
          scope?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "representaciones_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representaciones_representative_person_id_fkey"
            columns: ["representative_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "representaciones_represented_person_id_fkey"
            columns: ["represented_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          applies_to: string | null
          created_at: string | null
          id: string
          legal_basis: string | null
          name: string
          retention_days: number
          tenant_id: string
        }
        Insert: {
          applies_to?: string | null
          created_at?: string | null
          id?: string
          legal_basis?: string | null
          name: string
          retention_days?: number
          tenant_id: string
        }
        Update: {
          applies_to?: string | null
          created_at?: string | null
          id?: string
          legal_basis?: string | null
          name?: string
          retention_days?: number
          tenant_id?: string
        }
        Relationships: []
      }
      risks: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          entity_id: string | null
          finding_id: string | null
          id: string
          impact: number | null
          inherent_score: number | null
          module_id: string | null
          obligation_id: string | null
          owner_id: string | null
          probability: number | null
          residual_score: number | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          finding_id?: string | null
          id?: string
          impact?: number | null
          inherent_score?: number | null
          module_id?: string | null
          obligation_id?: string | null
          owner_id?: string | null
          probability?: number | null
          residual_score?: number | null
          status?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          entity_id?: string | null
          finding_id?: string | null
          id?: string
          impact?: number | null
          inherent_score?: number | null
          module_id?: string | null
          obligation_id?: string | null
          owner_id?: string | null
          probability?: number | null
          residual_score?: number | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_change_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          change_description: string | null
          created_at: string | null
          id: string
          payload_after: Json | null
          payload_before: Json | null
          resource_id: string
          resource_type: string
          sequence_no: number
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          change_description?: string | null
          created_at?: string | null
          id?: string
          payload_after?: Json | null
          payload_before?: Json | null
          resource_id: string
          resource_type: string
          sequence_no?: never
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          change_description?: string | null
          created_at?: string | null
          id?: string
          payload_after?: Json | null
          payload_before?: Json | null
          resource_id?: string
          resource_type?: string
          sequence_no?: never
          tenant_id?: string
        }
        Relationships: []
      }
      rule_evaluation_results: {
        Row: {
          agreement_id: string
          created_at: string | null
          etapa: string
          explain: Json
          id: string
          ok: boolean
          rule_pack_id: string | null
          rule_pack_version: string | null
          tenant_id: string
          tsq_token: string | null
        }
        Insert: {
          agreement_id: string
          created_at?: string | null
          etapa: string
          explain: Json
          id?: string
          ok: boolean
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          tenant_id: string
          tsq_token?: string | null
        }
        Update: {
          agreement_id?: string
          created_at?: string | null
          etapa?: string
          explain?: Json
          id?: string
          ok?: boolean
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          tenant_id?: string
          tsq_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_evaluation_results_agreement_fk"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_evaluation_results_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_pack_versions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          pack_id: string
          payload: Json
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pack_id: string
          payload: Json
          version: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          pack_id?: string
          payload?: Json
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_pack_versions_pack_fk"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "rule_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_packs: {
        Row: {
          created_at: string | null
          descripcion: string
          id: string
          materia: string
          organo_tipo: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          descripcion: string
          id: string
          materia: string
          organo_tipo?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string
          id?: string
          materia?: string
          organo_tipo?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_packs_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_param_overrides: {
        Row: {
          clave: string
          created_at: string | null
          entity_id: string
          fuente: string
          id: string
          materia: string
          referencia: string | null
          tenant_id: string
          valor: Json
        }
        Insert: {
          clave: string
          created_at?: string | null
          entity_id: string
          fuente: string
          id?: string
          materia: string
          referencia?: string | null
          tenant_id: string
          valor: Json
        }
        Update: {
          clave?: string
          created_at?: string | null
          entity_id?: string
          fuente?: string
          id?: string
          materia?: string
          referencia?: string | null
          tenant_id?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rule_param_overrides_entity_fk"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_param_overrides_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_audit_log: {
        Row: {
          actor_id: string | null
          entity_id: string
          entity_type: string
          event: string
          hash: string | null
          id: string
          occurred_at: string
          payload: Json | null
          prev_hash: string | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          entity_id: string
          entity_type: string
          event: string
          hash?: string | null
          id?: string
          occurred_at?: string
          payload?: Json | null
          prev_hash?: string | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          entity_id?: string
          entity_type?: string
          event?: string
          hash?: string | null
          id?: string
          occurred_at?: string
          payload?: Json | null
          prev_hash?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      secretaria_role_assignments: {
        Row: {
          assigned_by: string | null
          assigned_date: string | null
          body_id: string | null
          created_at: string | null
          entity_id: string | null
          id: string
          person_id: string
          role: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_date?: string | null
          body_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          person_id: string
          role: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_date?: string | null
          body_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          id?: string
          person_id?: string
          role?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_role_assignments_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_role_assignments_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_role_assignments_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      share_classes: {
        Row: {
          class_code: string
          created_at: string
          economic_rights_coeff: number
          entity_id: string
          id: string
          name: string
          tenant_id: string
          veto_rights: boolean
          votes_per_title: number
          voting_rights: boolean
        }
        Insert: {
          class_code: string
          created_at?: string
          economic_rights_coeff?: number
          entity_id: string
          id?: string
          name: string
          tenant_id: string
          veto_rights?: boolean
          votes_per_title?: number
          voting_rights?: boolean
        }
        Update: {
          class_code?: string
          created_at?: string
          economic_rights_coeff?: number
          entity_id?: string
          id?: string
          name?: string
          tenant_id?: string
          veto_rights?: boolean
          votes_per_title?: number
          voting_rights?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "share_classes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      sod_toxic_pairs: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          role_a: string
          role_b: string
          severity: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          role_a: string
          role_b: string
          severity?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          role_a?: string
          role_b?: string
          severity?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          country_code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_tenant_id: string | null
          tenant_type: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_tenant_id?: string | null
          tenant_type: string
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_tenant_id?: string | null
          tenant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_parent_tenant_id_fkey"
            columns: ["parent_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      unipersonal_decisions: {
        Row: {
          content: string | null
          created_at: string
          decided_by_id: string | null
          decision_date: string | null
          decision_type: string
          entity_id: string | null
          id: string
          requires_registry: boolean
          status: string
          tenant_id: string
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          decided_by_id?: string | null
          decision_date?: string | null
          decision_type: string
          entity_id?: string | null
          id?: string
          requires_registry?: boolean
          status?: string
          tenant_id: string
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          decided_by_id?: string | null
          decision_date?: string | null
          decision_type?: string
          entity_id?: string | null
          id?: string
          requires_registry?: boolean
          status?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "unipersonal_decisions_decided_by_id_fkey"
            columns: ["decided_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unipersonal_decisions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          scope_entity_id: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          scope_entity_id?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          scope_entity_id?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_scope_entity_id_fkey"
            columns: ["scope_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vulnerabilities: {
        Row: {
          asset_name: string | null
          created_at: string | null
          cve_id: string | null
          cvss_score: number | null
          id: string
          remediation_due: string | null
          severity: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          asset_name?: string | null
          created_at?: string | null
          cve_id?: string | null
          cvss_score?: number | null
          id?: string
          remediation_due?: string | null
          severity?: string | null
          status?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          asset_name?: string | null
          created_at?: string | null
          cve_id?: string | null
          cvss_score?: number | null
          id?: string
          remediation_due?: string | null
          severity?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "vulnerabilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      sii_actions_view: {
        Row: {
          action: string | null
          action_date: string | null
          actor: string | null
          case_id: string | null
          id: string | null
        }
        Relationships: []
      }
      sii_cases_view: {
        Row: {
          channel: string | null
          classification: string | null
          closed_date: string | null
          closing_reason: string | null
          country: string | null
          id: string | null
          investigator_id: string | null
          investigator_name: string | null
          is_anonymous: boolean | null
          received_date: string | null
          reference: string | null
          status: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      sii_evidences_view: {
        Row: {
          case_id: string | null
          created_at: string | null
          file_url: string | null
          id: string | null
          is_encrypted: boolean | null
          status: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string | null
          is_encrypted?: boolean | null
          status?: never
          title?: string | null
          type?: never
        }
        Update: {
          case_id?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string | null
          is_encrypted?: boolean | null
          status?: never
          title?: string | null
          type?: never
        }
        Relationships: []
      }
    }
    Functions: {
      fn_check_sod_violations: {
        Args: {
          p_proposed_role: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: {
          conflicting_role: string
          reason: string
          severity: string
        }[]
      }
      fn_crear_censo_snapshot: {
        Args: {
          p_body_id: string
          p_entity_id: string
          p_meeting_id: string
          p_session_kind: string
          p_snapshot_type: string
        }
        Returns: string
      }
      fn_refresh_parte_votante_body: {
        Args: { p_body_id: string }
        Returns: undefined
      }
      fn_refresh_parte_votante_entity: {
        Args: { p_entity_id: string }
        Returns: undefined
      }
      fn_verify_audit_chain: {
        Args: { p_tenant_id: string }
        Returns: {
          chain_valid: boolean
          first_entry_at: string
          last_entry_at: string
          total_entries: number
        }[]
      }
    }
    Enums: {
      user_role_type:
        | "SECRETARIO"
        | "CONSEJERO"
        | "COMPLIANCE"
        | "ADMIN_TENANT"
        | "AUDITOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role_type: [
        "SECRETARIO",
        "CONSEJERO",
        "COMPLIANCE",
        "ADMIN_TENANT",
        "AUDITOR",
      ],
    },
  },
} as const

