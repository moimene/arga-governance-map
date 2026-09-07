// Tipos del esquema de `governance_OS` (hzqwefkwsxopwrmtksbg), GENERADOS.
//
// Generado el 2026-09-07 con:
//   supabase gen types typescript --db-url "postgresql://postgres.<ref>:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
// (introspección de solo lectura; la contraseña vive en .env como DATABASE_PASSWORD).
// No editar a mano: regenerar con el mismo comando.
//
// NO ESTÁ CABLEADO AL CLIENTE, y es deliberado. `client.ts` sigue siendo
// `createClient(...)` sin el genérico. MEDIDO el 2026-09-07: con
// `createClient<Database>(...)` el repo pasa de 0 a 183 errores de `tsc -b` en
// 48 ficheros (66 TS2352 de casts sobre retornos `Json` de RPC, 51 TS2769 de
// overloads de insert/update, 32 TS2345, 24 TS2322, 8 TS2339). El proyecto usa
// TS relajado a propósito (`noImplicitAny:false`, `strictNullChecks:false`) y
// prohíbe añadir anotaciones donde no las había: tiparlo es una migración de su
// propio tamaño, no un arreglo de una pasada.
//
// Lo que esa medición SÍ destapó, y queda anotado para quien migre (ficheros de
// otro carril, no tocados aquí):
//   - src/lib/doc-gen/variable-resolver.ts lee `entities.tax_id` y
//     `entities.bylaws_commission_article`; ninguna de las dos existe en las 53
//     columnas de `entities`, así que `nif`/`cif`/`articulo_estatutos_comision`
//     caen siempre al fallback.
//   - src/lib/doc-gen/variable-resolver.ts:381 consulta la tabla
//     `meeting_participants`, que no existe en Cloud (la real es
//     `meeting_attendees`): la lista de participantes del documento sale vacía.
//
// El gemelo `supabase/functions/_types/database.ts` es la copia de las Edge
// Functions y está congelado en mayo de 2026 (le faltan, por ejemplo, las
// tablas `aims_fria_*`). Este fichero es el que refleja Cloud hoy.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      agenda_draft: {
        Row: {
          convocatoria_id: string | null
          created_at: string
          decidido_at: string | null
          decidido_by: string | null
          descripcion: string | null
          entity_id: string | null
          estado: string
          evidencia: Json | null
          id: string
          materia: string | null
          origen_evento: string | null
          origen_modulo: string
          origen_ref: string | null
          owner_id: string | null
          tenant_id: string
          titulo: string
        }
        Insert: {
          convocatoria_id?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_by?: string | null
          descripcion?: string | null
          entity_id?: string | null
          estado?: string
          evidencia?: Json | null
          id?: string
          materia?: string | null
          origen_evento?: string | null
          origen_modulo: string
          origen_ref?: string | null
          owner_id?: string | null
          tenant_id: string
          titulo: string
        }
        Update: {
          convocatoria_id?: string | null
          created_at?: string
          decidido_at?: string | null
          decidido_by?: string | null
          descripcion?: string | null
          entity_id?: string | null
          estado?: string
          evidencia?: Json | null
          id?: string
          materia?: string | null
          origen_evento?: string | null
          origen_modulo?: string
          origen_ref?: string | null
          owner_id?: string | null
          tenant_id?: string
          titulo?: string
        }
        Relationships: []
      }
      agenda_item_constancias: {
        Row: {
          agenda_item_id: string
          attachments: Json
          created_at: string
          created_by: string | null
          follow_ups: Json
          id: string
          kind: string
          meeting_id: string
          participants: Json
          summary: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          agenda_item_id: string
          attachments?: Json
          created_at?: string
          created_by?: string | null
          follow_ups?: Json
          id?: string
          kind: string
          meeting_id: string
          participants?: Json
          summary?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          agenda_item_id?: string
          attachments?: Json
          created_at?: string
          created_by?: string | null
          follow_ups?: Json
          id?: string
          kind?: string
          meeting_id?: string
          participants?: Json
          summary?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_item_constancias_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_item_constancias_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_item_constancias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_item_kind_changelog: {
        Row: {
          agenda_item_id: string
          autor: string | null
          created_at: string | null
          from_kind: string
          id: string
          meeting_id: string
          meeting_status_at_change: string
          motivo: string
          tenant_id: string
          to_kind: string
        }
        Insert: {
          agenda_item_id: string
          autor?: string | null
          created_at?: string | null
          from_kind: string
          id?: string
          meeting_id: string
          meeting_status_at_change: string
          motivo: string
          tenant_id: string
          to_kind: string
        }
        Update: {
          agenda_item_id?: string
          autor?: string | null
          created_at?: string | null
          from_kind?: string
          id?: string
          meeting_id?: string
          meeting_status_at_change?: string
          motivo?: string
          tenant_id?: string
          to_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_item_kind_changelog_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "changelog_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_items: {
        Row: {
          created_at: string | null
          created_by: string | null
          decision_subtype: string | null
          description: string | null
          id: string
          kind: string
          legacy_migrated: boolean
          legacy_source_agreement_id: string | null
          matter_code: string | null
          meeting_id: string
          order_number: number
          proposal_text: string | null
          requires_attachments: boolean
          requires_vote: string
          source_convocatoria_id: string | null
          source_convocatoria_item_index: number | null
          source_item_hash_sha256: string | null
          tenant_id: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          decision_subtype?: string | null
          description?: string | null
          id?: string
          kind?: string
          legacy_migrated?: boolean
          legacy_source_agreement_id?: string | null
          matter_code?: string | null
          meeting_id: string
          order_number: number
          proposal_text?: string | null
          requires_attachments?: boolean
          requires_vote?: string
          source_convocatoria_id?: string | null
          source_convocatoria_item_index?: number | null
          source_item_hash_sha256?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          decision_subtype?: string | null
          description?: string | null
          id?: string
          kind?: string
          legacy_migrated?: boolean
          legacy_source_agreement_id?: string | null
          matter_code?: string | null
          meeting_id?: string
          order_number?: number
          proposal_text?: string | null
          requires_attachments?: boolean
          requires_vote?: string
          source_convocatoria_id?: string | null
          source_convocatoria_item_index?: number | null
          source_item_hash_sha256?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_legacy_source_agreement_id_fkey"
            columns: ["legacy_source_agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_source_convocatoria_id_fkey"
            columns: ["source_convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_document_links: {
        Row: {
          artifact_id: string
          created_at: string
          id: string
          link_role: string
          requirement_id: string
          tenant_id: string
        }
        Insert: {
          artifact_id: string
          created_at?: string
          id?: string
          link_role?: string
          requirement_id: string
          tenant_id: string
        }
        Update: {
          artifact_id?: string
          created_at?: string
          id?: string
          link_role?: string
          requirement_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_document_links_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_document_links_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "agreement_document_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_document_requirements: {
        Row: {
          agreement_id: string
          annex_targets: string[]
          blocking_policy: string
          condition: Json
          created_at: string
          document_kind: string
          evidence_policy: Json
          explain: Json
          fase: string
          id: string
          legal_basis: string | null
          matter_code: string
          normative_snapshot_hash: string | null
          override_reason: string | null
          required_level: string
          requirement_code: string
          rule_pack_version_id: string | null
          source_layer: string | null
          source_ref: string | null
          status: string
          template_binding_key: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          agreement_id: string
          annex_targets?: string[]
          blocking_policy: string
          condition?: Json
          created_at?: string
          document_kind: string
          evidence_policy?: Json
          explain?: Json
          fase: string
          id?: string
          legal_basis?: string | null
          matter_code: string
          normative_snapshot_hash?: string | null
          override_reason?: string | null
          required_level: string
          requirement_code: string
          rule_pack_version_id?: string | null
          source_layer?: string | null
          source_ref?: string | null
          status?: string
          template_binding_key?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string
          annex_targets?: string[]
          blocking_policy?: string
          condition?: Json
          created_at?: string
          document_kind?: string
          evidence_policy?: Json
          explain?: Json
          fase?: string
          id?: string
          legal_basis?: string | null
          matter_code?: string
          normative_snapshot_hash?: string | null
          override_reason?: string | null
          required_level?: string
          requirement_code?: string
          rule_pack_version_id?: string | null
          source_layer?: string | null
          source_ref?: string | null
          status?: string
          template_binding_key?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreement_document_requirements_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_document_requirements_rule_pack_version_id_fkey"
            columns: ["rule_pack_version_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          adoption_mode: string
          agenda_item_id: string | null
          agreement_kind: string
          approval_workflow: Json | null
          approved_by: string | null
          body_id: string | null
          code: string | null
          compliance_explain: Json | null
          compliance_snapshot: Json | null
          comunicacion_manual: boolean
          created_at: string
          created_by: string | null
          decision_date: string | null
          decision_text: string | null
          document_url: string | null
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
          agenda_item_id?: string | null
          agreement_kind: string
          approval_workflow?: Json | null
          approved_by?: string | null
          body_id?: string | null
          code?: string | null
          compliance_explain?: Json | null
          compliance_snapshot?: Json | null
          comunicacion_manual?: boolean
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          decision_text?: string | null
          document_url?: string | null
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
          agenda_item_id?: string | null
          agreement_kind?: string
          approval_workflow?: Json | null
          approved_by?: string | null
          body_id?: string | null
          code?: string | null
          compliance_explain?: Json | null
          compliance_snapshot?: Json | null
          comunicacion_manual?: boolean
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          decision_text?: string | null
          document_url?: string | null
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
            foreignKeyName: "agreements_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "agreements_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
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
          aims_reference_code: string | null
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
          aims_reference_code?: string | null
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
          aims_reference_code?: string | null
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
      aims_change_requests: {
        Row: {
          approvals: Json
          approved_at: string | null
          approved_by_id: string | null
          change_type: string | null
          created_at: string
          evidence_refs: Json
          id: string
          impact_assessment: Json
          legal_hold: boolean
          requested_at: string
          requested_by_id: string | null
          retention_until: string | null
          source_version_id: string | null
          status: string
          system_id: string
          target_version_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          approvals?: Json
          approved_at?: string | null
          approved_by_id?: string | null
          change_type?: string | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          impact_assessment?: Json
          legal_hold?: boolean
          requested_at?: string
          requested_by_id?: string | null
          retention_until?: string | null
          source_version_id?: string | null
          status?: string
          system_id: string
          target_version_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          approvals?: Json
          approved_at?: string | null
          approved_by_id?: string | null
          change_type?: string | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          impact_assessment?: Json
          legal_hold?: boolean
          requested_at?: string
          requested_by_id?: string | null
          retention_until?: string | null
          source_version_id?: string | null
          status?: string
          system_id?: string
          target_version_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_change_requests_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_change_requests_requested_by_id_fkey"
            columns: ["requested_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_change_requests_source_version_id_fkey"
            columns: ["source_version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_change_requests_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_change_requests_target_version_id_fkey"
            columns: ["target_version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_change_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_component_inventory: {
        Row: {
          component_name: string
          component_type: string
          configuration: Json
          created_at: string
          criticality: string | null
          dependencies: Json
          id: string
          legal_hold: boolean
          owner_role: string | null
          retention_until: string | null
          risk_notes: Json
          status: string
          supplier: string | null
          system_id: string
          tenant_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          component_name: string
          component_type: string
          configuration?: Json
          created_at?: string
          criticality?: string | null
          dependencies?: Json
          id?: string
          legal_hold?: boolean
          owner_role?: string | null
          retention_until?: string | null
          risk_notes?: Json
          status?: string
          supplier?: string | null
          system_id: string
          tenant_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          component_name?: string
          component_type?: string
          configuration?: Json
          created_at?: string
          criticality?: string | null
          dependencies?: Json
          id?: string
          legal_hold?: boolean
          owner_role?: string | null
          retention_until?: string | null
          risk_notes?: Json
          status?: string
          supplier?: string | null
          system_id?: string
          tenant_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_component_inventory_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_component_inventory_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_component_inventory_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_control_catalog: {
        Row: {
          control_code: string
          created_at: string
          description: string | null
          domain: string | null
          id: string
          name: string
          owner_role: string | null
          payload: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          control_code: string
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          name: string
          owner_role?: string | null
          payload?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          control_code?: string
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          name?: string
          owner_role?: string | null
          payload?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_control_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_control_tests: {
        Row: {
          control_id: string
          created_at: string
          evidence_refs: Json
          executed_at: string | null
          executed_by_id: string | null
          id: string
          legal_hold: boolean
          next_test_at: string | null
          payload: Json
          requirement_check_id: string | null
          result: string | null
          retention_until: string | null
          status: string
          system_id: string
          tenant_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          control_id: string
          created_at?: string
          evidence_refs?: Json
          executed_at?: string | null
          executed_by_id?: string | null
          id?: string
          legal_hold?: boolean
          next_test_at?: string | null
          payload?: Json
          requirement_check_id?: string | null
          result?: string | null
          retention_until?: string | null
          status?: string
          system_id: string
          tenant_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          control_id?: string
          created_at?: string
          evidence_refs?: Json
          executed_at?: string | null
          executed_by_id?: string | null
          id?: string
          legal_hold?: boolean
          next_test_at?: string | null
          payload?: Json
          requirement_check_id?: string | null
          result?: string | null
          retention_until?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_control_tests_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "aims_control_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_control_tests_executed_by_id_fkey"
            columns: ["executed_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_control_tests_requirement_check_id_fkey"
            columns: ["requirement_check_id"]
            isOneToOne: false
            referencedRelation: "aims_requirement_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_control_tests_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_control_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_control_tests_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_dataset_registry: {
        Row: {
          created_at: string
          data_categories: Json
          dataset_name: string
          dataset_type: string | null
          id: string
          lawful_basis: string | null
          legal_hold: boolean
          lineage: Json
          quality_metrics: Json
          retention_until: string | null
          source_system: string | null
          status: string
          system_id: string
          tenant_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          data_categories?: Json
          dataset_name: string
          dataset_type?: string | null
          id?: string
          lawful_basis?: string | null
          legal_hold?: boolean
          lineage?: Json
          quality_metrics?: Json
          retention_until?: string | null
          source_system?: string | null
          status?: string
          system_id: string
          tenant_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          data_categories?: Json
          dataset_name?: string
          dataset_type?: string | null
          id?: string
          lawful_basis?: string | null
          legal_hold?: boolean
          lineage?: Json
          quality_metrics?: Json
          retention_until?: string | null
          source_system?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_dataset_registry_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_dataset_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_dataset_registry_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_evidence_packs: {
        Row: {
          created_at: string
          evidence_bundle_id: string | null
          id: string
          legal_hold: boolean
          manifest: Json
          manifest_hash: string | null
          pack_type: string
          qseal_token: string | null
          retention_until: string | null
          sealed_at: string | null
          status: string
          system_id: string
          tenant_id: string
          title: string
          tsq_token: string | null
          updated_at: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          evidence_bundle_id?: string | null
          id?: string
          legal_hold?: boolean
          manifest?: Json
          manifest_hash?: string | null
          pack_type?: string
          qseal_token?: string | null
          retention_until?: string | null
          sealed_at?: string | null
          status?: string
          system_id: string
          tenant_id: string
          title: string
          tsq_token?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          evidence_bundle_id?: string | null
          id?: string
          legal_hold?: boolean
          manifest?: Json
          manifest_hash?: string | null
          pack_type?: string
          qseal_token?: string | null
          retention_until?: string | null
          sealed_at?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          title?: string
          tsq_token?: string | null
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_evidence_packs_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_evidence_packs_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_evidence_packs_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_evidence_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_evidence_packs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_fria_affected_groups: {
        Row: {
          created_at: string
          fria_id: string
          group_description: string | null
          group_name: string
          id: string
          impact_type: string
          is_data_subject_only: boolean
          is_vulnerable_group: boolean
          tenant_id: string
          vulnerability_factors: string | null
        }
        Insert: {
          created_at?: string
          fria_id: string
          group_description?: string | null
          group_name: string
          id?: string
          impact_type?: string
          is_data_subject_only?: boolean
          is_vulnerable_group?: boolean
          tenant_id: string
          vulnerability_factors?: string | null
        }
        Update: {
          created_at?: string
          fria_id?: string
          group_description?: string | null
          group_name?: string
          id?: string
          impact_type?: string
          is_data_subject_only?: boolean
          is_vulnerable_group?: boolean
          tenant_id?: string
          vulnerability_factors?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_affected_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_affected_groups_tenant_id_fria_id_fkey"
            columns: ["tenant_id", "fria_id"]
            isOneToOne: false
            referencedRelation: "aims_fria_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_fria_assessments: {
        Row: {
          approved_by_ai_officer: string | null
          approved_by_dpo: string | null
          assessed_by: string | null
          created_at: string
          fria_summary: string | null
          id: string
          market_surveillance_notified: boolean
          notification_date: string | null
          status: string
          system_id: string
          tenant_id: string
          title: string
          updated_at: string
          version_id: string | null
          version_number: number
        }
        Insert: {
          approved_by_ai_officer?: string | null
          approved_by_dpo?: string | null
          assessed_by?: string | null
          created_at?: string
          fria_summary?: string | null
          id?: string
          market_surveillance_notified?: boolean
          notification_date?: string | null
          status?: string
          system_id: string
          tenant_id: string
          title: string
          updated_at?: string
          version_id?: string | null
          version_number?: number
        }
        Update: {
          approved_by_ai_officer?: string | null
          approved_by_dpo?: string | null
          assessed_by?: string | null
          created_at?: string
          fria_summary?: string | null
          id?: string
          market_surveillance_notified?: boolean
          notification_date?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          version_id?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_assessments_tenant_id_system_id_fkey"
            columns: ["tenant_id", "system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "aims_fria_assessments_tenant_id_version_id_fkey"
            columns: ["tenant_id", "version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_fria_dpia_cross_references: {
        Row: {
          ai_officer_signoff_by: string | null
          coverage_type: string
          created_at: string
          dpia_ref_id: string
          dpia_section: string
          dpo_signoff_by: string | null
          fria_id: string
          id: string
          notes: string | null
          ria_obligation_point: string
          source_hash: string | null
          tenant_id: string
          updated_at: string
          validation_status: string
        }
        Insert: {
          ai_officer_signoff_by?: string | null
          coverage_type?: string
          created_at?: string
          dpia_ref_id: string
          dpia_section: string
          dpo_signoff_by?: string | null
          fria_id: string
          id?: string
          notes?: string | null
          ria_obligation_point: string
          source_hash?: string | null
          tenant_id: string
          updated_at?: string
          validation_status?: string
        }
        Update: {
          ai_officer_signoff_by?: string | null
          coverage_type?: string
          created_at?: string
          dpia_ref_id?: string
          dpia_section?: string
          dpo_signoff_by?: string | null
          fria_id?: string
          id?: string
          notes?: string | null
          ria_obligation_point?: string
          source_hash?: string | null
          tenant_id?: string
          updated_at?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_dpia_cross_references_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_dpia_cross_references_tenant_id_fria_id_fkey"
            columns: ["tenant_id", "fria_id"]
            isOneToOne: false
            referencedRelation: "aims_fria_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_fria_fundamental_rights_risks: {
        Row: {
          created_at: string
          fria_id: string
          fundamental_right: string
          harm_scenario: string
          id: string
          likelihood: string
          mitigation_measures: string | null
          provider_info_ref: string | null
          residual_risk: string
          severity: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          fria_id: string
          fundamental_right: string
          harm_scenario: string
          id?: string
          likelihood: string
          mitigation_measures?: string | null
          provider_info_ref?: string | null
          residual_risk?: string
          severity: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          fria_id?: string
          fundamental_right?: string
          harm_scenario?: string
          id?: string
          likelihood?: string
          mitigation_measures?: string | null
          provider_info_ref?: string | null
          residual_risk?: string
          severity?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_fundamental_rights_risks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_fundamental_rights_risks_tenant_id_fria_id_fkey"
            columns: ["tenant_id", "fria_id"]
            isOneToOne: false
            referencedRelation: "aims_fria_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_fria_process_map: {
        Row: {
          business_process: string
          created_at: string
          decision_point: string
          fria_id: string
          human_role: string | null
          id: string
          integration_notes: string | null
          intended_purpose: string
          tenant_id: string
        }
        Insert: {
          business_process: string
          created_at?: string
          decision_point: string
          fria_id: string
          human_role?: string | null
          id?: string
          integration_notes?: string | null
          intended_purpose: string
          tenant_id: string
        }
        Update: {
          business_process?: string
          created_at?: string
          decision_point?: string
          fria_id?: string
          human_role?: string | null
          id?: string
          integration_notes?: string | null
          intended_purpose?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_process_map_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_process_map_tenant_id_fria_id_fkey"
            columns: ["tenant_id", "fria_id"]
            isOneToOne: false
            referencedRelation: "aims_fria_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_fria_remediation_governance: {
        Row: {
          board_escalation_threshold: string | null
          complaint_channel: string
          created_at: string
          fria_id: string
          governance_body_id: string | null
          id: string
          redress_procedure: string
          rollback_strategy: string | null
          tenant_id: string
          trigger_event: string
        }
        Insert: {
          board_escalation_threshold?: string | null
          complaint_channel: string
          created_at?: string
          fria_id: string
          governance_body_id?: string | null
          id?: string
          redress_procedure: string
          rollback_strategy?: string | null
          tenant_id: string
          trigger_event: string
        }
        Update: {
          board_escalation_threshold?: string | null
          complaint_channel?: string
          created_at?: string
          fria_id?: string
          governance_body_id?: string | null
          id?: string
          redress_procedure?: string
          rollback_strategy?: string | null
          tenant_id?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_remediation_governance_governance_body_id_fkey"
            columns: ["governance_body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_remediation_governance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_remediation_governance_tenant_id_fria_id_fkey"
            columns: ["tenant_id", "fria_id"]
            isOneToOne: false
            referencedRelation: "aims_fria_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_fria_use_profile: {
        Row: {
          created_at: string
          estimated_volume: string | null
          fria_id: string
          id: string
          planned_end_date: string | null
          planned_start_date: string | null
          review_periodicity: string | null
          tenant_id: string
          usage_frequency: string
        }
        Insert: {
          created_at?: string
          estimated_volume?: string | null
          fria_id: string
          id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          review_periodicity?: string | null
          tenant_id: string
          usage_frequency: string
        }
        Update: {
          created_at?: string
          estimated_volume?: string | null
          fria_id?: string
          id?: string
          planned_end_date?: string | null
          planned_start_date?: string | null
          review_periodicity?: string | null
          tenant_id?: string
          usage_frequency?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_fria_use_profile_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_fria_use_profile_tenant_id_fria_id_fkey"
            columns: ["tenant_id", "fria_id"]
            isOneToOne: false
            referencedRelation: "aims_fria_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_incident_evidence_packs: {
        Row: {
          chain_of_custody: Json
          closed_at: string | null
          created_at: string
          evidence_pack_id: string | null
          id: string
          incident_id: string | null
          legal_hold: boolean
          manifest_hash: string | null
          reported_at: string | null
          retention_until: string | null
          severity: string | null
          snapshot: Json
          status: string
          system_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          chain_of_custody?: Json
          closed_at?: string | null
          created_at?: string
          evidence_pack_id?: string | null
          id?: string
          incident_id?: string | null
          legal_hold?: boolean
          manifest_hash?: string | null
          reported_at?: string | null
          retention_until?: string | null
          severity?: string | null
          snapshot?: Json
          status?: string
          system_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          chain_of_custody?: Json
          closed_at?: string | null
          created_at?: string
          evidence_pack_id?: string | null
          id?: string
          incident_id?: string | null
          legal_hold?: boolean
          manifest_hash?: string | null
          reported_at?: string | null
          retention_until?: string | null
          severity?: string | null
          snapshot?: Json
          status?: string
          system_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_incident_evidence_packs_evidence_pack_id_fkey"
            columns: ["evidence_pack_id"]
            isOneToOne: false
            referencedRelation: "aims_evidence_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_evidence_packs_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "ai_incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_evidence_packs_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_evidence_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_incident_regimes: {
        Row: {
          applicability_rationale: string | null
          closed_at: string | null
          closure_reason: string | null
          created_at: string
          entity_id: string | null
          evidence_bundle_id: string | null
          id: string
          incident_id: string
          lead_role: string
          metadata: Json
          regime_code: string
          status: string
          target_authority: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applicability_rationale?: string | null
          closed_at?: string | null
          closure_reason?: string | null
          created_at?: string
          entity_id?: string | null
          evidence_bundle_id?: string | null
          id?: string
          incident_id: string
          lead_role: string
          metadata?: Json
          regime_code: string
          status?: string
          target_authority: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applicability_rationale?: string | null
          closed_at?: string | null
          closure_reason?: string | null
          created_at?: string
          entity_id?: string | null
          evidence_bundle_id?: string | null
          id?: string
          incident_id?: string
          lead_role?: string
          metadata?: Json
          regime_code?: string
          status?: string
          target_authority?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_incident_regimes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_regimes_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_regimes_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_regimes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_regimes_tenant_id_incident_id_fkey"
            columns: ["tenant_id", "incident_id"]
            isOneToOne: false
            referencedRelation: "ai_incidents"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_incident_reports: {
        Row: {
          acknowledgment_ref: string | null
          authority: string
          content_summary: string | null
          created_at: string
          evidence_refs: Json
          id: string
          incident_regime_id: string
          is_complete: boolean
          manifest_hash: string | null
          report_type: string
          sent_at: string | null
          submission_channel: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acknowledgment_ref?: string | null
          authority: string
          content_summary?: string | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          incident_regime_id: string
          is_complete?: boolean
          manifest_hash?: string | null
          report_type: string
          sent_at?: string | null
          submission_channel?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acknowledgment_ref?: string | null
          authority?: string
          content_summary?: string | null
          created_at?: string
          evidence_refs?: Json
          id?: string
          incident_regime_id?: string
          is_complete?: boolean
          manifest_hash?: string | null
          report_type?: string
          sent_at?: string | null
          submission_channel?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_incident_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_incident_reports_tenant_id_incident_regime_id_fkey"
            columns: ["tenant_id", "incident_regime_id"]
            isOneToOne: false
            referencedRelation: "aims_incident_regimes"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_model_registry: {
        Row: {
          created_at: string
          id: string
          intended_use: string | null
          legal_hold: boolean
          limitations: Json
          model_name: string
          model_type: string | null
          model_version: string | null
          performance_metrics: Json
          provider: string | null
          retention_until: string | null
          status: string
          system_id: string
          tenant_id: string
          updated_at: string
          validation_results: Json
          version_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          intended_use?: string | null
          legal_hold?: boolean
          limitations?: Json
          model_name: string
          model_type?: string | null
          model_version?: string | null
          performance_metrics?: Json
          provider?: string | null
          retention_until?: string | null
          status?: string
          system_id: string
          tenant_id: string
          updated_at?: string
          validation_results?: Json
          version_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          intended_use?: string | null
          legal_hold?: boolean
          limitations?: Json
          model_name?: string
          model_type?: string | null
          model_version?: string | null
          performance_metrics?: Json
          provider?: string | null
          retention_until?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          updated_at?: string
          validation_results?: Json
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_model_registry_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_model_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_model_registry_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_monitoring_indicators: {
        Row: {
          created_at: string
          current_value: Json
          evidence_refs: Json
          id: string
          indicator_name: string
          last_observed_at: string | null
          legal_hold: boolean
          metric_key: string | null
          plan_id: string | null
          retention_until: string | null
          status: string
          system_id: string
          tenant_id: string
          threshold_config: Json
          updated_at: string
          version_id: string | null
        }
        Insert: {
          created_at?: string
          current_value?: Json
          evidence_refs?: Json
          id?: string
          indicator_name: string
          last_observed_at?: string | null
          legal_hold?: boolean
          metric_key?: string | null
          plan_id?: string | null
          retention_until?: string | null
          status?: string
          system_id: string
          tenant_id: string
          threshold_config?: Json
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          created_at?: string
          current_value?: Json
          evidence_refs?: Json
          id?: string
          indicator_name?: string
          last_observed_at?: string | null
          legal_hold?: boolean
          metric_key?: string | null
          plan_id?: string | null
          retention_until?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          threshold_config?: Json
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_monitoring_indicators_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "aims_post_market_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_monitoring_indicators_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_monitoring_indicators_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_monitoring_indicators_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_post_market_plans: {
        Row: {
          approved_at: string | null
          approved_by_id: string | null
          cadence: string | null
          created_at: string
          escalation_rules: Json
          id: string
          legal_hold: boolean
          monitoring_scope: Json
          plan_name: string
          retention_until: string | null
          status: string
          system_id: string
          tenant_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_id?: string | null
          cadence?: string | null
          created_at?: string
          escalation_rules?: Json
          id?: string
          legal_hold?: boolean
          monitoring_scope?: Json
          plan_name: string
          retention_until?: string | null
          status?: string
          system_id: string
          tenant_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_id?: string | null
          cadence?: string | null
          created_at?: string
          escalation_rules?: Json
          id?: string
          legal_hold?: boolean
          monitoring_scope?: Json
          plan_name?: string
          retention_until?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_post_market_plans_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_post_market_plans_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_post_market_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_post_market_plans_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_regulatory_clocks: {
        Row: {
          clock_type: string
          created_at: string
          deadline_at: string
          delay_justification: string | null
          id: string
          incident_regime_id: string
          status: string
          stopped_at: string | null
          tenant_id: string
          trigger_at: string
          updated_at: string
        }
        Insert: {
          clock_type: string
          created_at?: string
          deadline_at: string
          delay_justification?: string | null
          id?: string
          incident_regime_id: string
          status?: string
          stopped_at?: string | null
          tenant_id: string
          trigger_at?: string
          updated_at?: string
        }
        Update: {
          clock_type?: string
          created_at?: string
          deadline_at?: string
          delay_justification?: string | null
          id?: string
          incident_regime_id?: string
          status?: string
          stopped_at?: string | null
          tenant_id?: string
          trigger_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_regulatory_clocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_regulatory_clocks_tenant_id_incident_regime_id_fkey"
            columns: ["tenant_id", "incident_regime_id"]
            isOneToOne: false
            referencedRelation: "aims_incident_regimes"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      aims_requirement_catalog: {
        Row: {
          applicability: Json
          article_ref: string | null
          created_at: string
          description: string | null
          framework: string
          id: string
          payload: Json
          requirement_code: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          applicability?: Json
          article_ref?: string | null
          created_at?: string
          description?: string | null
          framework: string
          id?: string
          payload?: Json
          requirement_code: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          applicability?: Json
          article_ref?: string | null
          created_at?: string
          description?: string | null
          framework?: string
          id?: string
          payload?: Json
          requirement_code?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_requirement_catalog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_requirement_checks: {
        Row: {
          assessed_by_id: string | null
          checked_at: string | null
          created_at: string
          due_at: string | null
          evidence_refs: Json
          id: string
          legal_hold: boolean
          payload: Json
          requirement_id: string
          result: string | null
          retention_until: string | null
          status: string
          system_id: string
          tenant_id: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          assessed_by_id?: string | null
          checked_at?: string | null
          created_at?: string
          due_at?: string | null
          evidence_refs?: Json
          id?: string
          legal_hold?: boolean
          payload?: Json
          requirement_id: string
          result?: string | null
          retention_until?: string | null
          status?: string
          system_id: string
          tenant_id: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          assessed_by_id?: string | null
          checked_at?: string | null
          created_at?: string
          due_at?: string | null
          evidence_refs?: Json
          id?: string
          legal_hold?: boolean
          payload?: Json
          requirement_id?: string
          result?: string | null
          retention_until?: string | null
          status?: string
          system_id?: string
          tenant_id?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_requirement_checks_assessed_by_id_fkey"
            columns: ["assessed_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_requirement_checks_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "aims_requirement_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_requirement_checks_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_requirement_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_requirement_checks_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_system_versions: {
        Row: {
          change_summary: string | null
          control_snapshot: Json
          created_at: string
          dataset_snapshot: Json
          effective_from: string | null
          effective_to: string | null
          id: string
          legal_hold: boolean
          model_snapshot: Json
          release_stage: string
          retention_until: string | null
          status: string
          system_id: string
          technical_file_status: string
          tenant_id: string
          updated_at: string
          version_label: string
        }
        Insert: {
          change_summary?: string | null
          control_snapshot?: Json
          created_at?: string
          dataset_snapshot?: Json
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          legal_hold?: boolean
          model_snapshot?: Json
          release_stage?: string
          retention_until?: string | null
          status?: string
          system_id: string
          technical_file_status?: string
          tenant_id: string
          updated_at?: string
          version_label: string
        }
        Update: {
          change_summary?: string | null
          control_snapshot?: Json
          created_at?: string
          dataset_snapshot?: Json
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          legal_hold?: boolean
          model_snapshot?: Json
          release_stage?: string
          retention_until?: string | null
          status?: string
          system_id?: string
          technical_file_status?: string
          tenant_id?: string
          updated_at?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "aims_system_versions_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_system_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      aims_technical_file_sections: {
        Row: {
          content: Json
          created_at: string
          evidence_refs: Json
          id: string
          legal_hold: boolean
          retention_until: string | null
          reviewed_at: string | null
          reviewed_by_id: string | null
          section_code: string
          status: string
          system_id: string
          tenant_id: string
          title: string
          updated_at: string
          version_id: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          evidence_refs?: Json
          id?: string
          legal_hold?: boolean
          retention_until?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          section_code: string
          status?: string
          system_id: string
          tenant_id: string
          title: string
          updated_at?: string
          version_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          evidence_refs?: Json
          id?: string
          legal_hold?: boolean
          retention_until?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          section_code?: string
          status?: string
          system_id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aims_technical_file_sections_reviewed_by_id_fkey"
            columns: ["reviewed_by_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_technical_file_sections_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "ai_systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_technical_file_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aims_technical_file_sections_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "aims_system_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          agenda_item_index: number | null
          artifact_candidate_id: string | null
          artifact_kind: string
          artifact_registered_at: string | null
          artifact_registered_by: string | null
          artifact_verified_at: string | null
          artifact_verified_by_service: boolean
          artifact_verified_mime_type: string | null
          artifact_verified_size_bytes: number | null
          convocation_manifest_hash_sha512: string | null
          convocatoria_id: string | null
          file_hash: string | null
          file_hash_sha512: string | null
          file_name: string
          file_url: string
          id: string
          storage_object_etag: string | null
          supporting_attachment_intent_id: string | null
          tenant_id: string
          uploaded_at: string
        }
        Insert: {
          agenda_item_index?: number | null
          artifact_candidate_id?: string | null
          artifact_kind?: string
          artifact_registered_at?: string | null
          artifact_registered_by?: string | null
          artifact_verified_at?: string | null
          artifact_verified_by_service?: boolean
          artifact_verified_mime_type?: string | null
          artifact_verified_size_bytes?: number | null
          convocation_manifest_hash_sha512?: string | null
          convocatoria_id?: string | null
          file_hash?: string | null
          file_hash_sha512?: string | null
          file_name: string
          file_url: string
          id?: string
          storage_object_etag?: string | null
          supporting_attachment_intent_id?: string | null
          tenant_id: string
          uploaded_at?: string
        }
        Update: {
          agenda_item_index?: number | null
          artifact_candidate_id?: string | null
          artifact_kind?: string
          artifact_registered_at?: string | null
          artifact_registered_by?: string | null
          artifact_verified_at?: string | null
          artifact_verified_by_service?: boolean
          artifact_verified_mime_type?: string | null
          artifact_verified_size_bytes?: number | null
          convocation_manifest_hash_sha512?: string | null
          convocatoria_id?: string | null
          file_hash?: string | null
          file_hash_sha512?: string | null
          file_name?: string
          file_url?: string
          id?: string
          storage_object_etag?: string | null
          supporting_attachment_intent_id?: string | null
          tenant_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_artifact_candidate_id_fkey"
            columns: ["artifact_candidate_id"]
            isOneToOne: false
            referencedRelation: "convocation_artifact_candidates"
            referencedColumns: ["id"]
          },
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
          seq: number
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
          seq?: number
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
          seq?: number
          table_name?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      authority_evidence: {
        Row: {
          body_id: string | null
          cargo: string
          created_at: string
          entity_id: string
          estado: string
          fecha_fin: string | null
          fecha_inicio: string
          fuente_designacion: string
          id: string
          inscripcion_rm_fecha: string | null
          inscripcion_rm_referencia: string | null
          metadata: Json
          person_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_id?: string | null
          cargo: string
          created_at?: string
          entity_id: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio: string
          fuente_designacion: string
          id?: string
          inscripcion_rm_fecha?: string | null
          inscripcion_rm_referencia?: string | null
          metadata?: Json
          person_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_id?: string | null
          cargo?: string
          created_at?: string
          entity_id?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          fuente_designacion?: string
          id?: string
          inscripcion_rm_fecha?: string | null
          inscripcion_rm_referencia?: string | null
          metadata?: Json
          person_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authority_evidence_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_evidence_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_evidence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      autorizacion_regulatoria: {
        Row: {
          created_at: string
          documento_evidencia_id: string | null
          estado: string
          fecha_emision: string | null
          fecha_vigencia_hasta: string | null
          id: string
          materia: string | null
          organismo: string
          referencia: string
          sociedad_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          documento_evidencia_id?: string | null
          estado?: string
          fecha_emision?: string | null
          fecha_vigencia_hasta?: string | null
          id?: string
          materia?: string | null
          organismo: string
          referencia: string
          sociedad_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          documento_evidencia_id?: string | null
          estado?: string
          fecha_emision?: string | null
          fecha_vigencia_hasta?: string | null
          id?: string
          materia?: string | null
          organismo?: string
          referencia?: string
          sociedad_id?: string
          tenant_id?: string
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
      bloque_insertions: {
        Row: {
          agreement_id: string
          bloque_clave: string
          bloque_id: string
          bloque_version: string
          id: string
          inserted_at: string | null
          inserted_by: string | null
          tenant_id: string
          texto_insertado: string
        }
        Insert: {
          agreement_id: string
          bloque_clave: string
          bloque_id: string
          bloque_version: string
          id?: string
          inserted_at?: string | null
          inserted_by?: string | null
          tenant_id: string
          texto_insertado: string
        }
        Update: {
          agreement_id?: string
          bloque_clave?: string
          bloque_id?: string
          bloque_version?: string
          id?: string
          inserted_at?: string | null
          inserted_by?: string | null
          tenant_id?: string
          texto_insertado?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloque_insertions_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloque_insertions_bloque_id_fkey"
            columns: ["bloque_id"]
            isOneToOne: false
            referencedRelation: "bloques_sectoriales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloque_insertions_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bloques_sectoriales: {
        Row: {
          aprobada_por: string | null
          clave_bloque: string
          created_at: string | null
          descripcion: string | null
          estado: string
          id: string
          materia_aplicable: string[]
          referencia_legal: string | null
          sector: string
          texto_aprobado: string
          version: string
        }
        Insert: {
          aprobada_por?: string | null
          clave_bloque: string
          created_at?: string | null
          descripcion?: string | null
          estado: string
          id?: string
          materia_aplicable: string[]
          referencia_legal?: string | null
          sector: string
          texto_aprobado: string
          version: string
        }
        Update: {
          aprobada_por?: string | null
          clave_bloque?: string
          created_at?: string | null
          descripcion?: string | null
          estado?: string
          id?: string
          materia_aplicable?: string[]
          referencia_legal?: string | null
          sector?: string
          texto_aprobado?: string
          version?: string
        }
        Relationships: []
      }
      capability_matrix: {
        Row: {
          action: string
          created_at: string | null
          enabled: boolean
          id: string
          reason: string | null
          role: string
        }
        Insert: {
          action: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          reason?: string | null
          role: string
        }
        Update: {
          action?: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          reason?: string | null
          role?: string
        }
        Relationships: []
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
      capital_movements: {
        Row: {
          agreement_id: string | null
          audit_worm_id: string | null
          created_at: string
          delta_denominator_weight: number
          delta_shares: number
          delta_voting_weight: number
          effective_date: string
          entity_id: string
          id: string
          movement_type: string
          notas: string | null
          person_id: string
          share_class_id: string | null
          tenant_id: string
        }
        Insert: {
          agreement_id?: string | null
          audit_worm_id?: string | null
          created_at?: string
          delta_denominator_weight?: number
          delta_shares: number
          delta_voting_weight?: number
          effective_date: string
          entity_id: string
          id?: string
          movement_type: string
          notas?: string | null
          person_id: string
          share_class_id?: string | null
          tenant_id: string
        }
        Update: {
          agreement_id?: string | null
          audit_worm_id?: string | null
          created_at?: string
          delta_denominator_weight?: number
          delta_shares?: number
          delta_voting_weight?: number
          effective_date?: string
          entity_id?: string
          id?: string
          movement_type?: string
          notas?: string | null
          person_id?: string
          share_class_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_movements_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_movements_audit_worm_id_fkey"
            columns: ["audit_worm_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_movements_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_movements_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_movements_share_class_id_fkey"
            columns: ["share_class_id"]
            isOneToOne: false
            referencedRelation: "share_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_rm_registration_events: {
        Row: {
          audit_worm_id: string
          authority_evidence_id: string | null
          condicion_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          inscripcion_rm_fecha: string
          inscripcion_rm_referencia: string
          metadata: Json
          recorded_by: string | null
          tenant_id: string
        }
        Insert: {
          audit_worm_id: string
          authority_evidence_id?: string | null
          condicion_id: string
          created_at?: string
          id: string
          idempotency_key?: string | null
          inscripcion_rm_fecha: string
          inscripcion_rm_referencia: string
          metadata?: Json
          recorded_by?: string | null
          tenant_id: string
        }
        Update: {
          audit_worm_id?: string
          authority_evidence_id?: string | null
          condicion_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          inscripcion_rm_fecha?: string
          inscripcion_rm_referencia?: string
          metadata?: Json
          recorded_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_rm_registration_events_audit_worm_id_fkey"
            columns: ["audit_worm_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_rm_registration_events_authority_evidence_id_fkey"
            columns: ["authority_evidence_id"]
            isOneToOne: false
            referencedRelation: "authority_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_rm_registration_events_condicion_id_fkey"
            columns: ["condicion_id"]
            isOneToOne: false
            referencedRelation: "condiciones_persona"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_rm_registration_events_condicion_id_fkey"
            columns: ["condicion_id"]
            isOneToOne: false
            referencedRelation: "mandates"
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
          agreements_manifest_hash: string | null
          authoritative_manifest: Json | null
          authoritative_manifest_hash: string | null
          authority_evidence_id: string | null
          certificante_role: string | null
          certifier_constancia_evidence_id: string | null
          certifier_id: string | null
          certifier_qtsp_verification_id: string | null
          constancia_evidenced_at: string | null
          content: string | null
          content_hash_sha256: string | null
          created_at: string
          created_by: string | null
          emitted_at: string | null
          evidence_binding_hash_sha256: string | null
          evidence_id: string | null
          final_legal_artifact_id: string | null
          gate_hash: string | null
          hash_certificacion: string | null
          hash_sha512: string | null
          id: string
          interposition_canonical_status: string | null
          interposition_evidence_mode: string | null
          interposition_signature_claim: boolean | null
          jurisdictional_requirements: Json | null
          legal_gate_status: string
          legal_hold: boolean | null
          minute_id: string | null
          required_ead_signature_type: string | null
          requires_qualified_signature: boolean | null
          signature_status: string | null
          tenant_id: string
          tipo_certificacion: string | null
          tsq_token: string | null
          verified_by: string | null
          verified_ead_signature_type: string | null
          visto_bueno_constancia_evidence_id: string | null
          visto_bueno_fecha: string | null
          visto_bueno_persona_id: string | null
          visto_bueno_qtsp_verification_id: string | null
        }
        Insert: {
          agreement_id?: string | null
          agreements_certified?: string[] | null
          agreements_manifest_hash?: string | null
          authoritative_manifest?: Json | null
          authoritative_manifest_hash?: string | null
          authority_evidence_id?: string | null
          certificante_role?: string | null
          certifier_constancia_evidence_id?: string | null
          certifier_id?: string | null
          certifier_qtsp_verification_id?: string | null
          constancia_evidenced_at?: string | null
          content?: string | null
          content_hash_sha256?: string | null
          created_at?: string
          created_by?: string | null
          emitted_at?: string | null
          evidence_binding_hash_sha256?: string | null
          evidence_id?: string | null
          final_legal_artifact_id?: string | null
          gate_hash?: string | null
          hash_certificacion?: string | null
          hash_sha512?: string | null
          id?: string
          interposition_canonical_status?: string | null
          interposition_evidence_mode?: string | null
          interposition_signature_claim?: boolean | null
          jurisdictional_requirements?: Json | null
          legal_gate_status?: string
          legal_hold?: boolean | null
          minute_id?: string | null
          required_ead_signature_type?: string | null
          requires_qualified_signature?: boolean | null
          signature_status?: string | null
          tenant_id: string
          tipo_certificacion?: string | null
          tsq_token?: string | null
          verified_by?: string | null
          verified_ead_signature_type?: string | null
          visto_bueno_constancia_evidence_id?: string | null
          visto_bueno_fecha?: string | null
          visto_bueno_persona_id?: string | null
          visto_bueno_qtsp_verification_id?: string | null
        }
        Update: {
          agreement_id?: string | null
          agreements_certified?: string[] | null
          agreements_manifest_hash?: string | null
          authoritative_manifest?: Json | null
          authoritative_manifest_hash?: string | null
          authority_evidence_id?: string | null
          certificante_role?: string | null
          certifier_constancia_evidence_id?: string | null
          certifier_id?: string | null
          certifier_qtsp_verification_id?: string | null
          constancia_evidenced_at?: string | null
          content?: string | null
          content_hash_sha256?: string | null
          created_at?: string
          created_by?: string | null
          emitted_at?: string | null
          evidence_binding_hash_sha256?: string | null
          evidence_id?: string | null
          final_legal_artifact_id?: string | null
          gate_hash?: string | null
          hash_certificacion?: string | null
          hash_sha512?: string | null
          id?: string
          interposition_canonical_status?: string | null
          interposition_evidence_mode?: string | null
          interposition_signature_claim?: boolean | null
          jurisdictional_requirements?: Json | null
          legal_gate_status?: string
          legal_hold?: boolean | null
          minute_id?: string | null
          required_ead_signature_type?: string | null
          requires_qualified_signature?: boolean | null
          signature_status?: string | null
          tenant_id?: string
          tipo_certificacion?: string | null
          tsq_token?: string | null
          verified_by?: string | null
          verified_ead_signature_type?: string | null
          visto_bueno_constancia_evidence_id?: string | null
          visto_bueno_fecha?: string | null
          visto_bueno_persona_id?: string | null
          visto_bueno_qtsp_verification_id?: string | null
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
            foreignKeyName: "certifications_authority_evidence_id_fkey"
            columns: ["authority_evidence_id"]
            isOneToOne: false
            referencedRelation: "authority_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_certifier_constancia_evidence_id_fkey"
            columns: ["certifier_constancia_evidence_id"]
            isOneToOne: false
            referencedRelation: "secretaria_ead_interposition_evidence"
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
            foreignKeyName: "certifications_certifier_qtsp_verification_id_fkey"
            columns: ["certifier_qtsp_verification_id"]
            isOneToOne: false
            referencedRelation: "secretaria_qtsp_verifications"
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
            foreignKeyName: "certifications_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_final_legal_artifact_id_fkey"
            columns: ["final_legal_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_legal_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "minutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_visto_bueno_constancia_evidence_id_fkey"
            columns: ["visto_bueno_constancia_evidence_id"]
            isOneToOne: false
            referencedRelation: "secretaria_ead_interposition_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_visto_bueno_persona_id_fkey"
            columns: ["visto_bueno_persona_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_visto_bueno_qtsp_verification_id_fkey"
            columns: ["visto_bueno_qtsp_verification_id"]
            isOneToOne: false
            referencedRelation: "secretaria_qtsp_verifications"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_attachments: {
        Row: {
          communication_id: string
          created_at: string
          evidence_bundle_id: string | null
          hash_sha256: string | null
          hash_sha512: string
          id: string
          label: string
          mime_type: string | null
          modo_entrega: string
          orden: number
          signed_url_expiry_hours: number | null
          size_bytes: number | null
          source_attachment_id: string | null
          storage_uri: string
          tipo: string
        }
        Insert: {
          communication_id: string
          created_at?: string
          evidence_bundle_id?: string | null
          hash_sha256?: string | null
          hash_sha512: string
          id?: string
          label: string
          mime_type?: string | null
          modo_entrega?: string
          orden?: number
          signed_url_expiry_hours?: number | null
          size_bytes?: number | null
          source_attachment_id?: string | null
          storage_uri: string
          tipo: string
        }
        Update: {
          communication_id?: string
          created_at?: string
          evidence_bundle_id?: string | null
          hash_sha256?: string | null
          hash_sha512?: string
          id?: string
          label?: string
          mime_type?: string | null
          modo_entrega?: string
          orden?: number
          signed_url_expiry_hours?: number | null
          size_bytes?: number | null
          source_attachment_id?: string | null
          storage_uri?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_attachments_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_attachments_source_attachment_id_fkey"
            columns: ["source_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_delivery_events: {
        Row: {
          created_at: string
          evento: string
          hash_prev: string | null
          hash_self: string
          id: string
          ocurrido_en: string
          payload: Json | null
          proveedor: string
          proveedor_evento_id: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string
          evento: string
          hash_prev?: string | null
          hash_self: string
          id?: string
          ocurrido_en?: string
          payload?: Json | null
          proveedor: string
          proveedor_evento_id?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string
          evento?: string
          hash_prev?: string | null
          hash_self?: string
          id?: string
          ocurrido_en?: string
          payload?: Json | null
          proveedor?: string
          proveedor_evento_id?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_delivery_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "communication_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_recipients: {
        Row: {
          acuse_evidence_hash: string | null
          acuse_evidence_id: string | null
          canal_fallback: string | null
          canal_original: string
          canal_primario: string
          canal_usado: string | null
          cargo_en_organo: string | null
          communication_id: string
          created_at: string
          delegacion_a_person_id: string | null
          delivery_alternative: Json | null
          destino_fallback: string | null
          destino_primario: string
          dispatch_attempt_id: string | null
          dispatch_lease_expires_at: string | null
          estado_entrega: string
          fecha_entrega: string | null
          fecha_envio: string | null
          fecha_lectura: string | null
          fecha_respuesta: string | null
          id: string
          intento_reenvio_n: number
          person_id: string
          provider_idempotency_key: string | null
          respuesta_firma_qes_id: string | null
          respuesta_payload: Json | null
          respuesta_tipo: string | null
          ultimo_error: string | null
          updated_at: string
        }
        Insert: {
          acuse_evidence_hash?: string | null
          acuse_evidence_id?: string | null
          canal_fallback?: string | null
          canal_original: string
          canal_primario: string
          canal_usado?: string | null
          cargo_en_organo?: string | null
          communication_id: string
          created_at?: string
          delegacion_a_person_id?: string | null
          delivery_alternative?: Json | null
          destino_fallback?: string | null
          destino_primario: string
          dispatch_attempt_id?: string | null
          dispatch_lease_expires_at?: string | null
          estado_entrega?: string
          fecha_entrega?: string | null
          fecha_envio?: string | null
          fecha_lectura?: string | null
          fecha_respuesta?: string | null
          id?: string
          intento_reenvio_n?: number
          person_id: string
          provider_idempotency_key?: string | null
          respuesta_firma_qes_id?: string | null
          respuesta_payload?: Json | null
          respuesta_tipo?: string | null
          ultimo_error?: string | null
          updated_at?: string
        }
        Update: {
          acuse_evidence_hash?: string | null
          acuse_evidence_id?: string | null
          canal_fallback?: string | null
          canal_original?: string
          canal_primario?: string
          canal_usado?: string | null
          cargo_en_organo?: string | null
          communication_id?: string
          created_at?: string
          delegacion_a_person_id?: string | null
          delivery_alternative?: Json | null
          destino_fallback?: string | null
          destino_primario?: string
          dispatch_attempt_id?: string | null
          dispatch_lease_expires_at?: string | null
          estado_entrega?: string
          fecha_entrega?: string | null
          fecha_envio?: string | null
          fecha_lectura?: string | null
          fecha_respuesta?: string | null
          id?: string
          intento_reenvio_n?: number
          person_id?: string
          provider_idempotency_key?: string | null
          respuesta_firma_qes_id?: string | null
          respuesta_payload?: Json | null
          respuesta_tipo?: string | null
          ultimo_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_recipients_acuse_evidence_id_fkey"
            columns: ["acuse_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_acuse_evidence_id_fkey"
            columns: ["acuse_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_delegacion_a_person_id_fkey"
            columns: ["delegacion_a_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_recipients_respuesta_firma_qes_id_fkey"
            columns: ["respuesta_firma_qes_id"]
            isOneToOne: false
            referencedRelation: "qtsp_signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          agreement_id: string | null
          asunto: string
          body_id: string | null
          censo_snapshot_hash_sha512: string | null
          censo_snapshot_id: string | null
          comunicacion_libre: boolean
          convocatoria_id: string | null
          created_at: string
          created_by: string | null
          cuerpo_hash_sha512: string
          cuerpo_render: string
          entity_id: string
          estado: string
          fecha_envio_efectiva: string | null
          fecha_limite_respuesta: string | null
          fecha_programada: string | null
          id: string
          meeting_id: string | null
          metadata: Json
          nivel_certificacion_minimo: string
          normative_snapshot_id: string | null
          organo_tipo: string
          package_hash_sha512: string | null
          package_revision: number
          plazo_legal_dias: number | null
          template_id: string | null
          tenant_id: string
          tiene_rebotes: boolean
          tipo_comunicacion: string
          tipo_respuesta_esperada: string
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          asunto: string
          body_id?: string | null
          censo_snapshot_hash_sha512?: string | null
          censo_snapshot_id?: string | null
          comunicacion_libre?: boolean
          convocatoria_id?: string | null
          created_at?: string
          created_by?: string | null
          cuerpo_hash_sha512: string
          cuerpo_render: string
          entity_id: string
          estado?: string
          fecha_envio_efectiva?: string | null
          fecha_limite_respuesta?: string | null
          fecha_programada?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json
          nivel_certificacion_minimo: string
          normative_snapshot_id?: string | null
          organo_tipo: string
          package_hash_sha512?: string | null
          package_revision?: number
          plazo_legal_dias?: number | null
          template_id?: string | null
          tenant_id: string
          tiene_rebotes?: boolean
          tipo_comunicacion: string
          tipo_respuesta_esperada: string
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          asunto?: string
          body_id?: string | null
          censo_snapshot_hash_sha512?: string | null
          censo_snapshot_id?: string | null
          comunicacion_libre?: boolean
          convocatoria_id?: string | null
          created_at?: string
          created_by?: string | null
          cuerpo_hash_sha512?: string
          cuerpo_render?: string
          entity_id?: string
          estado?: string
          fecha_envio_efectiva?: string | null
          fecha_limite_respuesta?: string | null
          fecha_programada?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json
          nivel_certificacion_minimo?: string
          normative_snapshot_id?: string | null
          organo_tipo?: string
          package_hash_sha512?: string | null
          package_revision?: number
          plazo_legal_dias?: number | null
          template_id?: string | null
          tenant_id?: string
          tiene_rebotes?: boolean
          tipo_comunicacion?: string
          tipo_respuesta_esperada?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_censo_snapshot_id_fkey"
            columns: ["censo_snapshot_id"]
            isOneToOne: false
            referencedRelation: "censo_snapshot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          fuente_designacion: string | null
          id: string
          inscripcion_rm_fecha: string | null
          inscripcion_rm_referencia: string | null
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
          fuente_designacion?: string | null
          id?: string
          inscripcion_rm_fecha?: string | null
          inscripcion_rm_referencia?: string | null
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
          fuente_designacion?: string | null
          id?: string
          inscripcion_rm_fecha?: string | null
          inscripcion_rm_referencia?: string | null
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
          owner_body_id: string | null
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
          owner_body_id?: string | null
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
          owner_body_id?: string | null
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
            foreignKeyName: "controls_owner_body_id_fkey"
            columns: ["owner_body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
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
      convocation_acts: {
        Row: {
          act_hash_sha512: string
          act_payload: Json
          act_type: string
          actor_authority_evidence_id: string
          actor_person_id: string
          agenda_hash_sha256: string
          approved_text_hash_sha256: string
          authority_route: string
          convocatoria_id: string
          data_class: string
          id: string
          immutable_at: string
          legal_effect: string
          recorded_at: string
          recorded_by: string
          tenant_id: string
        }
        Insert: {
          act_hash_sha512: string
          act_payload: Json
          act_type: string
          actor_authority_evidence_id: string
          actor_person_id: string
          agenda_hash_sha256: string
          approved_text_hash_sha256: string
          authority_route: string
          convocatoria_id: string
          data_class: string
          id?: string
          immutable_at: string
          legal_effect: string
          recorded_at: string
          recorded_by: string
          tenant_id: string
        }
        Update: {
          act_hash_sha512?: string
          act_payload?: Json
          act_type?: string
          actor_authority_evidence_id?: string
          actor_person_id?: string
          agenda_hash_sha256?: string
          approved_text_hash_sha256?: string
          authority_route?: string
          convocatoria_id?: string
          data_class?: string
          id?: string
          immutable_at?: string
          legal_effect?: string
          recorded_at?: string
          recorded_by?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convocation_acts_actor_authority_evidence_id_fkey"
            columns: ["actor_authority_evidence_id"]
            isOneToOne: false
            referencedRelation: "authority_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_acts_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_acts_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: true
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_acts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convocation_artifact_candidates: {
        Row: {
          artifact_kind: string
          binary_hash_sha256: string
          binary_hash_sha512: string
          consumed_at: string | null
          consumed_attachment_id: string | null
          convocatoria_id: string
          file_name: string
          id: string
          mime_type: string
          review_context: Json
          review_status: string
          reviewed_at: string
          reviewed_by: string
          source_hash_sha256: string
          tenant_id: string
        }
        Insert: {
          artifact_kind: string
          binary_hash_sha256: string
          binary_hash_sha512: string
          consumed_at?: string | null
          consumed_attachment_id?: string | null
          convocatoria_id: string
          file_name: string
          id?: string
          mime_type: string
          review_context: Json
          review_status?: string
          reviewed_at?: string
          reviewed_by: string
          source_hash_sha256: string
          tenant_id: string
        }
        Update: {
          artifact_kind?: string
          binary_hash_sha256?: string
          binary_hash_sha512?: string
          consumed_at?: string | null
          consumed_attachment_id?: string | null
          convocatoria_id?: string
          file_name?: string
          id?: string
          mime_type?: string
          review_context?: Json
          review_status?: string
          reviewed_at?: string
          reviewed_by?: string
          source_hash_sha256?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convocation_artifact_candidates_consumed_attachment_id_fkey"
            columns: ["consumed_attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_artifact_candidates_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_artifact_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convocation_lifecycle_events: {
        Row: {
          act_id: string
          convocatoria_id: string
          data_class: string
          event_hash_sha512: string
          event_payload: Json
          from_state: string
          id: string
          immutable_at: string
          legal_effect: string
          manifest_id: string
          reason: string
          recorded_at: string
          recorded_by: string
          tenant_id: string
          to_state: string
        }
        Insert: {
          act_id: string
          convocatoria_id: string
          data_class: string
          event_hash_sha512: string
          event_payload: Json
          from_state: string
          id?: string
          immutable_at: string
          legal_effect: string
          manifest_id: string
          reason: string
          recorded_at: string
          recorded_by: string
          tenant_id: string
          to_state: string
        }
        Update: {
          act_id?: string
          convocatoria_id?: string
          data_class?: string
          event_hash_sha512?: string
          event_payload?: Json
          from_state?: string
          id?: string
          immutable_at?: string
          legal_effect?: string
          manifest_id?: string
          reason?: string
          recorded_at?: string
          recorded_by?: string
          tenant_id?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "convocation_lifecycle_events_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: false
            referencedRelation: "convocation_acts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_lifecycle_events_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: false
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_lifecycle_events_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "convocation_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_lifecycle_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convocation_manifests: {
        Row: {
          act_hash_sha512: string
          act_id: string
          convocatoria_id: string
          created_at: string
          created_by: string | null
          data_class: string
          id: string
          immutable_at: string
          legal_effect: string
          manifest_hash_sha512: string
          manifest_json: Json
          tenant_id: string
        }
        Insert: {
          act_hash_sha512: string
          act_id: string
          convocatoria_id: string
          created_at?: string
          created_by?: string | null
          data_class: string
          id?: string
          immutable_at?: string
          legal_effect: string
          manifest_hash_sha512: string
          manifest_json: Json
          tenant_id: string
        }
        Update: {
          act_hash_sha512?: string
          act_id?: string
          convocatoria_id?: string
          created_at?: string
          created_by?: string | null
          data_class?: string
          id?: string
          immutable_at?: string
          legal_effect?: string
          manifest_hash_sha512?: string
          manifest_json?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convocation_manifests_act_id_fkey"
            columns: ["act_id"]
            isOneToOne: true
            referencedRelation: "convocation_acts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_manifests_convocatoria_id_fkey"
            columns: ["convocatoria_id"]
            isOneToOne: true
            referencedRelation: "convocatorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocation_manifests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convocatorias: {
        Row: {
          accepted_warnings: Json | null
          agenda_items: Json | null
          body_id: string | null
          convocante_authority_evidence_id: string | null
          convocante_person_id: string | null
          convocation_authority_route: string | null
          convocatoria_text: string | null
          created_at: string
          estado: string
          fecha_1: string | null
          fecha_2: string | null
          fecha_emision: string | null
          id: string
          immutable_at: string | null
          is_second_call: boolean
          junta_universal: boolean
          lugar: string | null
          modalidad: string
          publication_channels: string[] | null
          publication_evidence_url: string | null
          reminders_trace: Json | null
          rule_trace: Json | null
          statutory_basis: string | null
          tenant_id: string
          tipo_convocatoria: string | null
          updated_at: string
          urgente: boolean
        }
        Insert: {
          accepted_warnings?: Json | null
          agenda_items?: Json | null
          body_id?: string | null
          convocante_authority_evidence_id?: string | null
          convocante_person_id?: string | null
          convocation_authority_route?: string | null
          convocatoria_text?: string | null
          created_at?: string
          estado?: string
          fecha_1?: string | null
          fecha_2?: string | null
          fecha_emision?: string | null
          id?: string
          immutable_at?: string | null
          is_second_call?: boolean
          junta_universal?: boolean
          lugar?: string | null
          modalidad?: string
          publication_channels?: string[] | null
          publication_evidence_url?: string | null
          reminders_trace?: Json | null
          rule_trace?: Json | null
          statutory_basis?: string | null
          tenant_id: string
          tipo_convocatoria?: string | null
          updated_at?: string
          urgente?: boolean
        }
        Update: {
          accepted_warnings?: Json | null
          agenda_items?: Json | null
          body_id?: string | null
          convocante_authority_evidence_id?: string | null
          convocante_person_id?: string | null
          convocation_authority_route?: string | null
          convocatoria_text?: string | null
          created_at?: string
          estado?: string
          fecha_1?: string | null
          fecha_2?: string | null
          fecha_emision?: string | null
          id?: string
          immutable_at?: string | null
          is_second_call?: boolean
          junta_universal?: boolean
          lugar?: string | null
          modalidad?: string
          publication_channels?: string[] | null
          publication_evidence_url?: string | null
          reminders_trace?: Json | null
          rule_trace?: Json | null
          statutory_basis?: string | null
          tenant_id?: string
          tipo_convocatoria?: string | null
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
          {
            foreignKeyName: "convocatorias_convocante_authority_evidence_fk"
            columns: ["convocante_authority_evidence_id"]
            isOneToOne: false
            referencedRelation: "authority_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convocatorias_convocante_person_fk"
            columns: ["convocante_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
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
          representation_authority_route: string | null
          representation_evidence_status: string | null
          representation_legal_effect: string | null
          representation_source_hash_sha512: string | null
          representation_source_reference: string | null
          representation_source_uri: string | null
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
          representation_authority_route?: string | null
          representation_evidence_status?: string | null
          representation_legal_effect?: string | null
          representation_source_hash_sha512?: string | null
          representation_source_reference?: string | null
          representation_source_uri?: string | null
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
          representation_authority_route?: string | null
          representation_evidence_status?: string | null
          representation_legal_effect?: string | null
          representation_source_hash_sha512?: string | null
          representation_source_reference?: string | null
          representation_source_uri?: string | null
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
      document_annex_links: {
        Row: {
          annex_order: number
          annex_role: string
          artifact_id: string
          created_at: string
          frozen_at: string | null
          id: string
          included_in_certification_bundle: boolean
          included_in_export: boolean
          is_mandatory_annex: boolean
          linked_domain: string
          linked_id: string
          tenant_id: string
        }
        Insert: {
          annex_order?: number
          annex_role?: string
          artifact_id: string
          created_at?: string
          frozen_at?: string | null
          id?: string
          included_in_certification_bundle?: boolean
          included_in_export?: boolean
          is_mandatory_annex?: boolean
          linked_domain: string
          linked_id: string
          tenant_id: string
        }
        Update: {
          annex_order?: number
          annex_role?: string
          artifact_id?: string
          created_at?: string
          frozen_at?: string | null
          id?: string
          included_in_certification_bundle?: boolean
          included_in_export?: boolean
          is_mandatory_annex?: boolean
          linked_domain?: string
          linked_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_annex_links_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_document_artifacts"
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
          address: string | null
          address_floor: string | null
          address_number: string | null
          address_street: string | null
          admin_solidario_restricciones: Json | null
          city: string | null
          cnae_primary: string | null
          cnae_secondary: string[] | null
          common_name: string | null
          constitution_date: string | null
          corporate_email: string | null
          corporate_purpose: string | null
          country: string | null
          created_at: string | null
          data_class: string
          data_provenance: Json | null
          duration: string | null
          entity_status: string | null
          es_cotizada: boolean | null
          es_unipersonal: boolean | null
          fiscal_year_close: string | null
          forma_administracion: string | null
          group_role: string | null
          id: string
          jurisdiction: string | null
          legal_form: string | null
          legal_hold: boolean | null
          legal_name: string
          lei_code: string | null
          materiality: string | null
          onboarding_status: string
          ownership_percentage: number | null
          parent_entity_id: string | null
          person_id: string
          postal_code: string | null
          province: string | null
          registration_date: string | null
          registration_number: string | null
          registry_folio: string | null
          registry_inscription: string | null
          registry_location: string | null
          registry_sheet: string | null
          registry_volume: string | null
          regulated_sector: string | null
          retention_policy_id: string | null
          secretary_owner_id: string | null
          slug: string
          solvency_ii_ratio: number | null
          support_docs_metadata: Json
          tenant_id: string
          tipo_organo_admin: string | null
          tipo_social: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          address_floor?: string | null
          address_number?: string | null
          address_street?: string | null
          admin_solidario_restricciones?: Json | null
          city?: string | null
          cnae_primary?: string | null
          cnae_secondary?: string[] | null
          common_name?: string | null
          constitution_date?: string | null
          corporate_email?: string | null
          corporate_purpose?: string | null
          country?: string | null
          created_at?: string | null
          data_class?: string
          data_provenance?: Json | null
          duration?: string | null
          entity_status?: string | null
          es_cotizada?: boolean | null
          es_unipersonal?: boolean | null
          fiscal_year_close?: string | null
          forma_administracion?: string | null
          group_role?: string | null
          id?: string
          jurisdiction?: string | null
          legal_form?: string | null
          legal_hold?: boolean | null
          legal_name: string
          lei_code?: string | null
          materiality?: string | null
          onboarding_status?: string
          ownership_percentage?: number | null
          parent_entity_id?: string | null
          person_id: string
          postal_code?: string | null
          province?: string | null
          registration_date?: string | null
          registration_number?: string | null
          registry_folio?: string | null
          registry_inscription?: string | null
          registry_location?: string | null
          registry_sheet?: string | null
          registry_volume?: string | null
          regulated_sector?: string | null
          retention_policy_id?: string | null
          secretary_owner_id?: string | null
          slug: string
          solvency_ii_ratio?: number | null
          support_docs_metadata?: Json
          tenant_id: string
          tipo_organo_admin?: string | null
          tipo_social?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          address_floor?: string | null
          address_number?: string | null
          address_street?: string | null
          admin_solidario_restricciones?: Json | null
          city?: string | null
          cnae_primary?: string | null
          cnae_secondary?: string[] | null
          common_name?: string | null
          constitution_date?: string | null
          corporate_email?: string | null
          corporate_purpose?: string | null
          country?: string | null
          created_at?: string | null
          data_class?: string
          data_provenance?: Json | null
          duration?: string | null
          entity_status?: string | null
          es_cotizada?: boolean | null
          es_unipersonal?: boolean | null
          fiscal_year_close?: string | null
          forma_administracion?: string | null
          group_role?: string | null
          id?: string
          jurisdiction?: string | null
          legal_form?: string | null
          legal_hold?: boolean | null
          legal_name?: string
          lei_code?: string | null
          materiality?: string | null
          onboarding_status?: string
          ownership_percentage?: number | null
          parent_entity_id?: string | null
          person_id?: string
          postal_code?: string | null
          province?: string | null
          registration_date?: string | null
          registration_number?: string | null
          registry_folio?: string | null
          registry_inscription?: string | null
          registry_location?: string | null
          registry_sheet?: string | null
          registry_volume?: string | null
          regulated_sector?: string | null
          retention_policy_id?: string | null
          secretary_owner_id?: string | null
          slug?: string
          solvency_ii_ratio?: number | null
          support_docs_metadata?: Json
          tenant_id?: string
          tipo_organo_admin?: string | null
          tipo_social?: string | null
          website?: string | null
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
      entity_settings: {
        Row: {
          created_at: string | null
          entity_id: string
          id: string
          key: string
          tenant_id: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          id?: string
          key: string
          tenant_id: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entity_settings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_settings_key_fkey"
            columns: ["key"]
            isOneToOne: false
            referencedRelation: "entity_settings_catalog"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "entity_settings_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_settings_catalog: {
        Row: {
          allowed_values: Json | null
          categoria: string
          created_at: string | null
          default_value: Json | null
          descripcion: string
          estado_catalog: string
          key: string
          usado_por_plantillas: string[] | null
          value_type: string
        }
        Insert: {
          allowed_values?: Json | null
          categoria: string
          created_at?: string | null
          default_value?: Json | null
          descripcion: string
          estado_catalog?: string
          key: string
          usado_por_plantillas?: string[] | null
          value_type: string
        }
        Update: {
          allowed_values?: Json | null
          categoria?: string
          created_at?: string | null
          default_value?: Json | null
          descripcion?: string
          estado_catalog?: string
          key?: string
          usado_por_plantillas?: string[] | null
          value_type?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "evidence_bundle_artifacts_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_bundle_review_events: {
        Row: {
          actor_id: string | null
          agreement_id: string | null
          assignee_id: string | null
          content_hash_sha256: string | null
          created_at: string
          document_url: string | null
          event_type: string
          evidence_bundle_id: string
          id: string
          metadata: Json
          notes: string | null
          reason: string | null
          request_hash_sha256: string | null
          request_id: string | null
          review_state: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          agreement_id?: string | null
          assignee_id?: string | null
          content_hash_sha256?: string | null
          created_at?: string
          document_url?: string | null
          event_type: string
          evidence_bundle_id: string
          id?: string
          metadata?: Json
          notes?: string | null
          reason?: string | null
          request_hash_sha256?: string | null
          request_id?: string | null
          review_state: string
          tenant_id?: string
        }
        Update: {
          actor_id?: string | null
          agreement_id?: string | null
          assignee_id?: string | null
          content_hash_sha256?: string | null
          created_at?: string
          document_url?: string | null
          event_type?: string
          evidence_bundle_id?: string
          id?: string
          metadata?: Json
          notes?: string | null
          reason?: string | null
          request_hash_sha256?: string | null
          request_id?: string | null
          review_state?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_bundle_review_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundle_review_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundle_review_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_bundles: {
        Row: {
          agreement_id: string | null
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
          source_module: string | null
          source_object_id: string | null
          source_object_type: string | null
          status: string
          storage_path: string | null
          supersedes_id: string | null
          tenant_id: string
          tsq_token: string | null
        }
        Insert: {
          agreement_id?: string | null
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
          source_module?: string | null
          source_object_id?: string | null
          source_object_type?: string | null
          status?: string
          storage_path?: string | null
          supersedes_id?: string | null
          tenant_id: string
          tsq_token?: string | null
        }
        Update: {
          agreement_id?: string | null
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
          source_module?: string | null
          source_object_id?: string | null
          source_object_type?: string | null
          status?: string
          storage_path?: string | null
          supersedes_id?: string | null
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
          {
            foreignKeyName: "evidence_bundles_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundles_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
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
      governance_module_events: {
        Row: {
          created_at: string
          event_status: string
          event_type: string
          evidence_bundle_id: string | null
          id: string
          payload: Json
          source_module: string
          source_object_id: string | null
          source_object_type: string | null
          target_module: string | null
          target_object_id: string | null
          target_object_type: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_status?: string
          event_type: string
          evidence_bundle_id?: string | null
          id?: string
          payload?: Json
          source_module: string
          source_object_id?: string | null
          source_object_type?: string | null
          target_module?: string | null
          target_object_id?: string | null
          target_object_type?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_status?: string
          event_type?: string
          evidence_bundle_id?: string | null
          id?: string
          payload?: Json
          source_module?: string
          source_object_id?: string | null
          source_object_type?: string | null
          target_module?: string | null
          target_object_id?: string | null
          target_object_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_module_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_module_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_module_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_module_links: {
        Row: {
          created_at: string
          evidence_bundle_id: string | null
          id: string
          payload: Json
          relation_type: string
          source_module: string
          source_object_id: string
          source_object_type: string
          status: string
          target_module: string
          target_object_id: string | null
          target_object_type: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_bundle_id?: string | null
          id?: string
          payload?: Json
          relation_type: string
          source_module: string
          source_object_id: string
          source_object_type: string
          status?: string
          target_module: string
          target_object_id?: string | null
          target_object_type?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_bundle_id?: string | null
          id?: string
          payload?: Json
          relation_type?: string
          source_module?: string
          source_object_id?: string
          source_object_type?: string
          status?: string
          target_module?: string
          target_object_id?: string | null
          target_object_type?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_module_links_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_module_links_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "governance_module_links_tenant_id_fkey"
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
          updated_at: string | null
          updated_by: string | null
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
          updated_at?: string | null
          updated_by?: string | null
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
          updated_at?: string | null
          updated_by?: string | null
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
      grc_access_controls: {
        Row: {
          created_at: string
          evidence: string
          id: string
          incompatible_with: string
          payload: Json
          permissions: string
          role: string
          scope: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence: string
          id: string
          incompatible_with: string
          payload?: Json
          permissions: string
          role: string
          scope: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence?: string
          id?: string
          incompatible_with?: string
          payload?: Json
          permissions?: string
          role?: string
          scope?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_access_controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_alerts: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          module_id: string
          payload: Json
          severity: string
          status: string
          tenant_id: string
          title: string
          trigger: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id: string
          module_id: string
          payload?: Json
          severity?: string
          status?: string
          tenant_id: string
          title: string
          trigger: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          module_id?: string
          payload?: Json
          severity?: string
          status?: string
          tenant_id?: string
          title?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_alerts_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_audit_standards: {
        Row: {
          created_at: string
          domain: string
          evidence: string
          id: string
          mapping_2017: string
          owner: string
          payload: Json
          principle: string
          standard_ref: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          evidence: string
          id: string
          mapping_2017: string
          owner: string
          payload?: Json
          principle: string
          standard_ref: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          evidence?: string
          id?: string
          mapping_2017?: string
          owner?: string
          payload?: Json
          principle?: string
          standard_ref?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_audit_standards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_control_tests: {
        Row: {
          control_id: string
          created_at: string
          evidence_refs: Json
          executed_at: string | null
          executed_by: string | null
          id: string
          legal_hold: boolean
          module_id: string
          next_test_at: string | null
          payload: Json
          result: string | null
          retention_until: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          control_id: string
          created_at?: string
          evidence_refs?: Json
          executed_at?: string | null
          executed_by?: string | null
          id: string
          legal_hold?: boolean
          module_id: string
          next_test_at?: string | null
          payload?: Json
          result?: string | null
          retention_until?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          control_id?: string
          created_at?: string
          evidence_refs?: Json
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          legal_hold?: boolean
          module_id?: string
          next_test_at?: string | null
          payload?: Json
          result?: string | null
          retention_until?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_control_tests_tenant_id_control_id_fkey"
            columns: ["tenant_id", "control_id"]
            isOneToOne: false
            referencedRelation: "grc_controls"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "grc_control_tests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_control_tests_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_controls: {
        Row: {
          created_at: string
          description: string | null
          evidence_required: Json
          frequency: string | null
          id: string
          module_id: string
          name: string
          obligation_id: string | null
          owner: string
          payload: Json
          risk_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          evidence_required?: Json
          frequency?: string | null
          id: string
          module_id: string
          name: string
          obligation_id?: string | null
          owner: string
          payload?: Json
          risk_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          evidence_required?: Json
          frequency?: string | null
          id?: string
          module_id?: string
          name?: string
          obligation_id?: string | null
          owner?: string
          payload?: Json
          risk_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_controls_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "grc_controls_tenant_id_obligation_id_fkey"
            columns: ["tenant_id", "obligation_id"]
            isOneToOne: false
            referencedRelation: "grc_obligations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "grc_controls_tenant_id_risk_id_fkey"
            columns: ["tenant_id", "risk_id"]
            isOneToOne: false
            referencedRelation: "grc_risks"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_evidence_links: {
        Row: {
          created_at: string
          evidence_bundle_id: string | null
          hash_sha512: string | null
          id: string
          legal_hold: boolean
          linked_object: string
          module_id: string
          object_type: string
          owner: string
          retention: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_bundle_id?: string | null
          hash_sha512?: string | null
          id: string
          legal_hold?: boolean
          linked_object: string
          module_id: string
          object_type: string
          owner: string
          retention: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_bundle_id?: string | null
          hash_sha512?: string | null
          id?: string
          legal_hold?: boolean
          linked_object?: string
          module_id?: string
          object_type?: string
          owner?: string
          retention?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_evidence_links_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_evidence_links_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_evidence_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_evidence_links_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
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
      grc_modules: {
        Row: {
          control_coverage: number
          created_at: string
          critical_risks: number
          description: string
          evidence_count: number
          id: string
          name: string
          next_milestone: string | null
          open_issues: number
          owner: string
          payload: Json
          regulations: Json
          route: string | null
          state: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          control_coverage?: number
          created_at?: string
          critical_risks?: number
          description: string
          evidence_count?: number
          id: string
          name: string
          next_milestone?: string | null
          open_issues?: number
          owner: string
          payload?: Json
          regulations?: Json
          route?: string | null
          state?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          control_coverage?: number
          created_at?: string
          critical_risks?: number
          description?: string
          evidence_count?: number
          id?: string
          name?: string
          next_milestone?: string | null
          open_issues?: number
          owner?: string
          payload?: Json
          regulations?: Json
          route?: string | null
          state?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_obligations: {
        Row: {
          authority: string | null
          created_at: string
          framework: string
          id: string
          legal_basis: Json
          module_id: string
          obligation: string
          owner: string
          payload: Json
          reference: string
          retention_policy_id: string | null
          severity: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          authority?: string | null
          created_at?: string
          framework: string
          id: string
          legal_basis?: Json
          module_id: string
          obligation: string
          owner: string
          payload?: Json
          reference: string
          retention_policy_id?: string | null
          severity?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          authority?: string | null
          created_at?: string
          framework?: string
          id?: string
          legal_basis?: Json
          module_id?: string
          obligation?: string
          owner?: string
          payload?: Json
          reference?: string
          retention_policy_id?: string | null
          severity?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_obligations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_obligations_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_retention_policies: {
        Row: {
          created_at: string
          id: string
          legal_hold_rule: string
          next_run: string | null
          object_type: string
          payload: Json
          purge_mode: string
          regulatory_basis: string
          retention: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          legal_hold_rule: string
          next_run?: string | null
          object_type: string
          payload?: Json
          purge_mode?: string
          regulatory_basis: string
          retention: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          legal_hold_rule?: string
          next_run?: string | null
          object_type?: string
          payload?: Json
          purge_mode?: string
          regulatory_basis?: string
          retention?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_retention_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_risk_appetite: {
        Row: {
          appetite: string
          approval: string
          created_at: string
          id: string
          linked_committee: string
          metric: string
          payload: Json
          risk_category: string
          status: string
          tenant_id: string
          threshold: string
          updated_at: string
        }
        Insert: {
          appetite: string
          approval: string
          created_at?: string
          id: string
          linked_committee: string
          metric: string
          payload?: Json
          risk_category: string
          status?: string
          tenant_id: string
          threshold: string
          updated_at?: string
        }
        Update: {
          appetite?: string
          approval?: string
          created_at?: string
          id?: string
          linked_committee?: string
          metric?: string
          payload?: Json
          risk_category?: string
          status?: string
          tenant_id?: string
          threshold?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_risk_appetite_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_risks: {
        Row: {
          appetite_ref: string | null
          created_at: string
          description: string | null
          id: string
          inherent_severity: string
          module_id: string
          obligation_id: string | null
          owner: string
          payload: Json
          residual_severity: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          appetite_ref?: string | null
          created_at?: string
          description?: string | null
          id: string
          inherent_severity?: string
          module_id: string
          obligation_id?: string | null
          owner: string
          payload?: Json
          residual_severity?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          appetite_ref?: string | null
          created_at?: string
          description?: string | null
          id?: string
          inherent_severity?: string
          module_id?: string
          obligation_id?: string | null
          owner?: string
          payload?: Json
          residual_severity?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_risks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_risks_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "grc_risks_tenant_id_obligation_id_fkey"
            columns: ["tenant_id", "obligation_id"]
            isOneToOne: false
            referencedRelation: "grc_obligations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_third_parties: {
        Row: {
          cloud_exposure: string
          contract_clauses: string
          created_at: string
          criticality: string
          due_diligence: string
          exit_plan: string
          id: string
          legal_hold: boolean
          next_review: string | null
          owner: string
          payload: Json
          provider: string
          regulatory_basis: string
          service: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cloud_exposure: string
          contract_clauses?: string
          created_at?: string
          criticality: string
          due_diligence?: string
          exit_plan?: string
          id: string
          legal_hold?: boolean
          next_review?: string | null
          owner: string
          payload?: Json
          provider: string
          regulatory_basis: string
          service: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cloud_exposure?: string
          contract_clauses?: string
          created_at?: string
          criticality?: string
          due_diligence?: string
          exit_plan?: string
          id?: string
          legal_hold?: boolean
          next_review?: string | null
          owner?: string
          payload?: Json
          provider?: string
          regulatory_basis?: string
          service?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_third_parties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grc_work_items: {
        Row: {
          assignee: string
          created_at: string
          due_at: string | null
          id: string
          module_id: string
          payload: Json
          severity: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee: string
          created_at?: string
          due_at?: string | null
          id: string
          module_id: string
          payload?: Json
          severity?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee?: string
          created_at?: string
          due_at?: string | null
          id?: string
          module_id?: string
          payload?: Json
          severity?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_work_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_work_items_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_workflow_events: {
        Row: {
          actor: string | null
          created_at: string
          due_at: string | null
          event_status: string
          event_type: string
          evidence_bundle_id: string | null
          id: string
          module_id: string
          payload: Json
          tenant_id: string
          workflow_id: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          due_at?: string | null
          event_status?: string
          event_type: string
          evidence_bundle_id?: string | null
          id?: string
          module_id: string
          payload?: Json
          tenant_id: string
          workflow_id: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          due_at?: string | null
          event_status?: string
          event_type?: string
          evidence_bundle_id?: string | null
          id?: string
          module_id?: string
          payload?: Json
          tenant_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_workflow_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_workflow_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_workflow_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_workflow_events_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "grc_workflow_events_tenant_id_workflow_id_fkey"
            columns: ["tenant_id", "workflow_id"]
            isOneToOne: false
            referencedRelation: "grc_workflows"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      grc_workflows: {
        Row: {
          clock: string
          created_at: string
          decision_gate: string
          due_at: string | null
          evidence_required: Json
          id: string
          legal_basis: string
          legal_hold_trigger: string
          module_id: string
          owner: string
          payload: Json
          progress: number
          secretary_output: string | null
          severity: string
          stages: Json
          status: string
          tenant_id: string
          title: string
          trigger: string
          updated_at: string
        }
        Insert: {
          clock: string
          created_at?: string
          decision_gate: string
          due_at?: string | null
          evidence_required?: Json
          id: string
          legal_basis: string
          legal_hold_trigger: string
          module_id: string
          owner: string
          payload?: Json
          progress?: number
          secretary_output?: string | null
          severity?: string
          stages?: Json
          status?: string
          tenant_id: string
          title: string
          trigger: string
          updated_at?: string
        }
        Update: {
          clock?: string
          created_at?: string
          decision_gate?: string
          due_at?: string | null
          evidence_required?: Json
          id?: string
          legal_basis?: string
          legal_hold_trigger?: string
          module_id?: string
          owner?: string
          payload?: Json
          progress?: number
          secretary_output?: string | null
          severity?: string
          stages?: Json
          status?: string
          tenant_id?: string
          title?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grc_workflows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grc_workflows_tenant_id_module_id_fkey"
            columns: ["tenant_id", "module_id"]
            isOneToOne: false
            referencedRelation: "grc_modules"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      group_campaign_expedientes: {
        Row: {
          adoption_mode: string | null
          alertas: Json
          campaign_id: string
          created_at: string
          deadline: string | null
          entity_id: string
          explain: Json
          fase_actual: string | null
          forma_administracion: string | null
          forma_social: string | null
          id: string
          jurisdiction: string | null
          responsable_id: string | null
          responsable_label: string | null
          rule_pack_code: string | null
          society_name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adoption_mode?: string | null
          alertas?: Json
          campaign_id: string
          created_at?: string
          deadline?: string | null
          entity_id: string
          explain?: Json
          fase_actual?: string | null
          forma_administracion?: string | null
          forma_social?: string | null
          id?: string
          jurisdiction?: string | null
          responsable_id?: string | null
          responsable_label?: string | null
          rule_pack_code?: string | null
          society_name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adoption_mode?: string | null
          alertas?: Json
          campaign_id?: string
          created_at?: string
          deadline?: string | null
          entity_id?: string
          explain?: Json
          fase_actual?: string | null
          forma_administracion?: string | null
          forma_social?: string | null
          id?: string
          jurisdiction?: string | null
          responsable_id?: string | null
          responsable_label?: string | null
          rule_pack_code?: string | null
          society_name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_campaign_expedientes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "group_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_expedientes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_expedientes_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_expedientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_campaign_post_tasks: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          entity_id: string
          expediente_id: string
          id: string
          live_record_id: string | null
          live_table: string | null
          owner_role: string
          status: string
          step_id: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          entity_id: string
          expediente_id: string
          id?: string
          live_record_id?: string | null
          live_table?: string | null
          owner_role?: string
          status?: string
          step_id?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          entity_id?: string
          expediente_id?: string
          id?: string
          live_record_id?: string | null
          live_table?: string | null
          owner_role?: string
          status?: string
          step_id?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_campaign_post_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "group_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_post_tasks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_post_tasks_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "group_campaign_expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_post_tasks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "group_campaign_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_post_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_campaign_steps: {
        Row: {
          adoption_mode: string
          alertas: Json
          body_id: string | null
          campaign_id: string
          created_at: string
          deadline: string | null
          dependency: string | null
          entity_id: string
          expediente_id: string
          explain: Json
          id: string
          label: string
          live_record_id: string | null
          live_table: string | null
          materia: string
          organ: string
          rule_pack_code: string | null
          status: string
          step_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adoption_mode: string
          alertas?: Json
          body_id?: string | null
          campaign_id: string
          created_at?: string
          deadline?: string | null
          dependency?: string | null
          entity_id: string
          expediente_id: string
          explain?: Json
          id?: string
          label: string
          live_record_id?: string | null
          live_table?: string | null
          materia: string
          organ: string
          rule_pack_code?: string | null
          status?: string
          step_order: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adoption_mode?: string
          alertas?: Json
          body_id?: string | null
          campaign_id?: string
          created_at?: string
          deadline?: string | null
          dependency?: string | null
          entity_id?: string
          expediente_id?: string
          explain?: Json
          id?: string
          label?: string
          live_record_id?: string | null
          live_table?: string | null
          materia?: string
          organ?: string
          rule_pack_code?: string | null
          status?: string
          step_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_campaign_steps_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "group_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_steps_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_steps_expediente_id_fkey"
            columns: ["expediente_id"]
            isOneToOne: false
            referencedRelation: "group_campaign_expedientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_campaign_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_campaigns: {
        Row: {
          acuerdos_cadena: Json
          campaign_type: string
          created_at: string
          ejercicio: string | null
          fecha_cierre: string | null
          fecha_lanzamiento: string
          id: string
          name: string
          params: Json
          plazo_limite: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          acuerdos_cadena?: Json
          campaign_type: string
          created_at?: string
          ejercicio?: string | null
          fecha_cierre?: string | null
          fecha_lanzamiento?: string
          id?: string
          name: string
          params?: Json
          plazo_limite?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          acuerdos_cadena?: Json
          campaign_type?: string
          created_at?: string
          ejercicio?: string | null
          fecha_cierre?: string | null
          fecha_lanzamiento?: string
          id?: string
          name?: string
          params?: Json
          plazo_limite?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_campaigns_tenant_id_fkey"
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
          payload: Json
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
          payload?: Json
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
          payload?: Json
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
            foreignKeyName: "incidents_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
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
          legal_reference: string | null
          name: string | null
          pack_id: string | null
          rule_config: Json | null
          rule_set_version: string
          statutory_override: boolean
          tenant_id: string
          typology_code: string
        }
        Insert: {
          company_form: string
          id?: string
          is_active?: boolean
          jurisdiction: string
          legal_reference?: string | null
          name?: string | null
          pack_id?: string | null
          rule_config?: Json | null
          rule_set_version?: string
          statutory_override?: boolean
          tenant_id: string
          typology_code: string
        }
        Update: {
          company_form?: string
          id?: string
          is_active?: boolean
          jurisdiction?: string
          legal_reference?: string | null
          name?: string | null
          pack_id?: string | null
          rule_config?: Json | null
          rule_set_version?: string
          statutory_override?: boolean
          tenant_id?: string
          typology_code?: string
        }
        Relationships: []
      }
      mandates_legacy_backup: {
        Row: {
          body_id: string | null
          capital_participacion: number | null
          clase_accion: string | null
          created_at: string | null
          director_type: string | null
          end_date: string | null
          id: string | null
          person_id: string | null
          porcentaje_capital: number | null
          representative_person_id: string | null
          role: string | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          tiene_derecho_voto: boolean | null
        }
        Insert: {
          body_id?: string | null
          capital_participacion?: number | null
          clase_accion?: string | null
          created_at?: string | null
          director_type?: string | null
          end_date?: string | null
          id?: string | null
          person_id?: string | null
          porcentaje_capital?: number | null
          representative_person_id?: string | null
          role?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string | null
          tiene_derecho_voto?: boolean | null
        }
        Update: {
          body_id?: string | null
          capital_participacion?: number | null
          clase_accion?: string | null
          created_at?: string | null
          director_type?: string | null
          end_date?: string | null
          id?: string | null
          person_id?: string | null
          porcentaje_capital?: number | null
          representative_person_id?: string | null
          role?: string | null
          start_date?: string | null
          status?: string | null
          tenant_id?: string | null
          tiene_derecho_voto?: boolean | null
        }
        Relationships: []
      }
      mandatory_books: {
        Row: {
          body_id: string | null
          book_group: string
          book_kind: string
          closed_at: string | null
          content_route: string | null
          custodian_role: string | null
          entity_id: string | null
          entries_count: number
          id: string
          is_auxiliary: boolean
          last_entry_at: string | null
          legal_basis: string | null
          legalization_deadline: string | null
          legalization_evidence_url: string | null
          legalization_mode: string | null
          legalization_requirement: string
          legalization_status: string
          maintenance_model: string | null
          opened_at: string | null
          period: number
          requires_legalization: boolean
          status: string
          supervision_tags: string[]
          tenant_id: string
          volume_number: number
        }
        Insert: {
          body_id?: string | null
          book_group?: string
          book_kind: string
          closed_at?: string | null
          content_route?: string | null
          custodian_role?: string | null
          entity_id?: string | null
          entries_count?: number
          id?: string
          is_auxiliary?: boolean
          last_entry_at?: string | null
          legal_basis?: string | null
          legalization_deadline?: string | null
          legalization_evidence_url?: string | null
          legalization_mode?: string | null
          legalization_requirement?: string
          legalization_status?: string
          maintenance_model?: string | null
          opened_at?: string | null
          period: number
          requires_legalization?: boolean
          status?: string
          supervision_tags?: string[]
          tenant_id: string
          volume_number?: number
        }
        Update: {
          body_id?: string | null
          book_group?: string
          book_kind?: string
          closed_at?: string | null
          content_route?: string | null
          custodian_role?: string | null
          entity_id?: string | null
          entries_count?: number
          id?: string
          is_auxiliary?: boolean
          last_entry_at?: string | null
          legal_basis?: string | null
          legalization_deadline?: string | null
          legalization_evidence_url?: string | null
          legalization_mode?: string | null
          legalization_requirement?: string
          legalization_status?: string
          maintenance_model?: string | null
          opened_at?: string | null
          period?: number
          requires_legalization?: boolean
          status?: string
          supervision_tags?: string[]
          tenant_id?: string
          volume_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "mandatory_books_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandatory_books_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      materia_catalog: {
        Row: {
          created_at: string
          inscribable: boolean
          materia: string
          materia_label_es: string
          matter_class: string
          min_majority_code: string | null
          plazo_inscripcion_dias: number | null
          publication_required: boolean
          referencia_legal: string | null
          requires_notary: boolean
          requires_registry: boolean
        }
        Insert: {
          created_at?: string
          inscribable?: boolean
          materia: string
          materia_label_es: string
          matter_class?: string
          min_majority_code?: string | null
          plazo_inscripcion_dias?: number | null
          publication_required?: boolean
          referencia_legal?: string | null
          requires_notary?: boolean
          requires_registry?: boolean
        }
        Update: {
          created_at?: string
          inscribable?: boolean
          materia?: string
          materia_label_es?: string
          matter_class?: string
          min_majority_code?: string | null
          plazo_inscripcion_dias?: number | null
          publication_required?: boolean
          referencia_legal?: string | null
          requires_notary?: boolean
          requires_registry?: boolean
        }
        Relationships: []
      }
      materia_template_binding: {
        Row: {
          active: boolean
          adoption_mode: string
          created_at: string
          created_by: string | null
          doc_type: string
          id: string
          jurisdiccion: string
          materia: string
          organo_tipo: string
          priority: number
          selection_reason: string
          template_id: string
          tenant_id: string
          tipo_social: string
        }
        Insert: {
          active?: boolean
          adoption_mode?: string
          created_at?: string
          created_by?: string | null
          doc_type: string
          id?: string
          jurisdiccion?: string
          materia: string
          organo_tipo?: string
          priority?: number
          selection_reason: string
          template_id: string
          tenant_id: string
          tipo_social?: string
        }
        Update: {
          active?: boolean
          adoption_mode?: string
          created_at?: string
          created_by?: string | null
          doc_type?: string
          id?: string
          jurisdiccion?: string
          materia?: string
          organo_tipo?: string
          priority?: number
          selection_reason?: string
          template_id?: string
          tenant_id?: string
          tipo_social?: string
        }
        Relationships: [
          {
            foreignKeyName: "materia_template_binding_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materia_template_binding_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          kind_resolution: string
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
          kind_resolution?: string
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
          kind_resolution?: string
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
          approval_canonical_status: string | null
          approval_effective_at: string | null
          approval_evidence_mode: string | null
          approval_evidenced_at: string | null
          approval_method: string | null
          approval_signature_claim: boolean | null
          authoritative_manifest: Json | null
          authoritative_manifest_hash: string | null
          body_id: string | null
          book_destination_resolved_at: string | null
          book_destination_status: string
          book_entry_id: string | null
          book_section_id: string | null
          canonical_minutes_hash: string | null
          content: string | null
          content_hash: string | null
          created_at: string
          entity_id: string | null
          final_legal_artifact_id: string | null
          id: string
          is_locked: boolean
          legal_gate_status: string
          legal_structure_validation: Json
          meeting_id: string | null
          president_consent_evidence_id: string | null
          president_consent_verification_id: string | null
          registered_at: string | null
          rules_applied: Json
          secretary_consent_verification_id: string | null
          secretary_constancia_evidence_id: string | null
          signed_at: string | null
          signed_by_president_id: string | null
          signed_by_secretary_id: string | null
          snapshot_id: string | null
          tenant_id: string
        }
        Insert: {
          approval_canonical_status?: string | null
          approval_effective_at?: string | null
          approval_evidence_mode?: string | null
          approval_evidenced_at?: string | null
          approval_method?: string | null
          approval_signature_claim?: boolean | null
          authoritative_manifest?: Json | null
          authoritative_manifest_hash?: string | null
          body_id?: string | null
          book_destination_resolved_at?: string | null
          book_destination_status?: string
          book_entry_id?: string | null
          book_section_id?: string | null
          canonical_minutes_hash?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          entity_id?: string | null
          final_legal_artifact_id?: string | null
          id?: string
          is_locked?: boolean
          legal_gate_status?: string
          legal_structure_validation?: Json
          meeting_id?: string | null
          president_consent_evidence_id?: string | null
          president_consent_verification_id?: string | null
          registered_at?: string | null
          rules_applied?: Json
          secretary_consent_verification_id?: string | null
          secretary_constancia_evidence_id?: string | null
          signed_at?: string | null
          signed_by_president_id?: string | null
          signed_by_secretary_id?: string | null
          snapshot_id?: string | null
          tenant_id: string
        }
        Update: {
          approval_canonical_status?: string | null
          approval_effective_at?: string | null
          approval_evidence_mode?: string | null
          approval_evidenced_at?: string | null
          approval_method?: string | null
          approval_signature_claim?: boolean | null
          authoritative_manifest?: Json | null
          authoritative_manifest_hash?: string | null
          body_id?: string | null
          book_destination_resolved_at?: string | null
          book_destination_status?: string
          book_entry_id?: string | null
          book_section_id?: string | null
          canonical_minutes_hash?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string
          entity_id?: string | null
          final_legal_artifact_id?: string | null
          id?: string
          is_locked?: boolean
          legal_gate_status?: string
          legal_structure_validation?: Json
          meeting_id?: string | null
          president_consent_evidence_id?: string | null
          president_consent_verification_id?: string | null
          registered_at?: string | null
          rules_applied?: Json
          secretary_consent_verification_id?: string | null
          secretary_constancia_evidence_id?: string | null
          signed_at?: string | null
          signed_by_president_id?: string | null
          signed_by_secretary_id?: string | null
          snapshot_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "minutes_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_book_entry_id_fkey"
            columns: ["book_entry_id"]
            isOneToOne: false
            referencedRelation: "societary_book_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_book_section_id_fkey"
            columns: ["book_section_id"]
            isOneToOne: false
            referencedRelation: "societary_book_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_final_legal_artifact_id_fkey"
            columns: ["final_legal_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_legal_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_president_consent_evidence_id_fkey"
            columns: ["president_consent_evidence_id"]
            isOneToOne: false
            referencedRelation: "secretaria_ead_interposition_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_president_consent_verification_id_fkey"
            columns: ["president_consent_verification_id"]
            isOneToOne: false
            referencedRelation: "secretaria_qtsp_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_secretary_consent_verification_id_fkey"
            columns: ["secretary_consent_verification_id"]
            isOneToOne: false
            referencedRelation: "secretaria_qtsp_verifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_secretary_constancia_evidence_id_fkey"
            columns: ["secretary_constancia_evidence_id"]
            isOneToOne: false
            referencedRelation: "secretaria_ead_interposition_evidence"
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
          {
            foreignKeyName: "minutes_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "censo_snapshot"
            referencedColumns: ["id"]
          },
        ]
      }
      no_session_expedientes: {
        Row: {
          agreement_id: string | null
          body_id: string
          condicion_adopcion: string
          created_at: string | null
          entity_id: string
          estado: string
          fecha_cierre: string | null
          id: string
          motivo_cierre: string | null
          no_session_resolution_id: string | null
          propuesta_documentos: Json | null
          propuesta_fecha: string | null
          propuesta_firmada_por: string | null
          propuesta_texto: string | null
          rule_pack_id: string | null
          rule_pack_version: string | null
          selected_template_id: string | null
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
          agreement_id?: string | null
          body_id: string
          condicion_adopcion: string
          created_at?: string | null
          entity_id: string
          estado?: string
          fecha_cierre?: string | null
          id?: string
          motivo_cierre?: string | null
          no_session_resolution_id?: string | null
          propuesta_documentos?: Json | null
          propuesta_fecha?: string | null
          propuesta_firmada_por?: string | null
          propuesta_texto?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          selected_template_id?: string | null
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
          agreement_id?: string | null
          body_id?: string
          condicion_adopcion?: string
          created_at?: string | null
          entity_id?: string
          estado?: string
          fecha_cierre?: string | null
          id?: string
          motivo_cierre?: string | null
          no_session_resolution_id?: string | null
          propuesta_documentos?: Json | null
          propuesta_fecha?: string | null
          propuesta_firmada_por?: string | null
          propuesta_texto?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          selected_template_id?: string | null
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
            foreignKeyName: "no_session_expedientes_no_session_resolution_id_fkey"
            columns: ["no_session_resolution_id"]
            isOneToOne: false
            referencedRelation: "no_session_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_expedientes_propuesta_firmada_por_fkey"
            columns: ["propuesta_firmada_por"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "no_session_expedientes_selected_template_id_fkey"
            columns: ["selected_template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
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
          agreement_kind: string | null
          body_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          matter_class: string | null
          open_idempotency_key: string | null
          opened_at: string | null
          proposal_text: string | null
          requires_unanimity: boolean
          selected_template_id: string | null
          status: string
          tenant_id: string
          title: string
          total_members: number | null
          votes_against: number
          votes_for: number
          voting_deadline: string | null
        }
        Insert: {
          abstentions?: number
          agreement_kind?: string | null
          body_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          matter_class?: string | null
          open_idempotency_key?: string | null
          opened_at?: string | null
          proposal_text?: string | null
          requires_unanimity?: boolean
          selected_template_id?: string | null
          status?: string
          tenant_id: string
          title: string
          total_members?: number | null
          votes_against?: number
          votes_for?: number
          voting_deadline?: string | null
        }
        Update: {
          abstentions?: number
          agreement_kind?: string | null
          body_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          matter_class?: string | null
          open_idempotency_key?: string | null
          opened_at?: string | null
          proposal_text?: string | null
          requires_unanimity?: boolean
          selected_template_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          total_members?: number | null
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
          {
            foreignKeyName: "no_session_resolutions_selected_template_id_fkey"
            columns: ["selected_template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
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
          legal_reference: string | null
          owner_body_id: string | null
          periodicity: string | null
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
          legal_reference?: string | null
          owner_body_id?: string | null
          periodicity?: string | null
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
          legal_reference?: string | null
          owner_body_id?: string | null
          periodicity?: string | null
          policy_id?: string | null
          retention_policy_id?: string | null
          source?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_owner_body_id_fkey"
            columns: ["owner_body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
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
          tenant_id: string
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
      person_consolidation_operations: {
        Row: {
          canonical_person_id: string
          created_at: string
          duplicate_person_id: string
          id: string
          idempotency_key: string
          result: Json
          tenant_id: string
        }
        Insert: {
          canonical_person_id: string
          created_at?: string
          duplicate_person_id: string
          id?: string
          idempotency_key: string
          result: Json
          tenant_id: string
        }
        Update: {
          canonical_person_id?: string
          created_at?: string
          duplicate_person_id?: string
          id?: string
          idempotency_key?: string
          result?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_consolidation_operations_canonical_person_id_fkey"
            columns: ["canonical_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_consolidation_operations_duplicate_person_id_fkey"
            columns: ["duplicate_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_consolidation_operations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          birth_date: string | null
          birth_place: string | null
          city: string | null
          country: string
          created_at: string
          created_by: string | null
          document_country: string
          document_type: string
          evidence_summary: Json
          governance_role: string
          id: string
          jurisdiction: string | null
          kyc_status: string
          legal_form: string | null
          lei_code: string | null
          nationality: string | null
          notes: string | null
          notification_address_line1: string | null
          notification_address_line2: string | null
          notification_address_same: boolean
          notification_city: string | null
          notification_country: string | null
          notification_postal_code: string | null
          notification_province: string | null
          onboarding_status: string
          person_id: string
          phone: string | null
          postal_code: string | null
          preferred_language: string
          province: string | null
          registry_name: string | null
          registry_number: string | null
          secondary_email: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          document_country?: string
          document_type: string
          evidence_summary?: Json
          governance_role?: string
          id?: string
          jurisdiction?: string | null
          kyc_status?: string
          legal_form?: string | null
          lei_code?: string | null
          nationality?: string | null
          notes?: string | null
          notification_address_line1?: string | null
          notification_address_line2?: string | null
          notification_address_same?: boolean
          notification_city?: string | null
          notification_country?: string | null
          notification_postal_code?: string | null
          notification_province?: string | null
          onboarding_status?: string
          person_id: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string
          province?: string | null
          registry_name?: string | null
          registry_number?: string | null
          secondary_email?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          birth_date?: string | null
          birth_place?: string | null
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          document_country?: string
          document_type?: string
          evidence_summary?: Json
          governance_role?: string
          id?: string
          jurisdiction?: string | null
          kyc_status?: string
          legal_form?: string | null
          lei_code?: string | null
          nationality?: string | null
          notes?: string | null
          notification_address_line1?: string | null
          notification_address_line2?: string | null
          notification_address_same?: boolean
          notification_city?: string | null
          notification_country?: string | null
          notification_postal_code?: string | null
          notification_province?: string | null
          onboarding_status?: string
          person_id?: string
          phone?: string | null
          postal_code?: string | null
          preferred_language?: string
          province?: string | null
          registry_name?: string | null
          registry_number?: string | null
          secondary_email?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "persona_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "persona_profiles_person_tenant_fk"
            columns: ["tenant_id", "person_id"]
            isOneToOne: true
            referencedRelation: "persons"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "persona_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      personas_cargos_rpc_operations: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          result: Json
          result_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          result?: Json
          result_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          result?: Json
          result_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_cargos_rpc_operations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          created_at: string | null
          data_class: string
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
          data_class?: string
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
          data_class?: string
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
      plantilla_capa3_overrides_por_entidad: {
        Row: {
          campo: string
          compatible_with_canonical_version: string
          created_at: string | null
          created_by: string | null
          default_value_override: Json | null
          entity_id: string
          id: string
          motivo: string
          obligatoriedad_override: string | null
          opciones_override: Json | null
          plantilla_id: string
          tenant_id: string
        }
        Insert: {
          campo: string
          compatible_with_canonical_version: string
          created_at?: string | null
          created_by?: string | null
          default_value_override?: Json | null
          entity_id: string
          id?: string
          motivo: string
          obligatoriedad_override?: string | null
          opciones_override?: Json | null
          plantilla_id: string
          tenant_id: string
        }
        Update: {
          campo?: string
          compatible_with_canonical_version?: string
          created_at?: string | null
          created_by?: string | null
          default_value_override?: Json | null
          entity_id?: string
          id?: string
          motivo?: string
          obligatoriedad_override?: string | null
          opciones_override?: Json | null
          plantilla_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capa3_overrides_tenant_fk"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_capa3_overrides_por_entidad_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_capa3_overrides_por_entidad_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_changelog: {
        Row: {
          autor: string
          bump_type: string
          created_at: string | null
          diff_summary: string | null
          from_version: string | null
          id: string
          motivo: string
          plantilla_id: string
          pr_url: string | null
          tenant_id: string
          to_version: string
        }
        Insert: {
          autor: string
          bump_type: string
          created_at?: string | null
          diff_summary?: string | null
          from_version?: string | null
          id?: string
          motivo: string
          plantilla_id: string
          pr_url?: string | null
          tenant_id: string
          to_version: string
        }
        Update: {
          autor?: string
          bump_type?: string
          created_at?: string | null
          diff_summary?: string | null
          from_version?: string | null
          id?: string
          motivo?: string
          plantilla_id?: string
          pr_url?: string | null
          tenant_id?: string
          to_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_changelog_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_changelog_tenant_fk"
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
          comunicacion_config: Json | null
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
          requiere_comunicacion: boolean
          review_date: string | null
          review_notes: string | null
          reviewed_by: string | null
          snapshot_rule_pack_required: boolean | null
          tenant_id: string
          tipo: string
          tipo_social: string | null
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
          comunicacion_config?: Json | null
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
          requiere_comunicacion?: boolean
          review_date?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          snapshot_rule_pack_required?: boolean | null
          tenant_id: string
          tipo: string
          tipo_social?: string | null
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
          comunicacion_config?: Json | null
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
          requiere_comunicacion?: boolean
          review_date?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          snapshot_rule_pack_required?: boolean | null
          tenant_id?: string
          tipo?: string
          tipo_social?: string | null
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
          content_outline: Json | null
          created_at: string | null
          created_by: string | null
          current_version: number | null
          data_provenance: Json | null
          effective_date: string | null
          id: string
          legal_hold: boolean | null
          mandatory: boolean | null
          next_review_date: string | null
          normative_tier: string | null
          owner_body_id: string | null
          owner_function: string | null
          policy_code: string
          policy_type: string | null
          retention_policy_id: string | null
          scope_level: string | null
          status: string | null
          summary: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          approval_body_id?: string | null
          approved_by?: string | null
          classification?: string | null
          content_outline?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_version?: number | null
          data_provenance?: Json | null
          effective_date?: string | null
          id?: string
          legal_hold?: boolean | null
          mandatory?: boolean | null
          next_review_date?: string | null
          normative_tier?: string | null
          owner_body_id?: string | null
          owner_function?: string | null
          policy_code: string
          policy_type?: string | null
          retention_policy_id?: string | null
          scope_level?: string | null
          status?: string | null
          summary?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          approval_body_id?: string | null
          approved_by?: string | null
          classification?: string | null
          content_outline?: Json | null
          created_at?: string | null
          created_by?: string | null
          current_version?: number | null
          data_provenance?: Json | null
          effective_date?: string | null
          id?: string
          legal_hold?: boolean | null
          mandatory?: boolean | null
          next_review_date?: string | null
          normative_tier?: string | null
          owner_body_id?: string | null
          owner_function?: string | null
          policy_code?: string
          policy_type?: string | null
          retention_policy_id?: string | null
          scope_level?: string | null
          status?: string | null
          summary?: string | null
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
            foreignKeyName: "policies_owner_body_id_fkey"
            columns: ["owner_body_id"]
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
      portal_memberships: {
        Row: {
          activated_at: string | null
          entity_id: string | null
          estado: string
          id: string
          invited_at: string
          last_access_at: string | null
          mfa_enrolled: boolean
          mfa_enrolled_at: string | null
          person_id: string
          preferences: Json
          rol_portal: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          entity_id?: string | null
          estado?: string
          id?: string
          invited_at?: string
          last_access_at?: string | null
          mfa_enrolled?: boolean
          mfa_enrolled_at?: string | null
          person_id: string
          preferences?: Json
          rol_portal: string
          tenant_id: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          entity_id?: string | null
          estado?: string
          id?: string
          invited_at?: string
          last_access_at?: string | null
          mfa_enrolled?: boolean
          mfa_enrolled_at?: string | null
          person_id?: string
          preferences?: Json
          rol_portal?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_memberships_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_memberships_tenant_id_fkey"
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
          artifact_kind: string | null
          completed_at: string | null
          content_hash_sha256: string | null
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
          source_domain: string | null
          source_id: string | null
          sr_id: string | null
          sr_status: string | null
          tenant_id: string
        }
        Insert: {
          activated_at?: string | null
          agreement_id?: string | null
          artifact_kind?: string | null
          completed_at?: string | null
          content_hash_sha256?: string | null
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
          source_domain?: string | null
          source_id?: string | null
          sr_id?: string | null
          sr_status?: string | null
          tenant_id: string
        }
        Update: {
          activated_at?: string | null
          agreement_id?: string | null
          artifact_kind?: string | null
          completed_at?: string | null
          content_hash_sha256?: string | null
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
          source_domain?: string | null
          source_id?: string | null
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
          is_active: boolean
          role_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          role_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
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
      registry_filing_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          effective_at: string
          event_type: string
          evidence_artifact_id: string | null
          filing_id: string
          from_status: string | null
          id: string
          operation_id: string
          payload: Json
          request_fingerprint: string
          sequence_no: number
          tenant_id: string
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          effective_at: string
          event_type: string
          evidence_artifact_id?: string | null
          filing_id: string
          from_status?: string | null
          id?: string
          operation_id: string
          payload?: Json
          request_fingerprint: string
          sequence_no: number
          tenant_id: string
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          effective_at?: string
          event_type?: string
          evidence_artifact_id?: string | null
          filing_id?: string
          from_status?: string | null
          id?: string
          operation_id?: string
          payload?: Json
          request_fingerprint?: string
          sequence_no?: number
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "registry_filing_events_evidence_artifact_id_fkey"
            columns: ["evidence_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_filing_events_filing_id_fkey"
            columns: ["filing_id"]
            isOneToOne: false
            referencedRelation: "registry_filings"
            referencedColumns: ["id"]
          },
        ]
      }
      registry_filings: {
        Row: {
          agreement_id: string | null
          base_document_artifact_id: string | null
          base_document_kind: string | null
          borme_ref: string | null
          conservatoria_ref: string | null
          created_at: string
          deed_date: string | null
          deed_id: string | null
          deed_reference: string | null
          defect_details: Json | null
          diario_oficial_ref: string | null
          elevated_at: string | null
          entity_id: string | null
          estimated_resolution: string | null
          filing_number: string | null
          filing_type: string | null
          filing_via: string
          id: string
          inscription_number: string | null
          jucerja_ref: string | null
          notary_id: string | null
          notary_name: string | null
          presentation_date: string | null
          procedure_profile_code: string | null
          procedure_snapshot: Json
          protocol_number: string | null
          psm_ref: string | null
          publication_reference: string | null
          published_at: string | null
          qualification_outcome: string | null
          qualified_at: string | null
          registered_at: string | null
          resolution_document_url: string | null
          rule_pack_version_id: string | null
          siger_ref: string | null
          source_domain: string | null
          source_id: string | null
          state_version: number
          status: string
          tenant_id: string
          updated_at: string
          workflow_version: number
        }
        Insert: {
          agreement_id?: string | null
          base_document_artifact_id?: string | null
          base_document_kind?: string | null
          borme_ref?: string | null
          conservatoria_ref?: string | null
          created_at?: string
          deed_date?: string | null
          deed_id?: string | null
          deed_reference?: string | null
          defect_details?: Json | null
          diario_oficial_ref?: string | null
          elevated_at?: string | null
          entity_id?: string | null
          estimated_resolution?: string | null
          filing_number?: string | null
          filing_type?: string | null
          filing_via?: string
          id?: string
          inscription_number?: string | null
          jucerja_ref?: string | null
          notary_id?: string | null
          notary_name?: string | null
          presentation_date?: string | null
          procedure_profile_code?: string | null
          procedure_snapshot?: Json
          protocol_number?: string | null
          psm_ref?: string | null
          publication_reference?: string | null
          published_at?: string | null
          qualification_outcome?: string | null
          qualified_at?: string | null
          registered_at?: string | null
          resolution_document_url?: string | null
          rule_pack_version_id?: string | null
          siger_ref?: string | null
          source_domain?: string | null
          source_id?: string | null
          state_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          workflow_version?: number
        }
        Update: {
          agreement_id?: string | null
          base_document_artifact_id?: string | null
          base_document_kind?: string | null
          borme_ref?: string | null
          conservatoria_ref?: string | null
          created_at?: string
          deed_date?: string | null
          deed_id?: string | null
          deed_reference?: string | null
          defect_details?: Json | null
          diario_oficial_ref?: string | null
          elevated_at?: string | null
          entity_id?: string | null
          estimated_resolution?: string | null
          filing_number?: string | null
          filing_type?: string | null
          filing_via?: string
          id?: string
          inscription_number?: string | null
          jucerja_ref?: string | null
          notary_id?: string | null
          notary_name?: string | null
          presentation_date?: string | null
          procedure_profile_code?: string | null
          procedure_snapshot?: Json
          protocol_number?: string | null
          psm_ref?: string | null
          publication_reference?: string | null
          published_at?: string | null
          qualification_outcome?: string | null
          qualified_at?: string | null
          registered_at?: string | null
          resolution_document_url?: string | null
          rule_pack_version_id?: string | null
          siger_ref?: string | null
          source_domain?: string | null
          source_id?: string | null
          state_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          workflow_version?: number
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
            foreignKeyName: "registry_filings_base_document_artifact_id_fkey"
            columns: ["base_document_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_filings_deed_id_fkey"
            columns: ["deed_id"]
            isOneToOne: false
            referencedRelation: "deeds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_filings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registry_filings_rule_pack_version_id_fkey"
            columns: ["rule_pack_version_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_versions"
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
            foreignKeyName: "regulatory_notifications_ack_evidence_id_fkey"
            columns: ["ack_evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
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
            foreignKeyName: "representaciones_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
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
          assessed_band: string | null
          assessment_breakdown: Json | null
          assessment_provenance: Json | null
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
          assessed_band?: string | null
          assessment_breakdown?: Json | null
          assessment_provenance?: Json | null
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
          assessed_band?: string | null
          assessment_breakdown?: Json | null
          assessment_provenance?: Json | null
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
          blocking_issues: Json
          created_at: string | null
          etapa: string
          evaluation_hash: string | null
          explain: Json
          id: string
          ok: boolean
          overrides_hash: string | null
          payload_hash: string | null
          rule_pack_id: string | null
          rule_pack_version: string | null
          rule_pack_version_id: string | null
          ruleset_snapshot_id: string | null
          severity: string | null
          tenant_id: string
          tsq_token: string | null
          warnings: Json
        }
        Insert: {
          agreement_id: string
          blocking_issues?: Json
          created_at?: string | null
          etapa: string
          evaluation_hash?: string | null
          explain: Json
          id?: string
          ok: boolean
          overrides_hash?: string | null
          payload_hash?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          rule_pack_version_id?: string | null
          ruleset_snapshot_id?: string | null
          severity?: string | null
          tenant_id: string
          tsq_token?: string | null
          warnings?: Json
        }
        Update: {
          agreement_id?: string
          blocking_issues?: Json
          created_at?: string | null
          etapa?: string
          evaluation_hash?: string | null
          explain?: Json
          id?: string
          ok?: boolean
          overrides_hash?: string | null
          payload_hash?: string | null
          rule_pack_id?: string | null
          rule_pack_version?: string | null
          rule_pack_version_id?: string | null
          ruleset_snapshot_id?: string | null
          severity?: string | null
          tenant_id?: string
          tsq_token?: string | null
          warnings?: Json
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
            foreignKeyName: "rule_evaluation_results_rule_pack_version_id_fkey"
            columns: ["rule_pack_version_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_versions"
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
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean | null
          pack_id: string
          payload: Json
          payload_hash: string | null
          status: string | null
          supersedes_version_id: string | null
          version: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          pack_id: string
          payload: Json
          payload_hash?: string | null
          status?: string | null
          supersedes_version_id?: string | null
          version: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          pack_id?: string
          payload?: Json
          payload_hash?: string | null
          status?: string | null
          supersedes_version_id?: string | null
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
          {
            foreignKeyName: "rule_pack_versions_supersedes_version_id_fkey"
            columns: ["supersedes_version_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_versions"
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
      secretaria_annual_accounts_components: {
        Row: {
          annual_accounts_set_id: string
          component_kind: string
          content_hash_sha256: string
          content_hash_sha512: string
          created_at: string
          evidence_bundle_id: string
          evidence_manifest_hash: string
          id: string
          required_for_set: boolean
          storage_object_id: string
          storage_path: string
          storage_version: string
          tenant_id: string
        }
        Insert: {
          annual_accounts_set_id: string
          component_kind: string
          content_hash_sha256: string
          content_hash_sha512: string
          created_at?: string
          evidence_bundle_id: string
          evidence_manifest_hash: string
          id?: string
          required_for_set: boolean
          storage_object_id: string
          storage_path: string
          storage_version: string
          tenant_id: string
        }
        Update: {
          annual_accounts_set_id?: string
          component_kind?: string
          content_hash_sha256?: string
          content_hash_sha512?: string
          created_at?: string
          evidence_bundle_id?: string
          evidence_manifest_hash?: string
          id?: string
          required_for_set?: boolean
          storage_object_id?: string
          storage_path?: string
          storage_version?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_componen_annual_accounts_set_id_fkey"
            columns: ["annual_accounts_set_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_components_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_components_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_components_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_annual_accounts_execution_artifacts: {
        Row: {
          annual_accounts_set_id: string
          archived_at: string
          binary_hash_sha256: string
          binary_hash_sha512: string
          created_at: string
          evidence_bundle_id: string
          execution_manifest: Json
          execution_manifest_hash_sha256: string
          execution_status: string
          id: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          annual_accounts_set_id: string
          archived_at: string
          binary_hash_sha256: string
          binary_hash_sha512: string
          created_at?: string
          evidence_bundle_id: string
          execution_manifest: Json
          execution_manifest_hash_sha256: string
          execution_status: string
          id?: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          annual_accounts_set_id?: string
          archived_at?: string
          binary_hash_sha256?: string
          binary_hash_sha512?: string
          created_at?: string
          evidence_bundle_id?: string
          execution_manifest?: Json
          execution_manifest_hash_sha256?: string
          execution_status?: string
          id?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_executio_annual_accounts_set_id_fkey"
            columns: ["annual_accounts_set_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_execution_ar_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_execution_ar_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_execution_artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_annual_accounts_expected_signers: {
        Row: {
          created_at: string
          id: string
          person_id: string
          person_name_snapshot: string
          seat_role_snapshot: string
          signer_roster_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_id: string
          person_name_snapshot: string
          seat_role_snapshot: string
          signer_roster_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          person_id?: string
          person_name_snapshot?: string
          seat_role_snapshot?: string
          signer_roster_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_expected_signe_signer_roster_id_fkey"
            columns: ["signer_roster_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_signer_rosters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_expected_signers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_expected_signers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_annual_accounts_sets: {
        Row: {
          agenda_item_id: string
          approval_scope: string
          approval_status: string
          approved_at: string
          approved_by: string | null
          body_id: string
          cash_flow_statement_applicable: boolean
          created_at: string
          entity_id: string
          fiscal_year: number
          id: string
          immutability_status: string
          immutable_at: string
          is_consolidated: boolean
          management_report_applicable: boolean
          manifest: Json
          manifest_hash_sha256: string
          meeting_id: string
          supersedes_set_id: string | null
          tenant_id: string
          version_number: number
        }
        Insert: {
          agenda_item_id: string
          approval_scope: string
          approval_status: string
          approved_at: string
          approved_by?: string | null
          body_id: string
          cash_flow_statement_applicable: boolean
          created_at?: string
          entity_id: string
          fiscal_year: number
          id?: string
          immutability_status: string
          immutable_at: string
          is_consolidated?: boolean
          management_report_applicable: boolean
          manifest: Json
          manifest_hash_sha256: string
          meeting_id: string
          supersedes_set_id?: string | null
          tenant_id: string
          version_number: number
        }
        Update: {
          agenda_item_id?: string
          approval_scope?: string
          approval_status?: string
          approved_at?: string
          approved_by?: string | null
          body_id?: string
          cash_flow_statement_applicable?: boolean
          created_at?: string
          entity_id?: string
          fiscal_year?: number
          id?: string
          immutability_status?: string
          immutable_at?: string
          is_consolidated?: boolean
          management_report_applicable?: boolean
          manifest?: Json
          manifest_hash_sha256?: string
          meeting_id?: string
          supersedes_set_id?: string | null
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_sets_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sets_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sets_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sets_supersedes_set_id_fkey"
            columns: ["supersedes_set_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_annual_accounts_signature_review_events: {
        Row: {
          annual_accounts_set_id: string
          document_hash_sha256: string
          expected_signer_id: string
          id: string
          review_note: string
          review_status: string
          reviewed_at: string
          reviewer_person_id: string
          reviewer_user_id: string
          signature_fact_source: string
          signed_at: string
          tenant_id: string
        }
        Insert: {
          annual_accounts_set_id: string
          document_hash_sha256: string
          expected_signer_id: string
          id?: string
          review_note: string
          review_status: string
          reviewed_at?: string
          reviewer_person_id: string
          reviewer_user_id: string
          signature_fact_source: string
          signed_at: string
          tenant_id: string
        }
        Update: {
          annual_accounts_set_id?: string
          document_hash_sha256?: string
          expected_signer_id?: string
          id?: string
          review_note?: string
          review_status?: string
          reviewed_at?: string
          reviewer_person_id?: string
          reviewer_user_id?: string
          signature_fact_source?: string
          signed_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_signatur_annual_accounts_set_id_fkey"
            columns: ["annual_accounts_set_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signature_re_expected_signer_id_fkey"
            columns: ["expected_signer_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_expected_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signature_re_reviewer_person_id_fkey"
            columns: ["reviewer_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signature_review_even_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_annual_accounts_signer_outcomes: {
        Row: {
          expected_signer_id: string
          external_signature_evidence_id: string | null
          id: string
          missing_signature_cause_code: string | null
          missing_signature_cause_text: string | null
          outcome_manifest: Json
          outcome_manifest_hash_sha256: string
          outcome_type: string
          provider_evidence_bundle_id: string | null
          provider_reference: string | null
          provider_signature_claim: boolean
          provider_signature_type: string | null
          recorded_at: string
          recorded_by: string | null
          signature_fact_source: string | null
          signature_request_id: string | null
          signed_at: string | null
          signed_output_hash_sha256: string | null
          signed_output_hash_sha512: string | null
          supersedes_outcome_id: string | null
          tenant_id: string
        }
        Insert: {
          expected_signer_id: string
          external_signature_evidence_id?: string | null
          id?: string
          missing_signature_cause_code?: string | null
          missing_signature_cause_text?: string | null
          outcome_manifest: Json
          outcome_manifest_hash_sha256: string
          outcome_type: string
          provider_evidence_bundle_id?: string | null
          provider_reference?: string | null
          provider_signature_claim?: boolean
          provider_signature_type?: string | null
          recorded_at?: string
          recorded_by?: string | null
          signature_fact_source?: string | null
          signature_request_id?: string | null
          signed_at?: string | null
          signed_output_hash_sha256?: string | null
          signed_output_hash_sha512?: string | null
          supersedes_outcome_id?: string | null
          tenant_id: string
        }
        Update: {
          expected_signer_id?: string
          external_signature_evidence_id?: string | null
          id?: string
          missing_signature_cause_code?: string | null
          missing_signature_cause_text?: string | null
          outcome_manifest?: Json
          outcome_manifest_hash_sha256?: string
          outcome_type?: string
          provider_evidence_bundle_id?: string | null
          provider_reference?: string | null
          provider_signature_claim?: boolean
          provider_signature_type?: string | null
          recorded_at?: string
          recorded_by?: string | null
          signature_fact_source?: string | null
          signature_request_id?: string | null
          signed_at?: string | null
          signed_output_hash_sha256?: string | null
          signed_output_hash_sha512?: string | null
          supersedes_outcome_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_si_external_signature_evidence__fkey"
            columns: ["external_signature_evidence_id"]
            isOneToOne: false
            referencedRelation: "secretaria_ead_interposition_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sig_provider_evidence_bundle_id_fkey"
            columns: ["provider_evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_sig_provider_evidence_bundle_id_fkey"
            columns: ["provider_evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_ou_supersedes_outcome_id_fkey"
            columns: ["supersedes_outcome_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_signer_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_out_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "qtsp_signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_outco_expected_signer_id_fkey"
            columns: ["expected_signer_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_expected_signers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_outcomes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_annual_accounts_signer_rosters: {
        Row: {
          agreement_id: string
          annual_accounts_set_id: string
          frozen_at: string
          frozen_by: string | null
          id: string
          resolution_id: string
          roster_hash_sha256: string
          roster_manifest: Json
          snapshot_id: string
          tenant_id: string
        }
        Insert: {
          agreement_id: string
          annual_accounts_set_id: string
          frozen_at?: string
          frozen_by?: string | null
          id?: string
          resolution_id: string
          roster_hash_sha256: string
          roster_manifest: Json
          snapshot_id: string
          tenant_id: string
        }
        Update: {
          agreement_id?: string
          annual_accounts_set_id?: string
          frozen_at?: string
          frozen_by?: string | null
          id?: string
          resolution_id?: string
          roster_hash_sha256?: string
          roster_manifest?: Json
          snapshot_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_annual_accounts_signer_r_annual_accounts_set_id_fkey"
            columns: ["annual_accounts_set_id"]
            isOneToOne: false
            referencedRelation: "secretaria_annual_accounts_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_rosters_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_rosters_resolution_id_fkey"
            columns: ["resolution_id"]
            isOneToOne: false
            referencedRelation: "meeting_resolutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_rosters_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "censo_snapshot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_annual_accounts_signer_rosters_tenant_id_fkey"
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
      secretaria_demo_simulation_quarantine: {
        Row: {
          control_date: string
          entity_id: string
          id: string
          immutable_at: string
          legal_effect: string
          meeting_id: string
          original_agreements: Json
          original_certifications: Json
          original_meeting_status: string
          original_minutes: Json
          original_resolutions: Json
          reason_code: string
          remediated_meeting_status: string
          scheduled_start: string
          tenant_id: string
        }
        Insert: {
          control_date: string
          entity_id: string
          id?: string
          immutable_at?: string
          legal_effect: string
          meeting_id: string
          original_agreements?: Json
          original_certifications?: Json
          original_meeting_status: string
          original_minutes?: Json
          original_resolutions?: Json
          reason_code: string
          remediated_meeting_status: string
          scheduled_start: string
          tenant_id: string
        }
        Update: {
          control_date?: string
          entity_id?: string
          id?: string
          immutable_at?: string
          legal_effect?: string
          meeting_id?: string
          original_agreements?: Json
          original_certifications?: Json
          original_meeting_status?: string
          original_minutes?: Json
          original_resolutions?: Json
          reason_code?: string
          remediated_meeting_status?: string
          scheduled_start?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_demo_simulation_quarantine_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_demo_simulation_quarantine_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_demo_simulation_quarantine_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_document_artifacts: {
        Row: {
          artifact_kind: string
          content_hash: string | null
          created_at: string
          document_url: string | null
          entity_id: string | null
          evidence_bundle_id: string | null
          evidence_status: string
          generated_at: string | null
          generated_by: string | null
          hash_sha512: string | null
          id: string
          metadata: Json
          mime_type: string | null
          normative_snapshot_hash: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rule_pack_version_id: string | null
          source_domain: string | null
          source_hash: string | null
          source_id: string | null
          source_payload: Json
          status: string
          supersedes_artifact_id: string | null
          template_id: string | null
          template_version: string | null
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          artifact_kind: string
          content_hash?: string | null
          created_at?: string
          document_url?: string | null
          entity_id?: string | null
          evidence_bundle_id?: string | null
          evidence_status?: string
          generated_at?: string | null
          generated_by?: string | null
          hash_sha512?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          normative_snapshot_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_pack_version_id?: string | null
          source_domain?: string | null
          source_hash?: string | null
          source_id?: string | null
          source_payload?: Json
          status?: string
          supersedes_artifact_id?: string | null
          template_id?: string | null
          template_version?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          artifact_kind?: string
          content_hash?: string | null
          created_at?: string
          document_url?: string | null
          entity_id?: string | null
          evidence_bundle_id?: string | null
          evidence_status?: string
          generated_at?: string | null
          generated_by?: string | null
          hash_sha512?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          normative_snapshot_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rule_pack_version_id?: string | null
          source_domain?: string | null
          source_hash?: string | null
          source_id?: string | null
          source_payload?: Json
          status?: string
          supersedes_artifact_id?: string | null
          template_id?: string | null
          template_version?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_document_artifacts_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_rule_pack_version_id_fkey"
            columns: ["rule_pack_version_id"]
            isOneToOne: false
            referencedRelation: "rule_pack_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_supersedes_artifact_id_fkey"
            columns: ["supersedes_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_document_artifacts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_document_drafts: {
        Row: {
          agreement_id: string | null
          capa3_values: Json
          configured_at: string | null
          content_hash_sha256: string | null
          created_at: string
          created_by: string | null
          document_request_id: string
          document_type: string
          draft_key_sha256: string
          draft_state: string
          id: string
          metadata: Json
          post_render_validation: Json
          rendered_body_text: string
          request_hash_sha256: string
          system_trace_text: string
          template_id: string | null
          template_tipo: string | null
          template_version: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          agreement_id?: string | null
          capa3_values?: Json
          configured_at?: string | null
          content_hash_sha256?: string | null
          created_at?: string
          created_by?: string | null
          document_request_id: string
          document_type: string
          draft_key_sha256: string
          draft_state?: string
          id?: string
          metadata?: Json
          post_render_validation?: Json
          rendered_body_text: string
          request_hash_sha256: string
          system_trace_text: string
          template_id?: string | null
          template_tipo?: string | null
          template_version?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          agreement_id?: string | null
          capa3_values?: Json
          configured_at?: string | null
          content_hash_sha256?: string | null
          created_at?: string
          created_by?: string | null
          document_request_id?: string
          document_type?: string
          draft_key_sha256?: string
          draft_state?: string
          id?: string
          metadata?: Json
          post_render_validation?: Json
          rendered_body_text?: string
          request_hash_sha256?: string
          system_trace_text?: string
          template_id?: string | null
          template_tipo?: string | null
          template_version?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_document_drafts_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_document_drafts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_ead_interposition_evidence: {
        Row: {
          created_at: string
          evidence_bundle_id: string
          evidence_purpose: string
          id: string
          legal_artifact_id: string | null
          occurred_at: string
          provider: string
          provider_event_id: string
          provider_hash_sha256: string
          provider_mode: string
          provider_payload: Json
          provider_reference: string
          provider_request_id: string
          provider_service: string
          provider_status: string
          signature_claim: boolean
          signature_request_id: string | null
          source_domain: string
          source_hash_sha256: string
          source_id: string
          subject_person_id: string | null
          subject_role: string | null
          tenant_id: string
          verified_at: string
          verified_by: string
        }
        Insert: {
          created_at?: string
          evidence_bundle_id: string
          evidence_purpose: string
          id?: string
          legal_artifact_id?: string | null
          occurred_at: string
          provider?: string
          provider_event_id: string
          provider_hash_sha256: string
          provider_mode?: string
          provider_payload: Json
          provider_reference: string
          provider_request_id: string
          provider_service: string
          provider_status: string
          signature_claim?: boolean
          signature_request_id?: string | null
          source_domain: string
          source_hash_sha256: string
          source_id: string
          subject_person_id?: string | null
          subject_role?: string | null
          tenant_id: string
          verified_at: string
          verified_by: string
        }
        Update: {
          created_at?: string
          evidence_bundle_id?: string
          evidence_purpose?: string
          id?: string
          legal_artifact_id?: string | null
          occurred_at?: string
          provider?: string
          provider_event_id?: string
          provider_hash_sha256?: string
          provider_mode?: string
          provider_payload?: Json
          provider_reference?: string
          provider_request_id?: string
          provider_service?: string
          provider_status?: string
          signature_claim?: boolean
          signature_request_id?: string | null
          source_domain?: string
          source_hash_sha256?: string
          source_id?: string
          subject_person_id?: string | null
          subject_role?: string | null
          tenant_id?: string
          verified_at?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_ead_interposition_evidence_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_ead_interposition_evidence_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_ead_interposition_evidence_legal_artifact_id_fkey"
            columns: ["legal_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_legal_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_ead_interposition_evidence_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "qtsp_signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_ead_interposition_evidence_subject_person_id_fkey"
            columns: ["subject_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_ead_interposition_evidence_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_ead_provider_action_reservations: {
        Row: {
          action_kind: string
          id: string
          payload_hash_sha256: string
          reservation_context: Json
          reserved_at: string
          reserved_by: string
          source_domain: string
          source_hash_sha256: string
          source_id: string
          subject_key: string
          tenant_id: string
        }
        Insert: {
          action_kind: string
          id?: string
          payload_hash_sha256: string
          reservation_context?: Json
          reserved_at?: string
          reserved_by: string
          source_domain: string
          source_hash_sha256: string
          source_id: string
          subject_key?: string
          tenant_id: string
        }
        Update: {
          action_kind?: string
          id?: string
          payload_hash_sha256?: string
          reservation_context?: Json
          reserved_at?: string
          reserved_by?: string
          source_domain?: string
          source_hash_sha256?: string
          source_id?: string
          subject_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_ead_provider_action_reservations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_effective_rule_matrix: {
        Row: {
          confidence: string
          deadlines: Json
          documents_required: Json
          entity_id: string
          formalization: Json
          generated_at: string
          generated_by: string | null
          id: string
          majority_rule: string
          matter_code: string
          operational_status: string
          organo_tipo: string
          profile_hash: string
          quorum_rule: string
          source_layers: Json
          tenant_id: string
        }
        Insert: {
          confidence?: string
          deadlines?: Json
          documents_required?: Json
          entity_id: string
          formalization?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          majority_rule: string
          matter_code: string
          operational_status?: string
          organo_tipo: string
          profile_hash: string
          quorum_rule: string
          source_layers?: Json
          tenant_id: string
        }
        Update: {
          confidence?: string
          deadlines?: Json
          documents_required?: Json
          entity_id?: string
          formalization?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          majority_rule?: string
          matter_code?: string
          operational_status?: string
          organo_tipo?: string
          profile_hash?: string
          quorum_rule?: string
          source_layers?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_effective_rule_matrix_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_effective_rule_matrix_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_legal_artifacts: {
        Row: {
          artifact_kind: string
          artifact_status: string
          binary_hash_sha256: string
          binary_hash_sha512: string
          content_hash_sha256: string
          created_at: string
          created_by: string | null
          evidence_bundle_id: string
          evidence_manifest_hash: string
          evidence_mode: string
          id: string
          immutable_at: string
          server_manifest: Json
          server_manifest_hash: string
          signature_packaging: string | null
          source_domain: string
          source_id: string
          tenant_id: string
        }
        Insert: {
          artifact_kind: string
          artifact_status?: string
          binary_hash_sha256: string
          binary_hash_sha512: string
          content_hash_sha256: string
          created_at?: string
          created_by?: string | null
          evidence_bundle_id: string
          evidence_manifest_hash: string
          evidence_mode?: string
          id?: string
          immutable_at?: string
          server_manifest: Json
          server_manifest_hash: string
          signature_packaging?: string | null
          source_domain: string
          source_id: string
          tenant_id: string
        }
        Update: {
          artifact_kind?: string
          artifact_status?: string
          binary_hash_sha256?: string
          binary_hash_sha512?: string
          content_hash_sha256?: string
          created_at?: string
          created_by?: string | null
          evidence_bundle_id?: string
          evidence_manifest_hash?: string
          evidence_mode?: string
          id?: string
          immutable_at?: string
          server_manifest?: Json
          server_manifest_hash?: string
          signature_packaging?: string | null
          source_domain?: string
          source_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_legal_artifacts_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_legal_artifacts_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_legal_artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_normative_backfill_runs: {
        Row: {
          audit_log_id: string | null
          created_at: string
          created_by: string | null
          entities_scanned: number
          entities_updated: number
          id: string
          profile_hash: string | null
          run_mode: string
          summary: Json
          tenant_id: string
        }
        Insert: {
          audit_log_id?: string | null
          created_at?: string
          created_by?: string | null
          entities_scanned?: number
          entities_updated?: number
          id?: string
          profile_hash?: string | null
          run_mode: string
          summary?: Json
          tenant_id: string
        }
        Update: {
          audit_log_id?: string | null
          created_at?: string
          created_by?: string | null
          entities_scanned?: number
          entities_updated?: number
          id?: string
          profile_hash?: string | null
          run_mode?: string
          summary?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_normative_backfill_runs_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_normative_backfill_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_normative_event_log: {
        Row: {
          after_state: Json
          attributes: Json
          audit_log_id: string | null
          before_state: Json
          created_at: string
          created_by: string | null
          duration_ms: number | null
          entity_id: string | null
          event_channel: string
          event_dedupe_key: string | null
          event_name: string
          id: string
          matter: string | null
          tenant_id: string
          user_role: string
        }
        Insert: {
          after_state?: Json
          attributes?: Json
          audit_log_id?: string | null
          before_state?: Json
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          event_channel?: string
          event_dedupe_key?: string | null
          event_name: string
          id?: string
          matter?: string | null
          tenant_id: string
          user_role: string
        }
        Update: {
          after_state?: Json
          attributes?: Json
          audit_log_id?: string | null
          before_state?: Json
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          event_channel?: string
          event_dedupe_key?: string | null
          event_name?: string
          id?: string
          matter?: string | null
          tenant_id?: string
          user_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_normative_event_log_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_normative_event_log_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_normative_event_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_normative_framework_status: {
        Row: {
          company_form: string | null
          created_at: string
          diagnostics: Json
          entity_id: string
          has_conflict_of_laws: boolean
          has_minimum_templates: boolean
          has_organs: boolean
          has_pactos: boolean
          has_rule_set: boolean
          has_statutes: boolean
          id: string
          jurisdiction: string | null
          last_backfill_run_id: string | null
          missing_items: Json
          profile_hash: string | null
          rule_set_company_form: string | null
          source_coverage_pct: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_form?: string | null
          created_at?: string
          diagnostics?: Json
          entity_id: string
          has_conflict_of_laws?: boolean
          has_minimum_templates?: boolean
          has_organs?: boolean
          has_pactos?: boolean
          has_rule_set?: boolean
          has_statutes?: boolean
          id?: string
          jurisdiction?: string | null
          last_backfill_run_id?: string | null
          missing_items?: Json
          profile_hash?: string | null
          rule_set_company_form?: string | null
          source_coverage_pct?: number
          status: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_form?: string | null
          created_at?: string
          diagnostics?: Json
          entity_id?: string
          has_conflict_of_laws?: boolean
          has_minimum_templates?: boolean
          has_organs?: boolean
          has_pactos?: boolean
          has_rule_set?: boolean
          has_statutes?: boolean
          id?: string
          jurisdiction?: string | null
          last_backfill_run_id?: string | null
          missing_items?: Json
          profile_hash?: string | null
          rule_set_company_form?: string | null
          source_coverage_pct?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_normative_framework_status_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_normative_framework_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_normative_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          entity_id: string
          id: string
          justification: string
          matter_code: string
          published_at: string | null
          published_by: string | null
          requirement_key: string
          requirement_value: Json
          rule_param_override_id: string | null
          source_ref: string
          source_type: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          entity_id: string
          id?: string
          justification: string
          matter_code: string
          published_at?: string | null
          published_by?: string | null
          requirement_key: string
          requirement_value: Json
          rule_param_override_id?: string | null
          source_ref: string
          source_type: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          entity_id?: string
          id?: string
          justification?: string
          matter_code?: string
          published_at?: string | null
          published_by?: string | null
          requirement_key?: string
          requirement_value?: Json
          rule_param_override_id?: string | null
          source_ref?: string
          source_type?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_normative_overrides_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_normative_overrides_rule_param_override_id_fkey"
            columns: ["rule_param_override_id"]
            isOneToOne: false
            referencedRelation: "rule_param_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_normative_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_organ_rules: {
        Row: {
          body_id: string
          competence_type: string
          created_at: string
          created_by: string | null
          effective_from: string
          effective_until: string | null
          entity_id: string
          id: string
          majority_rule: string
          matter_code: string
          quorum_rule: string
          source_ref: string
          source_type: string
          source_version_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_id: string
          competence_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          entity_id: string
          id?: string
          majority_rule: string
          matter_code: string
          quorum_rule: string
          source_ref: string
          source_type: string
          source_version_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_id?: string
          competence_type?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_until?: string | null
          entity_id?: string
          id?: string
          majority_rule?: string
          matter_code?: string
          quorum_rule?: string
          source_ref?: string
          source_type?: string
          source_version_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_organ_rules_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_organ_rules_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_organ_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_organ_source_links: {
        Row: {
          created_at: string
          created_by: string | null
          document_uri: string | null
          id: string
          organ_rule_id: string
          source_excerpt: string | null
          source_ref: string
          source_type: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_uri?: string | null
          id?: string
          organ_rule_id: string
          source_excerpt?: string | null
          source_ref: string
          source_type: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_uri?: string | null
          id?: string
          organ_rule_id?: string
          source_excerpt?: string | null
          source_ref?: string
          source_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_organ_source_links_organ_rule_id_fkey"
            columns: ["organ_rule_id"]
            isOneToOne: false
            referencedRelation: "secretaria_organ_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_organ_source_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_pacto_clause_mappings: {
        Row: {
          clause_ref: string
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          legal_effect: string
          matter_code: string
          pacto_id: string | null
          source_ref: string | null
          status: string
          tenant_id: string
          waiver_status: string
        }
        Insert: {
          clause_ref: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          legal_effect: string
          matter_code: string
          pacto_id?: string | null
          source_ref?: string | null
          status?: string
          tenant_id: string
          waiver_status?: string
        }
        Update: {
          clause_ref?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          legal_effect?: string
          matter_code?: string
          pacto_id?: string | null
          source_ref?: string | null
          status?: string
          tenant_id?: string
          waiver_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_pacto_clause_mappings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_pacto_clause_mappings_pacto_id_fkey"
            columns: ["pacto_id"]
            isOneToOne: false
            referencedRelation: "pactos_parasociales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_pacto_clause_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_qtsp_verifications: {
        Row: {
          certificate_fingerprint_sha256: string | null
          created_at: string
          id: string
          legal_artifact_id: string
          provider: string
          provider_evidence_bundle_id: string
          provider_reference: string
          provider_signature_type: string
          request_input_hash_sha256: string
          signature_packaging: string
          signature_request_id: string
          signed_output_hash_sha256: string
          signed_output_hash_sha512: string
          signer_person_id: string
          signer_role: string
          tenant_id: string
          verification_payload: Json
          verification_status: string
          verified_at: string
          verified_by: string | null
        }
        Insert: {
          certificate_fingerprint_sha256?: string | null
          created_at?: string
          id?: string
          legal_artifact_id: string
          provider: string
          provider_evidence_bundle_id: string
          provider_reference: string
          provider_signature_type: string
          request_input_hash_sha256: string
          signature_packaging: string
          signature_request_id: string
          signed_output_hash_sha256: string
          signed_output_hash_sha512: string
          signer_person_id: string
          signer_role: string
          tenant_id: string
          verification_payload: Json
          verification_status: string
          verified_at: string
          verified_by?: string | null
        }
        Update: {
          certificate_fingerprint_sha256?: string | null
          created_at?: string
          id?: string
          legal_artifact_id?: string
          provider?: string
          provider_evidence_bundle_id?: string
          provider_reference?: string
          provider_signature_type?: string
          request_input_hash_sha256?: string
          signature_packaging?: string
          signature_request_id?: string
          signed_output_hash_sha256?: string
          signed_output_hash_sha512?: string
          signer_person_id?: string
          signer_role?: string
          tenant_id?: string
          verification_payload?: Json
          verification_status?: string
          verified_at?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_qtsp_verifications_legal_artifact_id_fkey"
            columns: ["legal_artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_legal_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_qtsp_verifications_provider_evidence_bundle_id_fkey"
            columns: ["provider_evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_qtsp_verifications_provider_evidence_bundle_id_fkey"
            columns: ["provider_evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_qtsp_verifications_signature_request_id_fkey"
            columns: ["signature_request_id"]
            isOneToOne: false
            referencedRelation: "qtsp_signature_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_qtsp_verifications_signer_person_id_fkey"
            columns: ["signer_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_qtsp_verifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      secretaria_statute_clause_mappings: {
        Row: {
          clause_ref: string
          confidence: string
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          matter_code: string
          requirement_key: string
          requirement_value: Json
          source_excerpt: string | null
          status: string
          statute_version_id: string
          tenant_id: string
        }
        Insert: {
          clause_ref: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          matter_code: string
          requirement_key: string
          requirement_value?: Json
          source_excerpt?: string | null
          status?: string
          statute_version_id: string
          tenant_id: string
        }
        Update: {
          clause_ref?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          matter_code?: string
          requirement_key?: string
          requirement_value?: Json
          source_excerpt?: string | null
          status?: string
          statute_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_statute_clause_mappings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_statute_clause_mappings_statute_version_id_fkey"
            columns: ["statute_version_id"]
            isOneToOne: false
            referencedRelation: "secretaria_statute_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_statute_clause_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_statute_versions: {
        Row: {
          created_at: string
          created_by: string | null
          critical_mappings_complete: boolean
          document_hash: string | null
          document_uri: string | null
          entity_id: string
          id: string
          locked_at: string | null
          mapping_coverage: number
          published_at: string | null
          published_by: string | null
          status: string
          tenant_id: string
          version_label: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          critical_mappings_complete?: boolean
          document_hash?: string | null
          document_uri?: string | null
          entity_id: string
          id?: string
          locked_at?: string | null
          mapping_coverage?: number
          published_at?: string | null
          published_by?: string | null
          status?: string
          tenant_id: string
          version_label: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          critical_mappings_complete?: boolean
          document_hash?: string | null
          document_uri?: string | null
          entity_id?: string
          id?: string
          locked_at?: string | null
          mapping_coverage?: number
          published_at?: string | null
          published_by?: string | null
          status?: string
          tenant_id?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_statute_versions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_statute_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      secretaria_template_transition_operations: {
        Row: {
          created_at: string
          created_by: string | null
          operation_id: string
          request_hash_sha256: string
          result: Json
          template_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          operation_id: string
          request_hash_sha256: string
          result: Json
          template_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          operation_id?: string
          request_hash_sha256?: string
          result?: Json
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "secretaria_template_transition_operations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plantillas_protegidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secretaria_template_transition_operations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          nominal_value: number | null
          restrictions: Json
          tenant_id: string
          total_titulos: number | null
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
          nominal_value?: number | null
          restrictions?: Json
          tenant_id: string
          total_titulos?: number | null
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
          nominal_value?: number | null
          restrictions?: Json
          tenant_id?: string
          total_titulos?: number | null
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
      societary_book_closures: {
        Row: {
          book_id: string
          closed_at: string
          closed_by: string | null
          entries_count: number
          first_ordinal: number | null
          id: string
          last_ordinal: number | null
          manifest_algorithm: string
          manifest_hash: string
          metadata: Json
          operation_id: string
          tenant_id: string
        }
        Insert: {
          book_id: string
          closed_at: string
          closed_by?: string | null
          entries_count: number
          first_ordinal?: number | null
          id?: string
          last_ordinal?: number | null
          manifest_algorithm?: string
          manifest_hash: string
          metadata?: Json
          operation_id?: string
          tenant_id: string
        }
        Update: {
          book_id?: string
          closed_at?: string
          closed_by?: string | null
          entries_count?: number
          first_ordinal?: number | null
          id?: string
          last_ordinal?: number | null
          manifest_algorithm?: string
          manifest_hash?: string
          metadata?: Json
          operation_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societary_book_closures_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "mandatory_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_closures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      societary_book_entries: {
        Row: {
          book_id: string
          entry_type: string
          id: string
          metadata: Json
          occurred_at: string
          operation_id: string
          ordinal_number: number
          recorded_at: string
          recorded_by: string | null
          section_id: string
          source_domain: string
          source_hash: string
          source_id: string
          tenant_id: string
        }
        Insert: {
          book_id: string
          entry_type: string
          id?: string
          metadata?: Json
          occurred_at: string
          operation_id?: string
          ordinal_number: number
          recorded_at?: string
          recorded_by?: string | null
          section_id: string
          source_domain: string
          source_hash: string
          source_id: string
          tenant_id: string
        }
        Update: {
          book_id?: string
          entry_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          operation_id?: string
          ordinal_number?: number
          recorded_at?: string
          recorded_by?: string | null
          section_id?: string
          source_domain?: string
          source_hash?: string
          source_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societary_book_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "mandatory_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_entries_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "societary_book_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      societary_book_routing_incidents: {
        Row: {
          body_id: string
          candidate_fingerprint: string
          candidate_section_ids: string[]
          context: Json
          entity_id: string
          id: string
          incident_type: string
          minute_id: string
          occurred_at: string
          period: number
          recorded_by: string | null
          tenant_id: string
        }
        Insert: {
          body_id: string
          candidate_fingerprint: string
          candidate_section_ids?: string[]
          context?: Json
          entity_id: string
          id?: string
          incident_type: string
          minute_id: string
          occurred_at?: string
          period: number
          recorded_by?: string | null
          tenant_id: string
        }
        Update: {
          body_id?: string
          candidate_fingerprint?: string
          candidate_section_ids?: string[]
          context?: Json
          entity_id?: string
          id?: string
          incident_type?: string
          minute_id?: string
          occurred_at?: string
          period?: number
          recorded_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societary_book_routing_incidents_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_routing_incidents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_routing_incidents_minute_id_fkey"
            columns: ["minute_id"]
            isOneToOne: false
            referencedRelation: "minutes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_routing_incidents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      societary_book_sections: {
        Row: {
          body_id: string | null
          book_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          routing_status: string
          section_code: string
          section_kind: string
          section_label: string
          tenant_id: string
        }
        Insert: {
          body_id?: string | null
          book_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          routing_status?: string
          section_code: string
          section_kind?: string
          section_label: string
          tenant_id: string
        }
        Update: {
          body_id?: string | null
          book_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          routing_status?: string
          section_code?: string
          section_kind?: string
          section_label?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "societary_book_sections_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_sections_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "mandatory_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "societary_book_sections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      standalone_certification_kinds: {
        Row: {
          authority_policy: Json
          created_at: string
          disclaimer_policy: Json
          id: string
          is_active: boolean
          kind_code: string
          label: string
          legal_effect: string
          requires_qes: boolean
          requires_rm_reference: boolean
          requires_visto_bueno: boolean
          source_domain: string
          template_binding_key: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          authority_policy?: Json
          created_at?: string
          disclaimer_policy?: Json
          id?: string
          is_active?: boolean
          kind_code: string
          label: string
          legal_effect?: string
          requires_qes?: boolean
          requires_rm_reference?: boolean
          requires_visto_bueno?: boolean
          source_domain: string
          template_binding_key?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          authority_policy?: Json
          created_at?: string
          disclaimer_policy?: Json
          id?: string
          is_active?: boolean
          kind_code?: string
          label?: string
          legal_effect?: string
          requires_qes?: boolean
          requires_rm_reference?: boolean
          requires_visto_bueno?: boolean
          source_domain?: string
          template_binding_key?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      standalone_certifications: {
        Row: {
          artifact_id: string | null
          authority_evidence_id: string | null
          body_id: string | null
          capa3_payload: Json
          certificante_role: string
          created_at: string
          created_by: string | null
          cutoff_at: string
          emitted_at: string | null
          entity_id: string
          evidence_bundle_id: string | null
          id: string
          issued_to: string | null
          kind_code: string
          kind_id: string | null
          legal_effect: string
          requires_qes: boolean
          requires_visto_bueno: boolean
          revoked_reason: string | null
          signature_status: string
          source_domain: string
          source_hash: string
          source_id: string | null
          source_payload: Json
          source_summary: Json
          status: string
          superseded_by_id: string | null
          tenant_id: string
          updated_at: string
          visto_bueno_fecha: string | null
          visto_bueno_persona_id: string | null
        }
        Insert: {
          artifact_id?: string | null
          authority_evidence_id?: string | null
          body_id?: string | null
          capa3_payload?: Json
          certificante_role?: string
          created_at?: string
          created_by?: string | null
          cutoff_at?: string
          emitted_at?: string | null
          entity_id: string
          evidence_bundle_id?: string | null
          id?: string
          issued_to?: string | null
          kind_code: string
          kind_id?: string | null
          legal_effect?: string
          requires_qes?: boolean
          requires_visto_bueno?: boolean
          revoked_reason?: string | null
          signature_status?: string
          source_domain: string
          source_hash: string
          source_id?: string | null
          source_payload: Json
          source_summary?: Json
          status?: string
          superseded_by_id?: string | null
          tenant_id: string
          updated_at?: string
          visto_bueno_fecha?: string | null
          visto_bueno_persona_id?: string | null
        }
        Update: {
          artifact_id?: string | null
          authority_evidence_id?: string | null
          body_id?: string | null
          capa3_payload?: Json
          certificante_role?: string
          created_at?: string
          created_by?: string | null
          cutoff_at?: string
          emitted_at?: string | null
          entity_id?: string
          evidence_bundle_id?: string | null
          id?: string
          issued_to?: string | null
          kind_code?: string
          kind_id?: string | null
          legal_effect?: string
          requires_qes?: boolean
          requires_visto_bueno?: boolean
          revoked_reason?: string | null
          signature_status?: string
          source_domain?: string
          source_hash?: string
          source_id?: string | null
          source_payload?: Json
          source_summary?: Json
          status?: string
          superseded_by_id?: string | null
          tenant_id?: string
          updated_at?: string
          visto_bueno_fecha?: string | null
          visto_bueno_persona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standalone_certifications_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "secretaria_document_artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_authority_evidence_id_fkey"
            columns: ["authority_evidence_id"]
            isOneToOne: false
            referencedRelation: "authority_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "governing_bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "standalone_certifications_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_kind_id_fkey"
            columns: ["kind_id"]
            isOneToOne: false
            referencedRelation: "standalone_certification_kinds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "standalone_certifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standalone_certifications_visto_bueno_persona_id_fkey"
            columns: ["visto_bueno_persona_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_features: {
        Row: {
          intra_tenant_scope_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          intra_tenant_scope_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          intra_tenant_scope_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          branding: Json | null
          country_code: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_tenant_id: string | null
          tenant_type: string
        }
        Insert: {
          branding?: Json | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_tenant_id?: string | null
          tenant_type: string
        }
        Update: {
          branding?: Json | null
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
      user_profiles: {
        Row: {
          created_at: string | null
          entity_id: string | null
          id: string
          person_id: string | null
          role_code: string
          scope_body_ids: string[] | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          id?: string
          person_id?: string | null
          role_code?: string
          scope_body_ids?: string[] | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          id?: string
          person_id?: string | null
          role_code?: string
          scope_body_ids?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
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
      evidence_bundle_review_state_current: {
        Row: {
          actor_id: string | null
          agreement_id: string | null
          assignee_id: string | null
          content_hash_sha256: string | null
          created_at: string | null
          document_url: string | null
          event_type: string | null
          evidence_bundle_id: string | null
          id: string | null
          metadata: Json | null
          notes: string | null
          reason: string | null
          request_hash_sha256: string | null
          request_id: string | null
          review_state: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_bundle_review_events_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundle_review_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundle_review_events_evidence_bundle_id_fkey"
            columns: ["evidence_bundle_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_bundles_latest: {
        Row: {
          agreement_id: string | null
          chain_of_custody: Json | null
          created_at: string | null
          document_url: string | null
          hash_sha512: string | null
          id: string | null
          legal_hold: boolean | null
          manifest: Json | null
          manifest_hash: string | null
          qseal_token: string | null
          reference_code: string | null
          signature_date: string | null
          signed_by: string | null
          source_module: string | null
          source_object_id: string | null
          source_object_type: string | null
          status: string | null
          storage_path: string | null
          supersedes_id: string | null
          tenant_id: string | null
          tsq_token: string | null
        }
        Insert: {
          agreement_id?: string | null
          chain_of_custody?: Json | null
          created_at?: string | null
          document_url?: string | null
          hash_sha512?: string | null
          id?: string | null
          legal_hold?: boolean | null
          manifest?: Json | null
          manifest_hash?: string | null
          qseal_token?: string | null
          reference_code?: string | null
          signature_date?: string | null
          signed_by?: string | null
          source_module?: string | null
          source_object_id?: string | null
          source_object_type?: string | null
          status?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          tenant_id?: string | null
          tsq_token?: string | null
        }
        Update: {
          agreement_id?: string | null
          chain_of_custody?: Json | null
          created_at?: string | null
          document_url?: string | null
          hash_sha512?: string | null
          id?: string | null
          legal_hold?: boolean | null
          manifest?: Json | null
          manifest_hash?: string | null
          qseal_token?: string | null
          reference_code?: string | null
          signature_date?: string | null
          signed_by?: string | null
          source_module?: string | null
          source_object_id?: string | null
          source_object_type?: string | null
          status?: string | null
          storage_path?: string | null
          supersedes_id?: string | null
          tenant_id?: string | null
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
          {
            foreignKeyName: "evidence_bundles_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_bundles_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "evidence_bundles_latest"
            referencedColumns: ["id"]
          },
        ]
      }
      mandates: {
        Row: {
          body_id: string | null
          capital_participacion: number | null
          clase_accion: string | null
          created_at: string | null
          end_date: string | null
          entity_id: string | null
          id: string | null
          person_id: string | null
          porcentaje_capital: number | null
          role: string | null
          start_date: string | null
          status: string | null
          tenant_id: string | null
          tiene_derecho_voto: boolean | null
          type: string | null
        }
        Insert: {
          body_id?: string | null
          capital_participacion?: never
          clase_accion?: never
          created_at?: string | null
          end_date?: string | null
          entity_id?: string | null
          id?: string | null
          person_id?: string | null
          porcentaje_capital?: never
          role?: string | null
          start_date?: string | null
          status?: never
          tenant_id?: string | null
          tiene_derecho_voto?: never
          type?: never
        }
        Update: {
          body_id?: string | null
          capital_participacion?: never
          clase_accion?: never
          created_at?: string | null
          end_date?: string | null
          entity_id?: string | null
          id?: string | null
          person_id?: string | null
          porcentaje_capital?: never
          role?: string | null
          start_date?: string | null
          status?: never
          tenant_id?: string | null
          tiene_derecho_voto?: never
          type?: never
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
        ]
      }
      sii_actions_view: {
        Row: {
          action: string | null
          action_date: string | null
          actor: string | null
          case_id: string | null
          id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "sii_cases_view"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "evidences_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "sii_cases_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_acta_book_kind_for_body: {
        Args: { p_body_name: string; p_body_type: string }
        Returns: string
      }
      fn_actualizar_borrador_acta: {
        Args: { p_content: string; p_minute_id: string }
        Returns: Json
      }
      fn_actualizar_borrador_certificacion: {
        Args: { p_certification_id: string; p_content: string }
        Returns: Json
      }
      fn_agenda_draft_transicion: {
        Args: {
          p_action: string
          p_convocatoria_id?: string
          p_draft_id: string
        }
        Returns: Json
      }
      fn_aims_close_technical_file: {
        Args: {
          p_qseal_token?: string
          p_signed_by?: string
          p_tsq_token?: string
          p_version_id: string
        }
        Returns: Json
      }
      fn_aprobar_acta: {
        Args: {
          p_minute_id: string
          p_president_persona_id?: string
          p_secretary_persona_id?: string
        }
        Returns: Json
      }
      fn_aprobar_acta_autoritativa: {
        Args: {
          p_approval_effective_at: string
          p_approval_method: string
          p_final_legal_artifact_id: string
          p_minute_id: string
          p_president_consent_verification_id: string
          p_secretary_consent_verification_id: string
        }
        Returns: Json
      }
      fn_assert_current_tenant_id: { Args: never; Returns: string }
      fn_calcular_plazo_comunicacion: {
        Args: {
          p_entity_id: string
          p_meeting_date: string
          p_organo_tipo: string
          p_template_id: string
          p_tipo_comunicacion: string
        }
        Returns: Json
      }
      fn_cancel_communication: {
        Args: { p_communication_id: string }
        Returns: string
      }
      fn_cargo_vigente: {
        Args: {
          p_body_id: string
          p_cargos: string[]
          p_entity_id: string
          p_person_id: string
        }
        Returns: boolean
      }
      fn_cerrar_votaciones_vencidas: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      fn_cesar_cargo: {
        Args: {
          p_condicion_id: string
          p_fecha_fin: string
          p_idempotency_key?: string
          p_razon?: string
          p_tenant_id: string
        }
        Returns: string
      }
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
      fn_claim_recipients_for_dispatch: {
        Args: { p_limit?: number; p_tenant_id?: string }
        Returns: {
          acuse_evidence_hash: string | null
          acuse_evidence_id: string | null
          canal_fallback: string | null
          canal_original: string
          canal_primario: string
          canal_usado: string | null
          cargo_en_organo: string | null
          communication_id: string
          created_at: string
          delegacion_a_person_id: string | null
          delivery_alternative: Json | null
          destino_fallback: string | null
          destino_primario: string
          dispatch_attempt_id: string | null
          dispatch_lease_expires_at: string | null
          estado_entrega: string
          fecha_entrega: string | null
          fecha_envio: string | null
          fecha_lectura: string | null
          fecha_respuesta: string | null
          id: string
          intento_reenvio_n: number
          person_id: string
          provider_idempotency_key: string | null
          respuesta_firma_qes_id: string | null
          respuesta_payload: Json | null
          respuesta_tipo: string | null
          ultimo_error: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "communication_recipients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fn_close_representacion_puntual: {
        Args: {
          p_effective_to?: string
          p_idempotency_key?: string
          p_reason?: string
          p_representacion_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_communication_assert_authoritative_binding: {
        Args: { p_communication_id: string }
        Returns: undefined
      }
      fn_communication_authoritative_binding_valid: {
        Args: { p_communication_id: string }
        Returns: boolean
      }
      fn_communication_authoritative_binding_valid_201320: {
        Args: { p_communication_id: string }
        Returns: boolean
      }
      fn_communication_base_binding_without_recipient_directory: {
        Args: { p_communication_id: string }
        Returns: boolean
      }
      fn_communication_census_binding_valid: {
        Args: { p_communication_id: string }
        Returns: boolean
      }
      fn_communication_compute_package_hash: {
        Args: { p_communication_id: string }
        Returns: string
      }
      fn_communication_prepare_census: {
        Args: { p_communication_id: string }
        Returns: string
      }
      fn_consolidate_person: {
        Args: {
          p_canonical_person_id: string
          p_duplicate_person_id: string
          p_idempotency_key?: string
          p_reason?: string
          p_tenant_id: string
        }
        Returns: Json
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
      fn_crear_sociedad_legal_y_capital: {
        Args: { p_payload: Json; p_tenant_id: string }
        Returns: Json
      }
      fn_create_communication_atomic: {
        Args: { p_attachments: Json; p_comm: Json; p_recipients: Json }
        Returns: string
      }
      fn_create_ead_interposition_draft: {
        Args: { p_comm: Json; p_recipients: Json }
        Returns: string
      }
      fn_create_governance_evidence_bundle: {
        Args: {
          p_document_url?: string
          p_legal_hold?: boolean
          p_manifest: Json
          p_reference_code: string
          p_signed_by?: string
          p_source_module: string
          p_source_object_id: string
          p_source_object_type: string
          p_status?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_create_no_session_resolution: {
        Args: {
          p_agreement_kind: string
          p_body_id: string
          p_matter_class: string
          p_open_idempotency_key: string
          p_proposal_text: string
          p_requires_unanimity: boolean
          p_title: string
          p_voting_deadline: string
        }
        Returns: string
      }
      fn_create_persona_completa: {
        Args: {
          p_idempotency_key?: string
          p_payload: Json
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_create_standalone_certification: {
        Args: {
          p_capa3?: Json
          p_cutoff_at?: string
          p_issued_to?: string
          p_kind: string
          p_source_input?: Json
        }
        Returns: string
      }
      fn_current_tenant_id: { Args: never; Returns: string }
      fn_derive_comunicacion_config: {
        Args: { p_materia: string }
        Returns: Json
      }
      fn_designar_cargo: {
        Args: {
          p_body_id: string
          p_cesar_singleton_previo?: boolean
          p_entity_id: string
          p_fecha_inicio: string
          p_fuente_designacion: string
          p_idempotency_key?: string
          p_inscripcion_rm_fecha?: string
          p_inscripcion_rm_referencia?: string
          p_person_id: string
          p_representative_person_id?: string
          p_tenant_id: string
          p_tipo_condicion: string
        }
        Returns: string
      }
      fn_emit_convocatoria: { Args: { p_payload: Json }; Returns: Json }
      fn_emit_standalone_certification: {
        Args: { p_artifact_id?: string; p_certification_id: string }
        Returns: string
      }
      fn_emitir_certificacion: {
        Args: { p_certification_id: string }
        Returns: string
      }
      fn_evidence_bundle_chain: {
        Args: { p_bundle_id: string }
        Returns: {
          bundle_id: string
          created_at: string
          generation: number
          manifest_hash: string
          supersedes_id: string
        }[]
      }
      fn_firmar_certificacion: {
        Args: {
          p_certification_id: string
          p_qtsp_token: string
          p_tsq_token: string
        }
        Returns: undefined
      }
      fn_firmar_certificacion_autoritativa: {
        Args: {
          p_certification_id: string
          p_certifier_qtsp_verification_id: string
          p_final_legal_artifact_id: string
          p_visto_bueno_qtsp_verification_id?: string
        }
        Returns: Json
      }
      fn_generar_acta:
        | {
            Args: {
              p_content: string
              p_meeting_id: string
              p_snapshot_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_canonical_minutes_hash?: string
              p_content: string
              p_meeting_id: string
              p_snapshot_id: string
            }
            Returns: string
          }
      fn_generar_certificacion: {
        Args: {
          p_agreements_certified: string[]
          p_certificante_role: string
          p_minute_id: string
          p_tipo: string
          p_visto_bueno_persona_id: string
        }
        Returns: string
      }
      fn_generar_certificacion_acuerdo_sin_sesion: {
        Args: {
          p_agreement_id: string
          p_certificante_role?: string
          p_tipo?: string
          p_visto_bueno_persona_id?: string
        }
        Returns: string
      }
      fn_get_convocation_manifest_canonical_source: {
        Args: { p_convocatoria_id: string }
        Returns: {
          manifest_canonical_json: string
          manifest_hash_sha512: string
        }[]
      }
      fn_import_persona_row: {
        Args: {
          p_denomination?: string
          p_email?: string
          p_full_name: string
          p_idempotency_key?: string
          p_person_type: string
          p_tax_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_intra_tenant_scope_enabled: { Args: never; Returns: boolean }
      fn_libro_cerrar_volumen: { Args: { p_libro_id: string }; Returns: Json }
      fn_libro_legalizacion_transicion: {
        Args: { p_action: string; p_evidence_url?: string; p_libro_id: string }
        Returns: Json
      }
      fn_majority_level: { Args: { p_code: string }; Returns: number }
      fn_matter_document_tenant: { Args: { p_name: string }; Returns: string }
      fn_no_session_cast_response: {
        Args: {
          p_firma_qes_ref?: string
          p_notificacion_certificada_ref?: string
          p_person_id: string
          p_resolution_id: string
          p_sentido: string
          p_tenant_id: string
          p_texto_respuesta?: string
        }
        Returns: Json
      }
      fn_no_session_close_and_materialize_agreement: {
        Args: {
          p_resolution_id: string
          p_resultado?: string
          p_selected_template_id?: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_precommit_convocation_final_candidate: {
        Args: {
          p_binary_hash_sha256: string
          p_binary_hash_sha512: string
          p_convocatoria_id: string
          p_file_name: string
          p_mime_type: string
          p_review_context: Json
          p_source_hash_sha256: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_prepare_standalone_certification_source: {
        Args: { p_kind: string; p_source_input?: Json }
        Returns: Json
      }
      fn_program_communication: {
        Args: { p_communication_id: string }
        Returns: string
      }
      fn_promover_sociedad_operativa: {
        Args: { p_entity_id: string; p_tenant_id: string }
        Returns: Json
      }
      fn_recipient_handle_error: {
        Args: {
          p_error_message: string
          p_recipient_id: string
          p_retriable: boolean
        }
        Returns: undefined
      }
      fn_recipient_handle_error_attempt: {
        Args: {
          p_dispatch_attempt_id: string
          p_error_message: string
          p_recipient_id: string
          p_retriable: boolean
        }
        Returns: boolean
      }
      fn_recipient_mark_ead_notice_result: {
        Args: {
          p_delivered_at: string
          p_earchive_archived_at: string
          p_earchive_evidence_id: string
          p_earchive_hash_sha512: string
          p_earchive_status: string
          p_provider_event_id: string
          p_provider_request_id: string
          p_provider_status: string
          p_recipient_id: string
          p_requested_at: string
        }
        Returns: Json
      }
      fn_recipient_mark_ead_notice_result_attempt: {
        Args: {
          p_delivered_at: string
          p_dispatch_attempt_id: string
          p_earchive_archived_at: string
          p_earchive_evidence_id: string
          p_earchive_hash_sha512: string
          p_earchive_status: string
          p_idempotency_key: string
          p_provider_event_id: string
          p_provider_request_id: string
          p_provider_status: string
          p_recipient_id: string
          p_requested_at: string
        }
        Returns: Json
      }
      fn_recipient_mark_reconciliation_required: {
        Args: {
          p_dispatch_attempt_id: string
          p_provider: string
          p_provider_event_id: string
          p_reason: string
          p_recipient_id: string
        }
        Returns: boolean
      }
      fn_recipient_mark_sent: {
        Args: {
          p_canal_usado: string
          p_evidence_hash: string
          p_proveedor: string
          p_proveedor_evento_id: string
          p_recipient_id: string
        }
        Returns: undefined
      }
      fn_recipient_mark_sent_attempt: {
        Args: {
          p_canal_usado: string
          p_dispatch_attempt_id: string
          p_evidence_hash: string
          p_idempotency_key: string
          p_proveedor: string
          p_proveedor_evento_id: string
          p_recipient_id: string
        }
        Returns: boolean
      }
      fn_recipient_record_ead_notice_callback: {
        Args: {
          p_delivered_at: string
          p_earchive_archived_at: string
          p_earchive_evidence_id: string
          p_earchive_hash_sha512: string
          p_earchive_status: string
          p_event_status: string
          p_occurred_at: string
          p_provider_event_id: string
          p_provider_payload: Json
          p_provider_request_id: string
        }
        Returns: Json
      }
      fn_recipient_record_resend_callback: {
        Args: {
          p_event_status: string
          p_occurred_at: string
          p_provider_event_id: string
          p_provider_message_id: string
          p_provider_payload: Json
        }
        Returns: Json
      }
      fn_refresh_agreement_document_requirements: {
        Args: { p_agreement_id: string }
        Returns: number
      }
      fn_refresh_parte_votante_body: {
        Args: { p_body_id: string }
        Returns: undefined
      }
      fn_refresh_parte_votante_entity: {
        Args: { p_entity_id: string }
        Returns: undefined
      }
      fn_register_convocatoria_final_attachment: {
        Args: {
          p_convocatoria_id: string
          p_file_name: string
          p_file_url: string
          p_hash_sha256: string
          p_hash_sha512: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_register_server_rendered_convocation_attachment: {
        Args: {
          p_convocatoria_id: string
          p_file_name: string
          p_hash_sha256: string
          p_hash_sha512: string
          p_manifest_hash_sha512: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_uri: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_register_verified_convocation_attachment: {
        Args: {
          p_agenda_item_index: number
          p_artifact_kind: string
          p_candidate_id?: string
          p_convocatoria_id: string
          p_file_name: string
          p_hash_sha256: string
          p_hash_sha512: string
          p_mime_type: string
          p_size_bytes: number
          p_storage_etag?: string
          p_storage_uri: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_registrar_inscripcion_rm_cargo: {
        Args: {
          p_condicion_id: string
          p_idempotency_key?: string
          p_inscripcion_rm_fecha: string
          p_inscripcion_rm_referencia: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_registrar_movimiento_capital: {
        Args: {
          p_agreement_id: string
          p_delta_denominator_weight: number
          p_delta_shares: number
          p_delta_voting_weight: number
          p_effective_date: string
          p_entity_id: string
          p_movement_type: string
          p_notas?: string
          p_person_id: string
          p_share_class_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_registrar_transmision_capital: {
        Args: {
          p_agreement_id?: string
          p_destination_person_id: string
          p_effective_date: string
          p_notas?: string
          p_source_holding_id: string
          p_support_doc_ref?: string
          p_tenant_id: string
          p_titles_to_transfer: number
        }
        Returns: Json
      }
      fn_registry_assert_artifact: {
        Args: {
          p_allow_demo?: boolean
          p_artifact_id: string
          p_entity_id: string
          p_require_verified?: boolean
          p_tenant_id: string
        }
        Returns: undefined
      }
      fn_registry_assert_writer: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      fn_registry_certification_artifact_matches: {
        Args: {
          p_artifact_id: string
          p_certification_id: string
          p_entity_id: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      fn_registry_certification_covers_agreement: {
        Args: {
          p_agreement_id: string
          p_certification_id: string
          p_tenant_id: string
        }
        Returns: boolean
      }
      fn_registry_emit_event: {
        Args: {
          p_effective_at: string
          p_event_type: string
          p_evidence_artifact_id: string
          p_filing_id: string
          p_from_status: string
          p_operation_id: string
          p_payload?: Json
          p_request_fingerprint: string
          p_sequence_no: number
          p_tenant_id: string
          p_to_status: string
        }
        Returns: string
      }
      fn_registry_existing_operation: {
        Args: {
          p_expected_event_type: string
          p_expected_filing_id: string
          p_expected_request_fingerprint: string
          p_operation_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_registry_prepare_filing: {
        Args: {
          p_agreement_id?: string
          p_base_document_artifact_id: string
          p_base_document_kind: string
          p_deed_date?: string
          p_entity_id: string
          p_filing_id?: string
          p_filing_via: string
          p_notary_name?: string
          p_operation_id: string
          p_procedure_profile_code?: string
          p_procedure_snapshot?: Json
          p_protocol_number?: string
          p_rule_pack_version_id?: string
          p_source_domain: string
          p_source_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_registry_record_inscription: {
        Args: {
          p_evidence_artifact_id: string
          p_filing_id: string
          p_inscription_number: string
          p_operation_id: string
          p_registered_at: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_registry_record_presentation: {
        Args: {
          p_effective_at?: string
          p_evidence_artifact_id: string
          p_filing_id: string
          p_filing_number: string
          p_filing_via: string
          p_operation_id: string
          p_presentation_date: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_registry_record_publication: {
        Args: {
          p_evidence_artifact_id: string
          p_filing_id: string
          p_operation_id: string
          p_publication_reference: string
          p_published_at: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_registry_record_qualification: {
        Args: {
          p_defect_description?: string
          p_effective_at: string
          p_evidence_artifact_id: string
          p_filing_id: string
          p_operation_id: string
          p_outcome: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_registry_request_fingerprint: {
        Args: { p_request: Json }
        Returns: string
      }
      fn_registry_submit_remedy: {
        Args: {
          p_effective_at?: string
          p_evidence_artifact_id: string
          p_filing_id: string
          p_operation_id: string
          p_remedy_description: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_retry_communication_recipient: {
        Args: { p_recipient_id: string }
        Returns: string
      }
      fn_revalidate_recipient_dispatch: {
        Args: {
          p_body_hash_sha512: string
          p_expected_tenant_id: string
          p_recipient_id: string
          p_verified_attachments: Json
        }
        Returns: boolean
      }
      fn_revalidate_recipient_dispatch_attempt: {
        Args: {
          p_body_hash_sha512: string
          p_dispatch_attempt_id: string
          p_expected_tenant_id: string
          p_package_hash_sha512: string
          p_package_revision: number
          p_recipient_id: string
          p_verified_attachments: Json
        }
        Returns: boolean
      }
      fn_save_meeting_resolutions: {
        Args: { p_meeting_id: string; p_rows: Json; p_tenant_id: string }
        Returns: Json
      }
      fn_scan_vacancias_presidencia: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      fn_secretaria_annual_accounts_evidence_binary: {
        Args: { p_manifest: Json }
        Returns: Json
      }
      fn_secretaria_assert_active_template_admin: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_actor_person: {
        Args: { p_person_id: string; p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_caller_authority_rm: {
        Args: { p_body_id?: string; p_entity_id?: string; p_tenant_id: string }
        Returns: string
      }
      fn_secretaria_assert_capability: {
        Args: { p_action: string; p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_communication_operator: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_person_tenant: {
        Args: { p_person_id: string; p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_role_allowed: {
        Args: { p_allowed_roles: string[]; p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_template_tenant: {
        Args: { p_template_id: string; p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assert_tenant_access: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      fn_secretaria_assign_template_binding: {
        Args: { p_payload: Json }
        Returns: string
      }
      fn_secretaria_backfill_normative_framework: {
        Args: { p_apply?: boolean; p_tenant_id?: string }
        Returns: Json
      }
      fn_secretaria_bound_convocation_id_for_meeting: {
        Args: { p_meeting_id: string; p_quorum_data: Json; p_tenant_id: string }
        Returns: string
      }
      fn_secretaria_build_certification_manifest: {
        Args: {
          p_agreement_ids: string[]
          p_authority_evidence_id: string
          p_minute_id: string
          p_prepared_at: string
          p_tipo: string
          p_visto_bueno_persona_id: string
        }
        Returns: Json
      }
      fn_secretaria_build_minute_legal_manifest: {
        Args: {
          p_content_hash_sha256: string
          p_meeting_id: string
          p_snapshot_id: string
        }
        Returns: Json
      }
      fn_secretaria_can_write_document_artifacts: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      fn_secretaria_canonical_attendance_type: {
        Args: { p_attendance_type: string }
        Returns: string
      }
      fn_secretaria_canonical_jsonb_hash: {
        Args: { p_payload: Json }
        Returns: string
      }
      fn_secretaria_certified_agreements_manifest: {
        Args: { p_agreement_ids: string[]; p_minute_id: string }
        Returns: Json
      }
      fn_secretaria_close_book_volume: {
        Args: { p_book_id: string; p_operation_id?: string }
        Returns: Json
      }
      fn_secretaria_close_meeting_and_generate_minute: {
        Args: {
          p_canonical_minutes_hash?: string
          p_content?: string
          p_meeting_id: string
        }
        Returns: string
      }
      fn_secretaria_configure_minute_book_section: {
        Args: {
          p_body_id: string
          p_book_id: string
          p_section_code: string
          p_section_label: string
        }
        Returns: Json
      }
      fn_secretaria_convocation_agenda_item_canonical: {
        Args: { p_item: Json; p_order_number: number }
        Returns: Json
      }
      fn_secretaria_create_or_reuse_meeting_from_convocation: {
        Args: { p_convocatoria_id: string }
        Returns: Json
      }
      fn_secretaria_current_person_id: { Args: never; Returns: string }
      fn_secretaria_current_role_code: { Args: never; Returns: string }
      fn_secretaria_current_tenant_id: { Args: never; Returns: string }
      fn_secretaria_document_annex_manifest: {
        Args: {
          p_certification_bundle_only?: boolean
          p_linked_domain: string
          p_linked_id: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_secretaria_document_annex_manifest_hash: {
        Args: {
          p_certification_bundle_only?: boolean
          p_linked_domain: string
          p_linked_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_secretaria_fix_annual_accounts_set: {
        Args: {
          p_agenda_item_id: string
          p_cash_flow_statement_applicable: boolean
          p_components: Json
          p_fiscal_year: number
          p_is_consolidated: boolean
          p_management_report_applicable: boolean
          p_meeting_id: string
          p_supersedes_set_id?: string
        }
        Returns: Json
      }
      fn_secretaria_freeze_annual_accounts_signer_roster: {
        Args: { p_annual_accounts_set_id: string; p_snapshot_id: string }
        Returns: Json
      }
      fn_secretaria_has_active_role: {
        Args: { p_allowed_roles: string[]; p_tenant_id: string }
        Returns: boolean
      }
      fn_secretaria_is_active_template_admin: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      fn_secretaria_is_eligible_board_member: {
        Args: { p_body_id: string; p_person_id: string }
        Returns: boolean
      }
      fn_secretaria_is_eligible_board_member_at: {
        Args: {
          p_body_id: string
          p_effective_date: string
          p_person_id: string
        }
        Returns: boolean
      }
      fn_secretaria_is_service_role: { Args: never; Returns: boolean }
      fn_secretaria_jsonb_has_forbidden_signature_claim: {
        Args: { p_value: Json }
        Returns: boolean
      }
      fn_secretaria_jsonb_hash_sha256: {
        Args: { p_value: Json }
        Returns: string
      }
      fn_secretaria_materialize_convocation_agenda: {
        Args: { p_convocatoria_id: string; p_meeting_id: string }
        Returns: Json
      }
      fn_secretaria_materialize_effective_rule_matrix: {
        Args: { p_entity_id?: string; p_tenant_id?: string }
        Returns: Json
      }
      fn_secretaria_normalize_metadata_code: {
        Args: { p_value: string }
        Returns: string
      }
      fn_secretaria_open_meeting: {
        Args: { p_meeting_id: string }
        Returns: Json
      }
      fn_secretaria_publish_normative_override: {
        Args: { p_payload: Json }
        Returns: string
      }
      fn_secretaria_publish_statute_version: {
        Args: { p_payload: Json }
        Returns: string
      }
      fn_secretaria_reconcile_annual_accounts_ead_bundle: {
        Args: {
          p_annual_accounts_set_id: string
          p_certificate_fingerprint_sha256: string
          p_completion_certificate_ref: string
          p_completion_package_fingerprint_sha256: string
          p_completion_package_ref: string
          p_provider_payload?: Json
          p_provider_signature_type: string
          p_signature_packaging: string
          p_signature_request_id: string
          p_signed_at: string
          p_signed_output_hash_sha256: string
          p_signed_output_hash_sha512: string
          p_storage_object_id: string
          p_storage_path: string
          p_storage_version: string
        }
        Returns: Json
      }
      fn_secretaria_reconcile_verified_ead_bundle: {
        Args: {
          p_certificate_fingerprint_sha256?: string
          p_completion_certificate_ref: string
          p_completion_package_ref: string
          p_content_hash_sha256: string
          p_provider_payload?: Json
          p_provider_signature_type: string
          p_signature_request_id: string
          p_signed_at: string
          p_signed_output_hash_sha256: string
          p_signed_output_hash_sha512: string
          p_source_domain: string
          p_source_id: string
          p_storage_path: string
        }
        Returns: string
      }
      fn_secretaria_record_annual_accounts_external_signature: {
        Args: {
          p_expected_signer_id: string
          p_finalizer_user_id: string
          p_interposition_evidence_id: string
          p_review_event_id: string
          p_signature_fact_source: string
          p_signed_at: string
          p_supersedes_outcome_id?: string
        }
        Returns: Json
      }
      fn_secretaria_record_annual_accounts_missing_signature_cause: {
        Args: {
          p_cause_code: string
          p_cause_text: string
          p_expected_signer_id: string
          p_supersedes_outcome_id?: string
        }
        Returns: Json
      }
      fn_secretaria_record_annual_accounts_signer_outcome: {
        Args: {
          p_expected_signer_id: string
          p_missing_signature_cause_code?: string
          p_missing_signature_cause_text?: string
          p_outcome_type: string
          p_provider_evidence_bundle_id?: string
          p_signature_request_id?: string
          p_supersedes_outcome_id?: string
        }
        Returns: Json
      }
      fn_secretaria_record_normative_event: {
        Args: { p_event: Json }
        Returns: string
      }
      fn_secretaria_register_annual_accounts_ead_execution: {
        Args: {
          p_annual_accounts_set_id: string
          p_archived_at: string
          p_binary_hash_sha256: string
          p_binary_hash_sha512: string
          p_evidence_bundle_id: string
          p_provider_payload?: Json
          p_storage_object_id: string
          p_storage_path: string
          p_storage_version: string
        }
        Returns: Json
      }
      fn_secretaria_register_annual_accounts_execution_artifact: {
        Args: {
          p_annual_accounts_set_id: string
          p_binary_hash_sha256: string
          p_binary_hash_sha512: string
          p_evidence_bundle_id: string
          p_storage_path: string
        }
        Returns: Json
      }
      fn_secretaria_register_custodied_legal_artifact: {
        Args: {
          p_artifact_kind: string
          p_binary_hash_sha256: string
          p_content_hash_sha256: string
          p_evidence_bundle_id: string
          p_source_domain: string
          p_source_id: string
        }
        Returns: string
      }
      fn_secretaria_register_ead_interposition_evidence: {
        Args: {
          p_evidence_bundle_id: string
          p_evidence_purpose: string
          p_legal_artifact_id: string
          p_occurred_at: string
          p_provider_event_id?: string
          p_provider_payload: Json
          p_provider_reference: string
          p_provider_request_id?: string
          p_provider_status: string
          p_signature_request_id?: string
          p_source_domain: string
          p_source_id: string
          p_subject_person_id: string
          p_subject_role: string
          p_verified_by?: string
        }
        Returns: string
      }
      fn_secretaria_register_final_legal_artifact: {
        Args: {
          p_artifact_kind: string
          p_binary_hash_sha256: string
          p_content_hash_sha256: string
          p_evidence_bundle_id: string
          p_source_domain: string
          p_source_id: string
        }
        Returns: string
      }
      fn_secretaria_register_minute_book_entry: {
        Args: { p_minute_id: string; p_operation_id?: string }
        Returns: Json
      }
      fn_secretaria_register_unsigned_input_custody: {
        Args: {
          p_agreement_id: string
          p_binary_hash_sha512: string
          p_document_url: string
          p_manifest: Json
          p_storage_path: string
          p_tenant_id: string
        }
        Returns: Json
      }
      fn_secretaria_register_verified_qtsp_signature: {
        Args: {
          p_certificate_fingerprint_sha256: string
          p_legal_artifact_id: string
          p_signature_request_id: string
          p_signer_person_id: string
          p_signer_role: string
          p_verification_payload: Json
        }
        Returns: string
      }
      fn_secretaria_render_authoritative_certification: {
        Args: { p_manifest: Json }
        Returns: string
      }
      fn_secretaria_render_authoritative_minute: {
        Args: { p_manifest: Json }
        Returns: string
      }
      fn_secretaria_reserve_ead_provider_action: {
        Args: {
          p_action_kind: string
          p_payload_hash_sha256: string
          p_reservation_context?: Json
          p_source_domain: string
          p_source_hash_sha256: string
          p_source_id: string
          p_subject_key: string
        }
        Returns: string
      }
      fn_secretaria_resolve_minute_book_destination: {
        Args: { p_minute_id: string }
        Returns: Json
      }
      fn_secretaria_review_annual_accounts_external_signature: {
        Args: {
          p_document_hash_sha256: string
          p_expected_signer_id: string
          p_review_note: string
          p_signature_fact_source: string
          p_signed_at: string
        }
        Returns: Json
      }
      fn_secretaria_save_document_draft: {
        Args: { p_payload: Json }
        Returns: Json
      }
      fn_secretaria_server_resolution_evaluation: {
        Args: {
          p_meeting_id: string
          p_resolution_id: string
          p_snapshot_id: string
        }
        Returns: Json
      }
      fn_secretaria_template_activation_metadata_ok: {
        Args: {
          p_adoption_mode: string
          p_organo_tipo: string
          p_referencia_legal: string
          p_tipo: string
        }
        Returns: string
      }
      fn_secretaria_template_functional_key: {
        Args: {
          p_adoption_mode: string
          p_jurisdiccion: string
          p_materia: string
          p_organo_tipo: string
          p_tipo: string
          p_tipo_social: string
        }
        Returns: string
      }
      fn_secretaria_transition_document_draft: {
        Args: {
          p_draft_id: string
          p_expected_state: string
          p_reason?: string
          p_to_state: string
        }
        Returns: Json
      }
      fn_secretaria_transition_template_state: {
        Args: {
          p_ack_warnings?: boolean
          p_aprobada_por?: string
          p_expected_from: string
          p_expected_predecessor_id?: string
          p_fecha_aprobacion?: string
          p_motivo: string
          p_operation_id: string
          p_template_id: string
          p_to_state: string
        }
        Returns: Json
      }
      fn_secretaria_upsert_organ_profile: {
        Args: { p_payload: Json }
        Returns: string
      }
      fn_secretaria_upsert_organ_rule: {
        Args: { p_payload: Json }
        Returns: string
      }
      fn_secretaria_validate_annual_accounts_execution: {
        Args: { p_annual_accounts_set_id: string }
        Returns: Json
      }
      fn_secretaria_validate_annual_accounts_point: {
        Args: { p_agenda_item_id: string; p_meeting_id: string }
        Returns: Json
      }
      fn_secretaria_validate_document_draft_body: {
        Args: { p_document_type: string; p_rendered_body_text: string }
        Returns: Json
      }
      fn_seed_mandatory_books: {
        Args: { p_entity_id: string }
        Returns: undefined
      }
      fn_shareholder_representation_candidates: {
        Args: { p_as_of_date: string; p_shareholder_entity_id: string }
        Returns: {
          authority_route: string
          delegation_id: string
          evidence_status: string
          legal_effect: string
          representative_name: string
          representative_person_id: string
          source_reference: string
        }[]
      }
      fn_supersede_standalone_certification: {
        Args: { p_certification_id: string; p_reason: string }
        Returns: string
      }
      fn_transition_convocatoria_lifecycle: {
        Args: {
          p_convocatoria_id: string
          p_reason: string
          p_target_state: string
        }
        Returns: Json
      }
      fn_update_persona: {
        Args: {
          p_denomination?: string
          p_email?: string
          p_full_name: string
          p_idempotency_key?: string
          p_person_id: string
          p_tax_id?: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_upsert_mandatory_book_v2: {
        Args: {
          p_body_id: string
          p_book_group: string
          p_book_kind: string
          p_content_route: string
          p_custodian_role: string
          p_deadline: string
          p_entity_id: string
          p_legal_basis: string
          p_legalization_mode: string
          p_legalization_requirement: string
          p_maintenance_model: string
          p_period: number
          p_requires_legalization: boolean
          p_supervision_tags: string[]
          p_tenant_id: string
        }
        Returns: undefined
      }
      fn_upsert_representacion_puntual: {
        Args: {
          p_effective_from?: string
          p_entity_id: string
          p_evidence?: Json
          p_idempotency_key?: string
          p_meeting_id: string
          p_porcentaje_delegado?: number
          p_representative_person_id: string
          p_represented_person_id: string
          p_scope: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_upsert_representante_admin_pj: {
        Args: {
          p_effective_from: string
          p_entity_id: string
          p_idempotency_key?: string
          p_inscripcion_rm_fecha?: string
          p_inscripcion_rm_referencia?: string
          p_representative_person_id: string
          p_represented_person_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      fn_user_has_body_access: { Args: { p_body_id: string }; Returns: boolean }
      fn_validar_cardinalidad_administracion: {
        Args: { p_entity_id: string; p_tenant_id: string }
        Returns: Json
      }
      fn_validar_no_rebaja_ley: {
        Args: {
          p_majority_code: string
          p_materia: string
          p_tipo_social?: string
        }
        Returns: boolean
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
      reclassify_agenda_item_kind: {
        Args: {
          p_agenda_item_id: string
          p_meeting_id: string
          p_motivo: string
          p_new_kind: string
        }
        Returns: undefined
      }
      set_kind_change_context: {
        Args: { p_motivo: string; p_user_id: string }
        Returns: undefined
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
  graphql_public: {
    Enums: {},
  },
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

