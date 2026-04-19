#!/usr/bin/env bun

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hzqwefkwsxopwrmtksbg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001';
const DEMO_ENTITY = '00000000-0000-0000-0000-000000000010'; // ARGA Seguros SA
const CDA_BODY = '00000000-0000-0000-0000-000000000020'; // Consejo de Administración

// Fixed UUIDs for demo persons
const PERSONS = {
  LUCIA_PAREDES: '00000000-0000-0000-0000-000000000101',
  ANTONIO_RIOS: '00000000-0000-0000-0000-000000000102',
  ISABEL_MORENO: '00000000-0000-0000-0000-000000000103',
  CARLOS_VEGA: '00000000-0000-0000-0000-000000000104',
  MARIA_SANTOS: '00000000-0000-0000-0000-000000000105',
  PEDRO_GARCIA: '00000000-0000-0000-0000-000000000106',
  ANA_LOPEZ: '00000000-0000-0000-0000-000000000107',
  JORGE_MARTINEZ: '00000000-0000-0000-0000-000000000108',
  ELENA_RUIZ: '00000000-0000-0000-0000-000000000109',
  ARGA_CAPITAL_SL: '00000000-0000-0000-0000-000000000110', // persona jurídica
  ADMIN_USER: '00000000-0000-0000-0000-000000000099', // admin for role assignments
};

// Fixed UUIDs for demo agreements and expedientes
const AGREEMENTS = {
  CIRC_CONSEJO: '00000000-0000-0000-0000-000000000201',
  DECISION_SLU: '00000000-0000-0000-0000-000000000202',
  JUNTA_SL: '00000000-0000-0000-0000-000000000203',
};

const EXPEDIENTES = {
  CIRC_CONSEJO: '00000000-0000-0000-0000-000000000301',
  DECISION_SLU: '00000000-0000-0000-0000-000000000302',
  JUNTA_SL: '00000000-0000-0000-0000-000000000303',
};

// ============================================================================
// Section 1: T3 — Rule param overrides for ARGA Seguros SA
// ============================================================================

async function seedRuleParamOverrides() {
  console.log('\n📋 Section 1: T3 — Rule Parameter Overrides');

  const overrides = [
    {
      id: '00000000-0000-0000-0000-000000000401',
      tenant_id: DEMO_TENANT,
      entity_id: DEMO_ENTITY,
      body_id: CDA_BODY,
      materia: 'FORMULACION_CUENTAS',
      clase: 'ORDINARIA',
      convocatoria_antelacion_dias: 5,
      convocatoria_fuente: 'Estatutos ARGA Seguros SA - Art. 15',
      constitucion_quorum_pct: 30,
      constitucion_quorum_fuente: 'Estatutos ARGA Seguros SA - Art. 16, elevado respecto a LSC',
      votacion_voto_calidad_habilitado: true,
      votacion_voto_calidad_fuente: 'Reglamento de Procedimientos Corporativos, Sección 3.2',
      vigente_desde: '2026-01-01',
      descripcion: 'Sobrepara para ARGA Seguros SA: quórum elevado + aviso anticipado',
    },
  ];

  try {
    const { error } = await supabase
      .from('rule_param_overrides')
      .upsert(overrides, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting rule_param_overrides:', error);
      return;
    }

    console.log(`✅ Inserted/updated ${overrides.length} rule_param_override(s)`);
  } catch (e) {
    console.error('Exception in seedRuleParamOverrides:', e);
  }
}

// ============================================================================
// Section 2: T3e — Personas jurídicas demo y capital
// ============================================================================

