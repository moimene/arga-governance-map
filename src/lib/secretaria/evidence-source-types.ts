/**
 * Constantes canónicas para evidence_bundles.source_object_type.
 *
 * ITEM-149: el seed usaba 'agreement' en minúsculas mientras los hooks filtran por
 * 'AGREEMENT' (uppercase). Centralizar el valor evita que escritores y lectores
 * vuelvan a divergir. Writers (storage-archiver) y readers
 * (useEvidenceBundleSignedUrl) consumen esta constante.
 */
export const SOURCE_OBJECT_TYPE = {
  AGREEMENT: "AGREEMENT",
} as const;

export type SourceObjectType = (typeof SOURCE_OBJECT_TYPE)[keyof typeof SOURCE_OBJECT_TYPE];
