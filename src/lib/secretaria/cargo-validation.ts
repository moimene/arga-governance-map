/**
 * Cargo / persona validation helpers a nivel UI/form.
 *
 * NO confundir con `src/lib/rules-engine/*` que es motor LSC computacional.
 * Estos helpers se usan en formularios de alta de cargo, dropdowns de personas
 * y guardas pre-submit. Las reglas codifican las decisiones legales del spec:
 * `docs/superpowers/specs/2026-05-12-personas-cargos-refactor-design.md`
 *
 * Decisiones legales cubiertas (Equipo Legal Garrigues, 2026-05-12):
 *
 *  - L1 (LSC art. 184): PJ socio (no admin) NO requiere representante PF
 *    permanente — sin VIGENTE de representación. `requiresRepresentative`
 *    devuelve `false` cuando `tipo === 'SOCIO'`.
 *
 *  - L2 (LSC art. 212bis + RRM art. 143): PJ administradora SÍ requiere
 *    representante PF permanente. `requiresRepresentative` devuelve `true`
 *    para `ADMIN_UNICO | ADMIN_SOLIDARIO | ADMIN_MANCOMUNADO | ADMIN_PJ |
 *    CONSEJERO` cuando `person_type === 'PJ'`.
 *
 *  - L15 (RRM art. 109): presidentes de comisiones NO certifican
 *    societariamente. `CONSEJERO_COORDINADOR` queda EXCLUIDO de
 *    `CARGOS_CERTIFICANTES` aunque sea cargo del CdA. Esto es coherente con
 *    `v_cargos_certificantes` definido en el trigger
 *    `20260513_000064_authority_evidence_trigger_rm_fields.sql` (commit
 *    `63a8639` corrigió esto en BD; aquí mantenemos la misma fuente de
 *    verdad en frontend para evitar drift BD↔UI).
 *
 *  - L16 (RRM art. 109): pestaña Autoridad distingue CERTIFICANTE
 *    (Secretario + Vicesecretario) vs VºBº (Presidente + Vicepresidente).
 *    Ambos grupos son `isAuthorityRole === true` porque participan en la
 *    emisión de certificaciones; los administradores no colegiados también
 *    certifican sus propias decisiones (LSC art. 210).
 *
 *  - L17 (RRM art. 109, 124 + LSC art. 529 octies): VICESECRETARIO es cargo
 *    inscribible y certifica en suplencia del Secretario. Incluido en
 *    `CARGOS_CERTIFICANTES` y en `CARGOS_COLEGIADOS`.
 *
 *  - L18 (RRM art. 124): COMISIONADO NO es cargo societario inscribible.
 *    DESCARTADO del scope — no aparece en ninguna lista.
 *
 *  - L22 (RRM art. 109): para certificar a terceros se exige inscripción RM.
 *    `isAuthorityRoleInscribable` se cumple para los mismos cargos que
 *    `isAuthorityRole`; la diferencia operativa (referencia RM presente en
 *    `authority_evidence.inscripcion_rm_referencia`) la verifica el hook
 *    `useAuthorityEvidence` antes de habilitar el botón "Emitir
 *    certificación".
 *
 * Cobertura legal: L1, L2, L15, L16, L17, L18, L22.
 *
 * Sobre el tipo `TipoCondicionCargo`: replica el enum de BD
 * `tipo_condicion_enum` (migration 000065). El hook `useCargos.ts` exporta
 * `TipoCondicion` con el mismo conjunto de valores; ambos deben mantenerse
 * sincronizados. Si se añade un nuevo valor al enum BD, actualizar este
 * archivo + `useCargos.ts` en el mismo commit.
 */

export type TipoCondicionCargo =
  | "SOCIO"
  | "ADMIN_UNICO"
  | "ADMIN_SOLIDARIO"
  | "ADMIN_MANCOMUNADO"
  | "ADMIN_PJ"
  | "CONSEJERO"
  | "PRESIDENTE"
  | "VICEPRESIDENTE"
  | "SECRETARIO"
  | "VICESECRETARIO"
  | "CONSEJERO_COORDINADOR";