async function seedPersonasAndCapital() {
  console.log('\n👥 Section 2: T3e — Personas, Capital & Mandates');

  // First ensure all physical persons exist
  const persons = [
    {
      id: PERSONS.LUCIA_PAREDES,
      tenant_id: DEMO_TENANT,
      first_name: 'Lucía',
      last_name: 'Paredes',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345678A',
      representative_person_id: null,
    },
    {
      id: PERSONS.ANTONIO_RIOS,
      tenant_id: DEMO_TENANT,
      first_name: 'Antonio',
      last_name: 'Ríos',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345679B',
      representative_person_id: null,
    },
    {
      id: PERSONS.ISABEL_MORENO,
      tenant_id: DEMO_TENANT,
      first_name: 'Isabel',
      last_name: 'Moreno',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345680C',
      representative_person_id: null,
    },
    {
      id: PERSONS.CARLOS_VEGA,
      tenant_id: DEMO_TENANT,
      first_name: 'Carlos',
      last_name: 'Vega',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345681D',
      representative_person_id: null,
    },
    {
      id: PERSONS.MARIA_SANTOS,
      tenant_id: DEMO_TENANT,
      first_name: 'María',
      last_name: 'Santos',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345682E',
      representative_person_id: null,
    },
    {
      id: PERSONS.PEDRO_GARCIA,
      tenant_id: DEMO_TENANT,
      first_name: 'Pedro',
      last_name: 'García',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345683F',
      representative_person_id: null,
    },
    {
      id: PERSONS.ANA_LOPEZ,
      tenant_id: DEMO_TENANT,
      first_name: 'Ana',
      last_name: 'López',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345684G',
      representative_person_id: null,
    },
    {
      id: PERSONS.JORGE_MARTINEZ,
      tenant_id: DEMO_TENANT,
      first_name: 'Jorge',
      last_name: 'Martínez',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345685H',
      representative_person_id: null,
    },
    {
      id: PERSONS.ELENA_RUIZ,
      tenant_id: DEMO_TENANT,
      first_name: 'Elena',
      last_name: 'Ruiz',
      person_type: 'FISICA',
      denomination: null,
      tax_id: '12345686I',
      representative_person_id: null,
    },
    {
      id: PERSONS.ARGA_CAPITAL_SL,
      tenant_id: DEMO_TENANT,
      first_name: 'ARGA Capital',
      last_name: 'Inversiones SL',
      person_type: 'JURIDICA',
      denomination: 'ARGA Capital Inversiones SL',
      tax_id: 'B12345679',
      representative_person_id: PERSONS.ISABEL_MORENO,
    },
  ];

  try {
    const { error } = await supabase
      .from('persons')
      .upsert(persons, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting persons:', error);
      return;
    }

    console.log(`✅ Upserted ${persons.length} person records`);
  } catch (e) {
    console.error('Exception in persons upsert:', e);
  }

  // Ensure governing bodies exist (DL-5: voto calidad config per órgano)
  try {
    const bodies = [
      {
        id: CDA_BODY,
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY,
        tipo_organo: 'CONSEJO',
        denominacion: 'Consejo de Administración',
        activo: true,
        config: { voto_calidad_presidente: true },
      },
      {
        id: '00000000-0000-0000-0000-000000000021',
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY,
        tipo_organo: 'COMISION_DELEGADA',
        denominacion: 'Comité Ejecutivo',
        activo: true,
        config: { voto_calidad_presidente: true, es_comite_ejecutivo: true },
      },
      {
        id: '00000000-0000-0000-0000-000000000022',
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY,
        tipo_organo: 'COMISION_DELEGADA',
        denominacion: 'Comisión de Auditoría',
        activo: true,
        config: { voto_calidad_presidente: false },
      },
      {
        id: '00000000-0000-0000-0000-000000000023',
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY,
        tipo_organo: 'COMISION_DELEGADA',
        denominacion: 'Comisión de Riesgos',
        activo: true,
        config: { voto_calidad_presidente: false },
      },
      {
        id: '00000000-0000-0000-0000-000000000024',
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY,
        tipo_organo: 'COMISION_DELEGADA',
        denominacion: 'Comisión de Nombramientos',
        activo: true,
        config: { voto_calidad_presidente: false },
      },
      {
        id: '00000000-0000-0000-0000-000000000025',
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY,
        tipo_organo: 'COMISION_DELEGADA',
        denominacion: 'Comisión de Retribuciones',
        activo: true,
        config: { voto_calidad_presidente: false },
      },
    ];

    const { error } = await supabase
      .from('governing_bodies')
      .upsert(bodies, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting governing_bodies:', error);
      return;
    }

    console.log(`✅ Upserted ${bodies.length} governing bodies (CdA + Comité Ejecutivo + 4 Comisiones)`);
  } catch (e) {
    console.error('Exception in governing_bodies upsert:', e);
  }

  // Upsert mandates with capital distribution
  const mandates = [
    {
      id: '00000000-0000-0000-0000-000000000501',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.ANTONIO_RIOS,
      body_id: CDA_BODY,
      cargo: 'presidente',
      capital_acciones: 150000,
      porcentaje_participacion: 15.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000502',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.ARGA_CAPITAL_SL,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 120000,
      porcentaje_participacion: 12.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000503',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.CARLOS_VEGA,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 100000,
      porcentaje_participacion: 10.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000504',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.MARIA_SANTOS,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 100000,
      porcentaje_participacion: 10.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000505',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.PEDRO_GARCIA,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 80000,
      porcentaje_participacion: 8.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000506',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.ANA_LOPEZ,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 80000,
      porcentaje_participacion: 8.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000507',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.JORGE_MARTINEZ,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 50000,
      porcentaje_participacion: 5.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000508',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.ELENA_RUIZ,
      body_id: CDA_BODY,
      cargo: 'consejero',
      capital_acciones: 50000,
      porcentaje_participacion: 5.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000509',
      tenant_id: DEMO_TENANT,
      person_id: PERSONS.LUCIA_PAREDES,
      body_id: CDA_BODY,
      cargo: 'secretaria',
      capital_acciones: 20000,
      porcentaje_participacion: 2.0,
      fecha_inicio: '2024-01-01',
      fecha_fin: null,
      activo: true,
    },
  ];

  try {
    const { error } = await supabase
      .from('mandates')
      .upsert(mandates, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting mandates:', error);
      return;
    }

    console.log(`✅ Upserted ${mandates.length} mandate records (capital distribution seeded)`);
  } catch (e) {
    console.error('Exception in mandates upsert:', e);
  }
}

