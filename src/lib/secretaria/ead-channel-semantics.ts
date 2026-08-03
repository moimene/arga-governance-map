/**
 * Semántica de producto EAD para nuevas capturas de Secretaría.
 *
 * `ERDS` y `BUROFAX_ERDS` se conservan como códigos legacy de solo lectura:
 * no existe en la demo evidencia contractual que permita afirmar ese servicio.
 * Toda nueva captura se normaliza a un modo neutro de interposición que no
 * implica firma, entrega certificada ni efecto jurídico.
 */
export const EAD_INTERPOSITION_CHANNEL = "EAD_INTERPOSITION" as const;

const LEGACY_ERDS_CHANNELS = new Set([
  "ERDS",
  "BUROFAX_ERDS",
  "SANDBOX_ERDS",
  "SANDBOX_BUROFAX_ERDS",
]);

const UNVERIFIED_EXTERNALITY_VALUE =
  /(?:ERDS|QES|QTSP)|firma\s+(?:avanzada|simple|electr[oó]nica)|signature|acuse(?:\s+legal)?|acknowledg|receipt|evidencia\s+certificada|certificad[ao]|certified|env[ií]o|send|\bsent\b|dispatch|entrega|delivery|delivered/iu;

const UNVERIFIED_EXTERNALITY_FIELD =
  /(?:ERDS|QES|QTSP)|firma|signature|acuse|acknowledg|receipt|evidencia|evidence|certific|env[ií]o|send|sent|dispatch|entrega|delivery|delivered|provider_(?:execution|response|interaction|ref)/iu;

export function normalizeChannelCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function isLegacyErdsChannel(value: unknown): boolean {
  return LEGACY_ERDS_CHANNELS.has(normalizeChannelCode(value));
}

/**
 * Convierte una selección histórica ERDS en la semántica permitida para una
 * nueva captura. Los demás canales se preservan normalizados.
 */
export function channelForNewCapture(value: unknown): string {
  const normalized = normalizeChannelCode(value);
  const withoutSandboxPrefix = normalized.replace(/^SANDBOX_/, "");
  return isLegacyErdsChannel(normalized) || withoutSandboxPrefix === EAD_INTERPOSITION_CHANNEL
    ? EAD_INTERPOSITION_CHANNEL
    : withoutSandboxPrefix;
}

export function channelsForNewCapture(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map(channelForNewCapture)
        .filter(Boolean),
    ),
  );
}

/**
 * Elimina de una traza nueva cualquier hecho externo heredado que no haya
 * sido acreditado. Conserva el resto de la estructura para no perder la
 * explicación jurídica o de negocio que sí es independiente del proveedor.
 */
export function sanitizeEadInterpositionTraceValue(value: unknown): unknown {
  if (typeof value === "string") {
    return UNVERIFIED_EXTERNALITY_VALUE.test(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeEadInterpositionTraceValue(item))
      .filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !UNVERIFIED_EXTERNALITY_FIELD.test(key))
        .map(([key, item]) => [key, sanitizeEadInterpositionTraceValue(item)] as const)
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
}

export function safeEadChannelLabel(value: unknown): string | null {
  const normalized = normalizeChannelCode(value);
  if (normalized === EAD_INTERPOSITION_CHANNEL || normalized === `SANDBOX_${EAD_INTERPOSITION_CHANNEL}`) {
    return "EAD Trust · interposición, mensajería básica y custodia (sin firma ni ERDS)";
  }
  if (isLegacyErdsChannel(normalized)) {
    return "Canal ERDS histórico · solo lectura; capacidad no acreditada en la demo";
  }
  return null;
}
