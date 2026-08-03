type ErrorRecord = Record<string, unknown>;

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asErrorRecord(value: unknown): ErrorRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ErrorRecord)
    : null;
}

/**
 * Convierte Error, PostgrestError y respuestas JSON de Edge/RPC en texto útil.
 * Nunca delega en String(object), que produciría el opaco "[object Object]".
 */
export function secretariaErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la operación.",
) {
  if (error instanceof Error) {
    return nonEmptyString(error.message) ?? fallback;
  }

  const direct = nonEmptyString(error);
  if (direct) return direct;

  const record = asErrorRecord(error);
  if (!record) return fallback;

  const nested = asErrorRecord(record.error);
  const source = nested ?? record;
  const code = nonEmptyString(source.code) ?? nonEmptyString(record.code);
  const message =
    nonEmptyString(source.message) ??
    nonEmptyString(source.error_description) ??
    nonEmptyString(record.message) ??
    nonEmptyString(record.error_description);
  const details = nonEmptyString(source.details) ?? nonEmptyString(record.details);
  const hint = nonEmptyString(source.hint) ?? nonEmptyString(record.hint);

  const headline = message ? `${code ? `[${code}] ` : ""}${message}` : code ? `[${code}]` : null;
  const parts = [headline, details, hint ? `Sugerencia: ${hint}` : null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? [...new Set(parts)].join(" · ") : fallback;
}

export function secretariaOperationError(error: unknown, fallback: string) {
  return new Error(secretariaErrorMessage(error, fallback));
}