// ============================================================================
// Section 3: T3f — Role assignments
// ============================================================================

async function seedRoleAssignments() {
  console.log('\n🔐 Section 3: T3f — Role Assignments');

  const roleAssignments = [
    {
      id: '00000000-0000-0000-0000-000000000601',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.LUCIA_PAREDES,
      role_code: 'SECRETARIA_CORPORATIVA',
      scope_type: 'GLOBAL',
      scope_entity_id: null,
      scope_body_id: null,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000602',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.LUCIA_PAREDES,
      role_code: 'SECRETARIO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000603',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.ANTONIO_RIOS,
      role_code: 'PRESIDENTE',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000604',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.ARGA_CAPITAL_SL,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000605',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.CARLOS_VEGA,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000606',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.MARIA_SANTOS,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000607',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.PEDRO_GARCIA,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000608',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.ANA_LOPEZ,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000609',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.JORGE_MARTINEZ,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000610',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.ELENA_RUIZ,
      role_code: 'MIEMBRO',
      scope_type: 'BODY',
      scope_entity_id: DEMO_ENTITY,
      scope_body_id: CDA_BODY,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000611',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.ADMIN_USER,
      role_code: 'COMITE_LEGAL',
      scope_type: 'GLOBAL',
      scope_entity_id: null,
      scope_body_id: null,
      assigned_at: new Date().toISOString(),
      active: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000612',
      tenant_id: DEMO_TENANT,
      user_id: PERSONS.ADMIN_USER,
      role_code: 'ADMIN_SISTEMA',
      scope_type: 'GLOBAL',
      scope_entity_id: null,
      scope_body_id: null,
      assigned_at: new Date().toISOString(),
      active: true,
    },
  ];

  try {
    const { error } = await supabase
      .from('secretaria_role_assignments')
      .upsert(roleAssignments, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting role_assignments:', error);
      return;
    }

    console.log(`✅ Upserted ${roleAssignments.length} role assignment(s)`);
  } catch (e) {
    console.error('Exception in seedRoleAssignments:', e);
  }
}

