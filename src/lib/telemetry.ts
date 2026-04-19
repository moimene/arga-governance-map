/**
 * TGMS Telemetry & Observability
 *
 * OTel-compatible telemetry stub for tracking events, page views, errors, and performance metrics.
 * In production, integrates with Microsoft Sentinel via Edge Function.
 * In development, logs structured events to console.
 */

interface TelemetryEvent {
  timestamp: string;
  event: string;
  properties?: Record<string, any>;
  sessionId: string;
}

export interface SLOMetrics {
  p95LatencyMs: number;
  errorRate: number;
  uptimePercent: number;
  targets: {
    p95: number;
    rpo: string;
    rto: string;
  };
}

// Initialize session with unique ID
const SESSION_ID = crypto.randomUUID();

// In-memory event buffer (for demo/dev)
const events: TelemetryEvent[] = [];

// Performance tracking
const performanceMarkers: Map<string, number> = new Map();

/**
 * Track a custom event with optional properties
 * @param name - Event name (e.g., "agreement_created", "compliance_check")
 * @param properties - Additional event data
 */
export function trackEvent(
  name: string,
  properties?: Record<string, any>
): void {
  const evt: TelemetryEvent = {
    timestamp: new Date().toISOString(),
    event: name,
    properties,
    sessionId: SESSION_ID,
  };

  events.push(evt);

  // Log to console in development
  if (import.meta.env.DEV) {
    console.debug("[TGMS Telemetry]", {
      ...evt,
      level: "info",
    });
  }

  // Production: POST to Edge Function → Microsoft Sentinel
  // if (!import.meta.env.DEV) {
  //   navigator.sendBeacon(
  //     `${import.meta.env.VITE_API_URL}/telemetry/events`,
  //     JSON.stringify(evt)
  //   );
  // }
}

/**
 * Track page view for navigation telemetry
 * @param path - Current route path
 */
export function trackPageView(path: string): void {
  trackEvent("page_view", {
    path,
    referrer: document.referrer || "direct",
    hostname: window.location.hostname,
  });
}

/**
 * Track errors with stack trace and context
 * @param error - Error object
 * @param context - Additional context for the error
 */
export function trackError(
  error: Error,
  context?: Record<string, any>
): void {
  trackEvent("error", {
    message: error.message,
    stack: error.stack?.slice(0, 500),
    name: error.name,
    url: window.location.href,
    ...context,
  });

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error("[TGMS Error]", error, context);
  }
}

/**
 * Track performance timing for a given metric
 * @param metric - Metric name (e.g., "agreement_load", "governance_map_render")
 * @param durationMs - Duration in milliseconds
 */
export function trackPerformance(
  metric: string,
  durationMs: number
): void {
  trackEvent("performance", {
    metric,
    durationMs,
    location: window.location.pathname,
  });

  if (import.meta.env.DEV) {
    console.debug(`[Performance] ${metric}: ${durationMs}ms`);
  }
}

/**
 * Mark the start of a performance measurement
 * @param label - Unique label for the measurement
 */
export function startMeasure(label: string): void {
  performanceMarkers.set(label, performance.now());
}

/**
 * End a performance measurement and track it
 * @param label - Same label used in startMeasure
 * @param metricName - Optional custom metric name (defaults to label)
 */
export function endMeasure(
  label: string,
  metricName?: string
): number {
  const startTime = performanceMarkers.get(label);
  if (!startTime) {
    console.warn(`[Telemetry] No measurement started for label: ${label}`);
    return 0;
  }

  const duration = performance.now() - startTime;
  performanceMarkers.delete(label);

  trackPerformance(metricName || label, duration);
  return duration;
}

/**
 * Calculate and return current SLO metrics based on tracked events
 * @returns SLO metrics with current values and targets
 */
export function getSLOMetrics(): SLOMetrics {
  const perfEvents = events.filter((e) => e.event === "performance");
  const durations = perfEvents
    .map((e) => e.properties?.durationMs)
    .filter((d): d is number => typeof d === "number")
    .sort((a, b) => a - b);

  // Calculate P95
  const p95Index = Math.floor(durations.length * 0.95);
  const p95LatencyMs = durations.length > 0 ? durations[p95Index] || 0 : 0;

  // Calculate error rate
  const errorCount = events.filter((e) => e.event === "error").length;
  const errorRate =
    events.length > 0 ? (errorCount / events.length) * 100 : 0;

  // Uptime is always high in demo (would come from monitoring in production)
  const uptimePercent = 99.9;

  return {
    p95LatencyMs,
    errorRate,
    uptimePercent,
    targets: {
      p95: 800, // Target: 800ms for P95 latency
      rpo: "1h", // Recovery Point Objective: 1 hour
      rto: "2h", // Recovery Time Objective: 2 hours
    },
  };
}

/**
 * Get recent telemetry events for debugging/inspection
 * @param limit - Maximum number of events to return
 * @returns Array of recent events
 */
export function getRecentEvents(limit = 50): TelemetryEvent[] {
  return events.slice(-limit);
}

/**
 * Clear all telemetry events (for testing/cleanup)
 */
export function clearTelemetry(): void {
  events.length = 0;
  performanceMarkers.clear();
}

/**
 * Export telemetry events for debugging or analysis
 * @returns All tracked events as JSON
 */
export function exportTelemetry(): string {
  return JSON.stringify(
    {
      sessionId: SESSION_ID,
      exportedAt: new Date().toISOString(),
      totalEvents: events.length,
      events,
      metrics: getSLOMetrics(),
    },
    null,
    2
  );
}

/**
 * Get session ID for correlation across requests
 */
export function getSessionId(): string {
  return SESSION_ID;
}
