import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWhistleblowingReportByToken, useSendSafeInboxMessage } from "@/hooks/useWhistleblowing";
import {
  ShieldCheck,
  Lock,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronRight,
  ShieldAlert,
  Loader2,
  KeyRound,
} from "lucide-react";

export default function SiiSafeInbox() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [inputToken, setInputToken] = useState(tokenFromUrl);
  const [activeToken, setActiveToken] = useState(tokenFromUrl);
  const [newMessage, setNewMessage] = useState("");
  const [showRetaliationAlert, setShowRetaliationAlert] = useState(false);
  const [retaliationNote, setRetaliationNote] = useState("");

  const { data: report, isLoading } = useWhistleblowingReportByToken(activeToken);
  const sendMutation = useSendSafeInboxMessage();

  useEffect(() => {
    if (tokenFromUrl) {
      setInputToken(tokenFromUrl);
      setActiveToken(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  const handleLoginWithToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    setActiveToken(inputToken.trim());
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !report) return;

    try {
      await sendMutation.mutateAsync({
        reportId: report.id,
        content: newMessage.trim(),
        sender: "INFORMANTE",
      });
      setNewMessage("");
      toast.success("Mensaje enviado de forma cifrada al instructor del expediente.");
    } catch (err) {
      toast.error("Error al enviar el mensaje.");
    }
  };

  const handleReportRetaliation = async () => {
    if (!retaliationNote.trim() || !report) return;

    try {
      await sendMutation.mutateAsync({
        reportId: report.id,
        content: `[ALERTA DE REPRESALIA - LEY 2/2023]: ${retaliationNote.trim()}`,
        sender: "INFORMANTE",
      });
      setShowRetaliationAlert(false);
      setRetaliationNote("");
      toast.success("Alerta de represalia transmitida con carácter urgente al Responsable del Sistema.");
    } catch (err) {
      toast.error("Error al comunicar la represalia.");
    }
  };

  // Si no hay token activo, mostrar pantalla de login anónimo
  if (!activeToken) {
    return (
      <div className="mx-auto max-w-[600px] p-6 animate-fade-in my-12">
        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-8 text-center space-y-6">
          <div className="h-14 w-14 rounded-full bg-[var(--t-surface-subtle)] text-[var(--t-brand)] flex items-center justify-center mx-auto">
            <KeyRound className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-[var(--t-text-primary)]">
              Acceso al Safe Inbox del Informante
            </h1>
            <p className="text-xs text-[var(--t-text-secondary)] mt-1 leading-relaxed max-w-md mx-auto">
              Introduzca su <strong>Token de Acceso Seguro</strong> proporcionado al registrar la comunicación. Este acceso se rige por <strong>confidencialidad reforzada</strong>: su identidad solo es conocida por el Responsable del Sistema y la persona instructora. No es anonimato — PI-31 Anexo 1 §3.c reserva esa vía a la comunicación postal.
            </p>
          </div>

          <form onSubmit={handleLoginWithToken} className="space-y-4 max-w-sm mx-auto text-xs">
            <div>
              <input
                type="text"
                required
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Ej. SEC-9F8A-72B1-K82M"
                className="w-full px-4 py-2.5 text-center font-mono font-bold text-sm border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)] focus:border-[var(--t-border-focus)] focus:outline-none"
              />
            </div>
            <Button type="submit" className="w-full bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90">
              Acceder al Buzón Seguro
            </Button>
          </form>

          <div className="border-t border-[var(--t-border-default)] pt-4 text-xs text-[var(--t-text-secondary)]">
            ¿No dispone de un token?{" "}
            <Link to="/sii/nuevo" className="text-[var(--t-brand)] font-semibold hover:underline">
              Presentar una nueva comunicación
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 text-[var(--t-text-secondary)]">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando buzón cifrado...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-[600px] p-6 my-12 text-center space-y-4">
        <Card className="border-[var(--status-error)] p-8 space-y-4">
          <AlertTriangle className="h-10 w-10 text-[var(--status-error)] mx-auto" />
          <h2 className="text-lg font-bold text-[var(--t-text-primary)]">Token no encontrado o caducado</h2>
          <p className="text-xs text-[var(--t-text-secondary)]">
            No se ha localizado ningún expediente activo con la credencial <code>{activeToken}</code>. Verifique que no haya caracteres erróneos.
          </p>
          <Button variant="outline" onClick={() => setActiveToken("")}>
            Probar con otro Token
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] p-6 animate-fade-in space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-xs text-[var(--t-text-secondary)]">
            <Link to="/sii" className="hover:text-[var(--t-text-primary)]">SII</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Safe Inbox</span>
            <ChevronRight className="h-3 w-3" />
            <span className="font-mono font-bold text-[var(--t-text-primary)]">{report.code}</span>
          </nav>
          <h1 className="text-xl font-bold text-[var(--t-text-primary)] flex items-center gap-2">
            <Lock className="h-5 w-5 text-[var(--t-brand)]" />
            Safe Inbox — Expediente {report.code}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRetaliationAlert(true)}
            className="border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--status-error)]/10 text-xs gap-1"
          >
            <ShieldAlert className="h-3.5 w-3.5" /> Comunicar Sospecha de Represalia
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setActiveToken("")} className="text-xs text-[var(--t-text-secondary)]">
            Cerrar Sesión Segura
          </Button>
        </div>
      </div>

      {/* Grid: Resumen del Caso & Mensajería */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna Izquierda: Información de Estado y Plazos Legales */}
        <div className="md:col-span-1 space-y-4">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5 space-y-4 text-xs">
            <div className="font-bold text-sm uppercase text-[var(--t-text-primary)] border-b border-[var(--t-border-default)] pb-2 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--t-brand)]" />
              Garantías del Expediente
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Estado:</span>
              <span className="font-bold text-[var(--t-brand)]">{report.status.replace(/_/g, " ")}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Modalidad:</span>
              <span className="text-[var(--t-text-primary)]">{report.anonymityMode === "ANONIMO_ESTRICTO" ? "Anónimo Estricto" : "Confidencial"}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Materia / Categoría:</span>
              <span className="font-medium text-[var(--t-text-primary)]">{report.category}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Investigadora Asignada:</span>
              <span className="font-medium text-[var(--t-text-primary)]">{report.assignedInvestigatorName}</span>
            </div>

            {/* Reloj Legal */}
            <div className="p-3 bg-[var(--t-surface-subtle)] rounded border border-[var(--t-border-default)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[11px] text-[var(--t-brand)] flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Plazo Legal de Resolución
                </span>
                <span className="text-[10px] font-bold text-[var(--status-success)]">3 MESES</span>
              </div>
              <p className="text-[11px] text-[var(--t-text-secondary)] leading-relaxed">
                Fecha límite ordinaria: <strong>{new Date(report.resolutionDeadline).toLocaleDateString("es-ES")}</strong>.
              </p>
              {report.extensionApproved && (
                <div className="text-[10px] font-semibold text-[var(--status-warning)] bg-[var(--status-warning)]/10 p-2 rounded">
                  Prórroga formal de 3 meses activada por complejidad probatoria.
                </div>
              )}
            </div>

            <div className="text-[11px] text-[var(--t-text-secondary)] italic border-t border-[var(--t-border-default)] pt-2">
              Toda comunicación en este buzón goza de protección legal plena y no puede ser utilizada en su perjuicio (Art. 36 Ley 2/2023).
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Hilo de Mensajes Cifrado */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] flex flex-col h-[550px] overflow-hidden">
            {/* Header del Chat */}
            <div className="px-5 py-3 border-b border-[var(--t-border-default)] bg-[var(--t-surface-subtle)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[var(--t-brand)]" />
                <span className="font-bold text-[var(--t-text-primary)]">
                  Canal de Diálogo Bidireccional (Ley 2/2023 Art. 9)
                </span>
              </div>
              <span className="text-[10px] font-mono text-[var(--t-text-secondary)]">Entorno de validación funcional</span>
            </div>

            {/* Mensajes */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
              {report.messages.length === 0 ? (
                <div className="text-center text-[var(--t-text-secondary)] py-12">
                  No hay mensajes registrados en este canal todavía.
                </div>
              ) : (
                report.messages.map((m) => {
                  const isInformant = m.sender === "INFORMANTE";
                  const isSystem = m.sender === "SISTEMA";

                  if (isSystem) {
                    return (
                      <div key={m.id} className="p-3 bg-[var(--t-surface-subtle)] border border-[var(--t-border-default)] rounded text-center text-[11px] text-[var(--t-text-secondary)]">
                        <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-[var(--status-success)]" />
                        {m.content}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isInformant ? "items-end" : "items-start"}`}
                    >
                      <div className="text-[10px] font-semibold text-[var(--t-text-secondary)] mb-1 px-1">
                        {m.senderAlias ?? (isInformant ? "Usted (Informante)" : "Investigadora SII")} · {new Date(m.sentAt).toLocaleString("es-ES")}
                      </div>
                      <div
                        className={`p-3.5 rounded-lg max-w-[85%] leading-relaxed ${
                          isInformant
                            ? "bg-[var(--t-brand)] text-white"
                            : "bg-[var(--t-surface-subtle)] text-[var(--t-text-primary)] border border-[var(--t-border-default)]"
                        }`}
                      >
                        <p>{m.content}</p>
                        {m.hasAttachment && (
                          <div className="mt-2 pt-2 border-t border-white/20 text-[11px] flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>Adjunto: {m.attachmentName}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Formulario de Envío de Mensaje */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--t-border-default)] bg-[var(--t-surface-card)] flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escriba su mensaje, aclaración o respuesta a requerimientos..."
                className="flex-1 px-3 py-2 border border-[var(--t-border-default)] rounded text-xs bg-[var(--t-surface-card)] text-[var(--t-text-primary)] focus:border-[var(--t-border-focus)] focus:outline-none"
              />
              <Button type="submit" disabled={sendMutation.isPending || !newMessage.trim()} className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90 gap-1 text-xs shrink-0">
                <Send className="h-3.5 w-3.5" /> Enviar
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Modal de Alerta de Represalia */}
      {showRetaliationAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="border-[var(--status-error)] bg-[var(--t-surface-card)] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[var(--t-border-default)] bg-[var(--status-error)]/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--status-error)]">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-bold text-sm">Comunicar Sospecha de Represalia (Ley 2/2023)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRetaliationAlert(false)}
                className="text-[var(--t-text-secondary)] hover:text-[var(--t-text-primary)]"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[var(--t-text-secondary)] leading-relaxed">
                El <strong>Artículo 36 de la Ley 2/2023</strong> prohíbe de forma absoluta cualquier acto constitutivo de represalia (sanciones, traslados forzosos, evaluaciones desfavorables, aislamiento o trato desfavorable). Esta alerta se eleva de manera inmediata y preferente.
              </p>
              <div>
                <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">
                  Describa los hechos que considera una represalia:
                </label>
                <textarea
                  rows={4}
                  value={retaliationNote}
                  onChange={(e) => setRetaliationNote(e.target.value)}
                  placeholder="Detalle la conducta, fecha, personas involucradas y efecto en su situación laboral o profesional..."
                  className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--t-border-default)] pt-4">
                <Button variant="outline" onClick={() => setShowRetaliationAlert(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleReportRetaliation}
                  disabled={!retaliationNote.trim()}
                  className="bg-[var(--status-error)] text-white hover:bg-[var(--status-error)]/90"
                >
                  Transmitir Alerta Urgente
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