// ============================================================================
// Section 4: T3h — NO_SESSION demo expedientes
// ============================================================================

async function seedAgreementsAndExpedientes() {
  console.log('\n📄 Section 4: T3h — Agreements & NO_SESSION Expedientes');

  // Create agreements first
  const agreements = [
    {
      id: AGREEMENTS.CIRC_CONSEJO,
      tenant_id: DEMO_TENANT,
      entity_id: DEMO_ENTITY,
      body_id: CDA_BODY,
      agreement_kind: 'FORMULACION_CUENTAS',
      matter_class: 'ORDINARIA',
      inscribable: false,
      adoption_mode: 'NO_SESSION',
      required_quorum_code: null,
      required_majority_code: null,
      jurisdiction_rule_id: null,
      proposal_text:
        'Se propone la formulación de las cuentas anuales del ejercicio 2025, con aprobación de las mismas por el Consejo de Administración.',
      decision_text: 'Aprobadas por unanimidad las cuentas anuales del ejercicio 2025.',
      decision_date: '2026-03-08',
      effective_date: '2026-03-08',
      status: 'ADOPTED',
      parent_meeting_id: null,
      unipersonal_decision_id: null,
      no_session_resolution_id: null,
      statutory_basis: 'Art. 272 LSC, Arts. 13-16 Estatutos ARGA Seguros SA',
      compliance_snapshot: {
        adopted_by: 'unanimidad',
        quorum_status: 'ACHIEVED',
        voting_status: 'COMPLETE',
      },
    },
    {
      id: AGREEMENTS.DECISION_SLU,
      tenant_id: DEMO_TENANT,
      entity_id: DEMO_ENTITY,
      body_id: null,
      agreement_kind: 'APROBACION_CUENTAS',
      matter_class: 'ORDINARIA',
      inscribable: false,
      adoption_mode: 'UNIPERSONAL_SOCIO',
      required_quorum_code: null,
      required_majority_code: null,
      jurisdiction_rule_id: null,
      proposal_text: 'Decisión del socio único de SLU filial: aprobación de cuentas 2025.',
      decision_text: 'Aprobadas las cuentas de la SLU filial.',
      decision_date: '2026-03-10',
      effective_date: '2026-03-10',
      status: 'ADOPTED',
      parent_meeting_id: null,
      unipersonal_decision_id: null,
      no_session_resolution_id: null,
      statutory_basis: 'Art. 262 LSC',
      compliance_snapshot: {
        adopted_by: 'decision_socio_unico',
      },
    },
    {
      id: AGREEMENTS.JUNTA_SL,
      tenant_id: DEMO_TENANT,
      entity_id: DEMO_ENTITY,
      body_id: null,
      agreement_kind: 'NOMBRAMIENTO_CESE',
      matter_class: 'ORDINARIA',
      inscribable: true,
      adoption_mode: 'NO_SESSION',
      required_quorum_code: null,
      required_majority_code: null,
      jurisdiction_rule_id: null,
      proposal_text: 'Nombramiento de nuevo consejero de la SL filial.',
      decision_text: null,
      decision_date: null,
      effective_date: null,
      status: 'PROPOSED',
      parent_meeting_id: null,
      unipersonal_decision_id: null,
      no_session_resolution_id: null,
      statutory_basis: 'Art. 213 LSC',
      compliance_snapshot: null,
    },
  ];

  try {
    const { error } = await supabase
      .from('agreements')
      .upsert(agreements, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting agreements:', error);
      return;
    }

    console.log(`✅ Upserted ${agreements.length} agreement record(s)`);
  } catch (e) {
    console.error('Exception in seedAgreements:', e);
  }

  // Create no_session_expedientes
  const expedientes = [
    {
      id: EXPEDIENTES.CIRC_CONSEJO,
      tenant_id: DEMO_TENANT,
      agreement_id: AGREEMENTS.CIRC_CONSEJO,
      entity_id: DEMO_ENTITY,
      body_id: CDA_BODY,
      tipo_proceso: 'CIRCULACION_CONSEJO',
      condicion_adopcion: 'MAYORIA_CONSEJEROS_ESCRITA',
      estado: 'CERRADO_OK',
      propuesta_texto:
        'Se propone al Consejo de Administración la formulación de las cuentas anuales del ejercicio 2025, que han sido previamente revisadas por la Comisión de Auditoría. Se adjuntan documentos de soporte.',
      propuesta_fecha: '2026-03-01T09:00:00Z',
      ventana_inicio: '2026-03-01T09:00:00Z',
      ventana_fin: '2026-03-10T18:00:00Z',
      ventana_dias_habiles: 7,
      fecha_cierre: '2026-03-08T14:30:00Z',
      silencio_positivo: false,
      creado_por: PERSONS.LUCIA_PAREDES,
    },
    {
      id: EXPEDIENTES.DECISION_SLU,
      tenant_id: DEMO_TENANT,
      agreement_id: AGREEMENTS.DECISION_SLU,
      entity_id: DEMO_ENTITY,
      body_id: null,
      tipo_proceso: 'DECISION_SOCIO_UNICO_SL',
      condicion_adopcion: 'DECISION_UNICA',
      estado: 'PROCLAMADO',
      propuesta_texto: 'Decisión del socio único: aprobación de cuentas anuales de SLU filial.',
      propuesta_fecha: '2026-03-05T10:00:00Z',
      ventana_inicio: '2026-03-05T10:00:00Z',
      ventana_fin: '2026-03-10T10:00:00Z',
      ventana_dias_habiles: 3,
      fecha_cierre: '2026-03-10T10:00:00Z',
      silencio_positivo: false,
      creado_por: PERSONS.LUCIA_PAREDES,
    },
    {
      id: EXPEDIENTES.JUNTA_SL,
      tenant_id: DEMO_TENANT,
      agreement_id: AGREEMENTS.JUNTA_SL,
      entity_id: DEMO_ENTITY,
      body_id: null,
      tipo_proceso: 'UNANIMIDAD_ESCRITA_SL',
      condicion_adopcion: 'UNANIMIDAD_CAPITAL',
      estado: 'ABIERTO',
      propuesta_texto:
        'Se propone el nombramiento de nuevo consejero de la SL filial, con aprobación por unanimidad de los socios.',
      propuesta_fecha: '2026-04-15T09:00:00Z',
      ventana_inicio: '2026-04-15T09:00:00Z',
      ventana_fin: '2026-04-25T18:00:00Z',
      ventana_dias_habiles: 8,
      fecha_cierre: null,
      silencio_positivo: false,
      creado_por: PERSONS.LUCIA_PAREDES,
    },
  ];

  try {
    const { error } = await supabase
      .from('no_session_expedientes')
      .upsert(expedientes, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting expedientes:', error);
      return;
    }

    console.log(`✅ Upserted ${expedientes.length} no_session_expediente record(s)`);
  } catch (e) {
    console.error('Exception in seedExpedientes:', e);
  }

  // Seed notifications for expedientes
  await seedNotifications();

  // Seed responses for closed expedientes
  await seedResponses();
}

