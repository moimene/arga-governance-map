export interface MinuteApprovalTimeline {
  /** Fecha que debe mostrarse dentro del escenario societario. */
  legalEffectiveAt: string | null;
  /** Momento real en el que la aplicación registró la acción. */
  recordedAt: string | null;
  /** True cuando el ciclo se ha adelantado para una demo futura. */
  isSimulatedFuture: boolean;
}

export interface WorkflowDateTimeInputParts {
  date: string;
  time: string;
}

/**
 * Reconstruye los valores de un formulario local desde el instante guardado.
 * Una convocatoria se captura en la hora civil que ve el usuario; recortarla
 * desde `toISOString()` durante una clonación desplaza esa hora a UTC.
 */
export function resolveWorkflowDateTimeInputParts(
  value: string | Date,
  timeZone?: string,
): WorkflowDateTimeInputParts | null {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  if (timeZone) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(parsed)
        .map((part) => [part.type, part.value]),
    );
    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      time: `${parts.hour}:${parts.minute}`,
    };
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

/**
 * Fecha jurídica que debe gobernar el encabezado, el nombre de archivo y el
 * aviso temporal de un documento de acuerdo. La fecha técnica de generación
 * se conserva aparte dentro del DOCX; nunca debe sustituir a la fecha del
 * acuerdo, especialmente cuando el ciclo futuro se ejecuta en modo demo.
 */
export function resolveAgreementDocumentLegalDate(input: {
  effectiveDate?: string | null;
  decisionDate?: string | null;
}): string | null {
  return input.effectiveDate?.trim() || input.decisionDate?.trim() || null;
}

function validTimestamp(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Separa la fecha jurídica declarada de la traza técnica. En un ciclo normal
 * ambas siguen la firma. Si la demo completa hoy una reunión futura, el acta
 * usa la fecha de la reunión y queda expresamente marcada como simulación.
 */
export function resolveMinuteApprovalTimeline(input: {
  signedAt?: string | null;
  meetingScheduledAt?: string | null;
}): MinuteApprovalTimeline {
  const signedTimestamp = validTimestamp(input.signedAt);
  if (signedTimestamp === null) {
    return {
      legalEffectiveAt: null,
      recordedAt: null,
      isSimulatedFuture: false,
    };
  }

  const meetingTimestamp = validTimestamp(input.meetingScheduledAt);
  const isSimulatedFuture = meetingTimestamp !== null && signedTimestamp < meetingTimestamp;

  return {
    legalEffectiveAt: isSimulatedFuture ? input.meetingScheduledAt ?? null : input.signedAt ?? null,
    recordedAt: input.signedAt ?? null,
    isSimulatedFuture,
  };
}

export interface RegistryEventTimelineDate {
  businessDate: string | null;
  businessDateLabel: string | null;
  recordedAt: string;
}

/**
 * Los eventos WORM conservan cuándo se registró la acción. Las fechas del
 * negocio (escritura o presentación) proceden del expediente/payload y se
 * muestran aparte para no aparentar efectos jurídicos en la fecha del test.
 */
export function resolveRegistryEventTimelineDate(input: {
  eventType: string;
  effectiveAt: string;
  payload?: Record<string, unknown> | null;
  deedDate?: string | null;
}): RegistryEventTimelineDate {
  const payloadPresentationDate =
    typeof input.payload?.presentation_date === "string"
      ? input.payload.presentation_date
      : null;

  if (input.eventType === "PRESENTACION_ASENTADA" && payloadPresentationDate) {
    return {
      businessDate: payloadPresentationDate,
      businessDateLabel: "Fecha de presentación declarada",
      recordedAt: input.effectiveAt,
    };
  }

  if (input.eventType === "EXPEDIENTE_PREPARADO" && input.deedDate) {
    return {
      businessDate: input.deedDate,
      businessDateLabel: "Fecha de escritura declarada",
      recordedAt: input.effectiveAt,
    };
  }

  return {
    businessDate: null,
    businessDateLabel: null,
    recordedAt: input.effectiveAt,
  };
}
