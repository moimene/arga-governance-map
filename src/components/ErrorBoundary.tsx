import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — React error boundary component using Garrigues UX tokens.
 * Catches render errors and displays a user-friendly error card with recovery button.
 * Uses only var(--g-*) and var(--status-*) tokens for styling.
 */
export class ErrorBoundary extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-screen items-center justify-center bg-[var(--g-surface-page)] p-4">
          <div
            className="w-full max-w-md border border-[var(--status-error)] bg-[var(--g-surface-card)] p-6"
            style={{
              borderRadius: "var(--g-radius-lg)",
              boxShadow: "var(--g-shadow-card)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex items-center justify-center h-10 w-10 bg-[var(--status-error)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertCircle className="h-6 w-6 text-[var(--g-text-inverse)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
                Ha ocurrido un error
              </h2>
            </div>
            <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
              Algo salió mal. Por favor, intenta recargar la página o ponte en contacto con soporte
              si el problema persiste.
            </p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="text-xs text-[var(--g-text-secondary)] cursor-pointer hover:text-[var(--g-text-primary)] transition-colors">
                  Ver detalles técnicos
                </summary>
                <pre className="mt-2 bg-[var(--g-surface-subtle)] p-2 text-[11px] text-[var(--g-text-secondary)] overflow-auto max-h-40 rounded"
                  style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] px-4 py-2 font-medium transition-colors hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] px-4 py-2 font-medium transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