// ============================================================================
// Helper: Seed notifications (WORM-append only)
// ============================================================================

async function seedNotifications() {
  console.log('\n📮 Seeding NO_SESSION Notifications (WORM append-only)');

  // Expediente 1: Circulación — 9 notifications to all consejeros
  const notificaciones1 = [
    PERSONS.ANTONIO_RIOS,
    PERSONS.ARGA_CAPITAL_SL,
    PERSONS.CARLOS_VEGA,
    PERSONS.MARIA_SANTOS,
    PERSONS.PEDRO_GARCIA,
    PERSONS.ANA_LOPEZ,
    PERSONS.JORGE_MARTINEZ,
    PERSONS.ELENA_RUIZ,
    PERSONS.LUCIA_PAREDES,
  ].map((person_id, idx) => ({
    id: `00000000-0000-0000-0000-00000000070${idx}`,
    tenant_id: DEMO_TENANT,
    expediente_id: EXPEDIENTES.CIRC_CONSEJO,
    person_id,
    estado_notificacion: 'ENTREGADA',
    fecha_entrega: '2026-03-01T09:30:00Z',
    metodo_entrega: 'BUROFAX',
    creado_en: new Date().toISOString(),
  }));

  // Expediente 2: Decision SLU — 1 notification
  const notificaciones2 = [
    {
      id: '00000000-0000-0000-0000-000000000710',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.DECISION_SLU,
      person_id: PERSONS.ARGA_CAPITAL_SL,
      estado_notificacion: 'ENTREGADA',
      fecha_entrega: '2026-03-05T10:15:00Z',
      metodo_entrega: 'EMAIL',
      creado_en: new Date().toISOString(),
    },
  ];

  // Expediente 3: Junta SL — 3 notifications to socios
  const notificaciones3 = [PERSONS.ANTONIO_RIOS, PERSONS.ARGA_CAPITAL_SL, PERSONS.CARLOS_VEGA].map(
    (person_id, idx) => ({
      id: `00000000-0000-0000-0000-00000000071${idx}`,
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.JUNTA_SL,
      person_id,
      estado_notificacion: 'ENTREGADA',
      fecha_entrega: '2026-04-15T09:30:00Z',
      metodo_entrega: 'EMAIL',
      creado_en: new Date().toISOString(),
    })
  );

  const allNotificaciones = [...notificaciones1, ...notificaciones2, ...notificaciones3];

  try {
    const { error } = await supabase
      .from('no_session_notificaciones')
      .insert(allNotificaciones);

    if (error && error.code === '23505') {
      console.log(`ℹ️  Notifications already exist (duplicate key)`);
    } else if (error) {
      console.error('Error inserting notifications:', error);
    } else {
      console.log(`✅ Inserted ${allNotificaciones.length} notification record(s)`);
    }
  } catch (e) {
    console.error('Exception in seedNotifications:', e);
  }
}