const CARGOS_NO_COLEGIADOS: ReadonlyArray<TipoCondicionCargo> = [
  "SOCIO",
  "ADMIN_UNICO",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADO",
  "ADMIN_PJ",
];

const CARGOS_COLEGIADOS: ReadonlyArray<TipoCondicionCargo> = [
  "CONSEJERO",
  "PRESIDENTE",
  "VICEPRESIDENTE",
  "SECRETARIO",
  "VICESECRETARIO",
  "CONSEJERO_COORDINADOR",
];

/**
 * Cargos certificantes de actos societarios.
 *
 * Fuente de verdad ÚNICA con `v_cargos_certificantes` (variable interna del
 * trigger `fn_sync_authority_evidence` en
 * `supabase/migrations/20260513_000064_authority_evidence_trigger_rm_fields.sql`).
 *
 * NO incluye `CONSEJERO_COORDINADOR` (L15: presidente/coordinador de comisión
 * no certifica societariamente). Tampoco incluye `CONSEJERO` ni `ADMIN_PJ`
 * (sin firma propia: la PJ admin certifica vía su representante físico).
 */
const CARGOS_CERTIFICANTES: ReadonlyArray<TipoCondicionCargo> = [
  "ADMIN_UNICO",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADO",
  "PRESIDENTE",
  "VICEPRESIDENTE",
  "SECRETARIO",
  "VICESECRETARIO",
];

const CARGOS_PJ_REQUIERE_REPRESENTANTE: ReadonlyArray<TipoCondicionCargo> = [
  "ADMIN_UNICO",
  "ADMIN_SOLIDARIO",
  "ADMIN_MANCOMUNADO",
  "ADMIN_PJ",
  "CONSEJERO",
];

/**
 * `true` si el cargo pertenece a órgano colegiado (consejo o comisión) y por
 * tanto requiere `body_id` en `condiciones_persona`. Refleja
 * `chk_condicion_body_coherente` (CHECK constraint del schema).
 */
export function requiresBodyId(tipo: TipoCondicionCargo): boolean {
  return CARGOS_COLEGIADOS.includes(tipo);
}

/**
 * `true` si la persona en este cargo necesita un representante físico
 * permanente designado (L2). Sólo aplica cuando la persona es PJ; las
 * personas físicas nunca requieren representante.
 */
export function requiresRepresentative(
  person: { person_type: "PF" | "PJ" | null },
  tipo: TipoCondicionCargo,
): boolean {
  if (person.person_type !== "PJ") return false;
  return CARGOS_PJ_REQUIERE_REPRESENTANTE.includes(tipo);
}

/**
 * `true` si el cargo puede actuar como autoridad certificante de actos
 * societarios. Coherente con `v_cargos_certificantes` del trigger BD.
 *
 * NOTA: `CONSEJERO_COORDINADOR` NO está aquí (L15) aunque sea miembro del
 * CdA; certifica actos de su comisión, no de la sociedad. Mismo criterio
 * aplicado al fix del trigger en commit `63a8639`.
 */
export function isAuthorityRole(tipo: TipoCondicionCargo): boolean {
  return CARGOS_CERTIFICANTES.includes(tipo);
}

/**
 * `true` si el cargo requiere referencia de inscripción en el Registro
 * Mercantil para poder certificar a terceros (L22). Para los cargos
 * certificantes la condición de inscribibilidad es la misma — la
 * diferencia operativa (que la referencia RM esté efectivamente cargada en
 * `authority_evidence`) la verifica el hook `useAuthorityEvidence`.
 */
export function isAuthorityRoleInscribable(tipo: TipoCondicionCargo): boolean {
  return CARGOS_CERTIFICANTES.includes(tipo);
}

/**
 * Exporta las listas para depuración/tests adversariales y para que UI
 * components puedan iterar opciones sin reimplementar la lógica.
 */
export const __CARGOS = {
  CARGOS_COLEGIADOS,
  CARGOS_NO_COLEGIADOS,
  CARGOS_CERTIFICANTES,
  CARGOS_PJ_REQUIERE_REPRESENTANTE,
} as const;