// ============================================================================
// Helper: Seed responses (WORM-append only)
// ============================================================================

async function seedResponses() {
  console.log('\n📋 Seeding NO_SESSION Respuestas (WORM append-only)');

  // Expediente 1: Circulación — 8 CONSENTIMIENTO + 1 OBJECION
  const respuestas1 = [
    {
      id: '00000000-0000-0000-0000-000000000801',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.ANTONIO_RIOS,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-02T10:00:00Z',
      firma_qes_ref: 'SIG-2026-03-02-001-RIOS',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000802',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.ARGA_CAPITAL_SL,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-02T11:00:00Z',
      firma_qes_ref: 'SIG-2026-03-02-002-ARGA',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000803',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.CARLOS_VEGA,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-02T14:00:00Z',
      firma_qes_ref: 'SIG-2026-03-02-003-VEGA',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000804',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.MARIA_SANTOS,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-03T09:00:00Z',
      firma_qes_ref: 'SIG-2026-03-03-001-SANTOS',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000805',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.PEDRO_GARCIA,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-03T15:00:00Z',
      firma_qes_ref: 'SIG-2026-03-03-002-GARCIA',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000806',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.ANA_LOPEZ,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-04T10:00:00Z',
      firma_qes_ref: 'SIG-2026-03-04-001-LOPEZ',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000807',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.JORGE_MARTINEZ,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-04T16:00:00Z',
      firma_qes_ref: 'SIG-2026-03-04-002-MARTINEZ',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000808',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.ELENA_RUIZ,
      tipo_respuesta: 'OBJECION',
      fecha_respuesta: '2026-03-05T09:00:00Z',
      firma_qes_ref: 'SIG-2026-03-05-001-RUIZ',
      contenido_objecion:
        'Objeción sobre el fondo: se solicita revisión adicional de los fondos de provisión.',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000809',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.CIRC_CONSEJO,
      person_id: PERSONS.LUCIA_PAREDES,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-06T08:00:00Z',
      firma_qes_ref: 'SIG-2026-03-06-001-PAREDES',
      creado_en: new Date().toISOString(),
    },
  ];

  // Expediente 2: Decision SLU — 1 CONSENTIMIENTO
  const respuestas2 = [
    {
      id: '00000000-0000-0000-0000-000000000810',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.DECISION_SLU,
      person_id: PERSONS.ARGA_CAPITAL_SL,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-03-06T11:00:00Z',
      firma_qes_ref: 'SIG-2026-03-06-002-ARGA-SLU',
      creado_en: new Date().toISOString(),
    },
  ];

  // Expediente 3: Junta SL — 2 CONSENTIMIENTO, 1 PENDING
  const respuestas3 = [
    {
      id: '00000000-0000-0000-0000-000000000811',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.JUNTA_SL,
      person_id: PERSONS.ANTONIO_RIOS,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-04-16T10:00:00Z',
      firma_qes_ref: 'SIG-2026-04-16-001-RIOS-JUNTA',
      creado_en: new Date().toISOString(),
    },
    {
      id: '00000000-0000-0000-0000-000000000812',
      tenant_id: DEMO_TENANT,
      expediente_id: EXPEDIENTES.JUNTA_SL,
      person_id: PERSONS.ARGA_CAPITAL_SL,
      tipo_respuesta: 'CONSENTIMIENTO',
      fecha_respuesta: '2026-04-17T14:00:00Z',
      firma_qes_ref: 'SIG-2026-04-17-001-ARGA-JUNTA',
      creado_en: new Date().toISOString(),
    },
  ];

  const allRespuestas = [...respuestas1, ...respuestas2, ...respuestas3];

  try {
    const { error } = await supabase
      .from('no_session_respuestas')
      .insert(allRespuestas);

    if (error && error.code === '23505') {
      console.log(`ℹ️  Respuestas already exist (duplicate key)`);
    } else if (error) {
      console.error('Error inserting respuestas:', error);
    } else {
      console.log(`✅ Inserted ${allRespuestas.length} respuesta record(s)`);
    }
  } catch (e) {
    console.error('Exception in seedResponses:', e);
  }
}

// ============================================================================
// Main Orchestrator
// ============================================================================

async function main() {
  console.log('🌱 Starting TGMS Demo Data Seed Script');
  console.log(`📌 Demo Tenant: ${DEMO_TENANT}`);
  console.log(`📌 Demo Entity: ${DEMO_ENTITY}`);
  console.log(`📌 Supabase: ${SUPABASE_URL}\n`);

  try {
    // Section 1: Rule param overrides
    await seedRuleParamOverrides();

    // Section 2: Personas, capital, mandates
    await seedPersonasAndCapital();

    // Section 3: Role assignments
    await seedRoleAssignments();

    // Section 4: Agreements, expedientes, notifications, respuestas
    await seedAgreementsAndExpedientes();

    console.log('\n✨ Demo data seeding complete!');
    console.log('📊 Summary:');
    console.log('  ✅ Rule parameter overrides seeded');
    console.log('  ✅ 10 Persons (9 FISICA + 1 JURIDICA) upserted');
    console.log('  ✅ 9 Mandates with capital distribution seeded');
    console.log('  ✅ 12 Role assignments seeded');
    console.log('  ✅ 3 Agreements seeded');
    console.log('  ✅ 3 NO_SESSION Expedientes seeded');
    console.log('  ✅ 13 Notifications seeded (WORM append-only)');
    console.log('  ✅ 12 Respuestas seeded (WORM append-only)');
    console.log('\n🎯 Ready for T4+ implementation phases.\n');
  } catch (e) {
    console.error('\n❌ Fatal error during seeding:', e);
    process.exit(1);
  }
}

main();
