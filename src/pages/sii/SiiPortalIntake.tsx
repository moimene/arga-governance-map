import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEntitiesList } from "@/hooks/useEntities";
import { useCreateWhistleblowingReport } from "@/hooks/useWhistleblowing";
import { sanitizeMetadata, type WhistleblowingChannel, type AnonymityMode, type WhistleblowingSeverity } from "@/lib/sii/whistleblowing-engine";
import {
  ShieldCheck,
  Lock,
  EyeOff,
  UserCheck,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Phone,
  Users,
  Mail,
  Globe,
} from "lucide-react";

export default function SiiPortalIntake() {
  const navigate = useNavigate();
  const { data: entities = [] } = useEntitiesList();
  const createMutation = useCreateWhistleblowingReport();

  // Wizard Steps: 1. Modalidad -> 2. Hechos y Canal -> 3. Evidencias -> 4. Confirmación/Credencial
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [anonymityMode, setAnonymityMode] = useState<AnonymityMode>("ANONIMO_ESTRICTO");
  const [channel, setChannel] = useState<WhistleblowingChannel>("WEB_ANONIMO");
  const [pseudonym, setPseudonym] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  
  const [entityId, setEntityId] = useState("");
  const [category, setCategory] = useState("Corrupción y Fraude");
  const [severity, setSeverity] = useState<WhistleblowingSeverity>("GRAVE");
  const [summary, setSummary] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  
  // Perimeter checkboxes
  const [affectsPersonalData, setAffectsPersonalData] = useState(false);
  const [affectsICT, setAffectsICT] = useState(false);
  const [affectsAI, setAffectsAI] = useState(false);
  const [isBoardOrExecutiveTarget, setIsBoardOrExecutiveTarget] = useState(false);

  // Files
  const [files, setFiles] = useState<Array<{ name: string; size: number }>>([]);
  const [newFileName, setNewFileName] = useState("");

  // Result
  const [createdCode, setCreatedCode] = useState("");
  const [createdToken, setCreatedToken] = useState("");

  const handleAddFile = () => {
    if (!newFileName.trim()) return;
    setFiles([...files, { name: newFileName.trim(), size: 1024 * 45 }]);
    setNewFileName("");
    toast.success("Evidencia adjuntada y preparada para saneamiento de metadatos.");
  };

  const handleRemoveFile = (idx: number) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSubmitReport = async () => {
    if (!summary.trim() || !detailedDescription.trim()) {
      toast.error("Por favor, complete el resumen y la descripción detallada de los hechos.");
      return;
    }

    const selectedEntity = entities.find((e) => e.id === entityId) ?? entities[0];

    try {
      const res = await createMutation.mutateAsync({
        channel,
        anonymityMode,
        informantContact: anonymityMode === "CONFIDENCIAL_IDENTIFICADO" ? {
          pseudonym: pseudonym || "Informante Confidencial",
          emailNotificationOnly: notificationEmail || undefined,
        } : null,
        entityId: selectedEntity?.id ?? "6d7ed736-f263-4531-a59d-c6ca0cd41602",
        entityName: selectedEntity?.common_name ?? selectedEntity?.legal_name ?? "ARGA Seguros S.A.",
        jurisdiction: selectedEntity?.jurisdiction ?? "ES",
        category,
        severity,
        summary,
        detailedDescription,
        affectsAI,
        affectsICT,
        affectsPersonalData,
        isBoardOrExecutiveTarget,
        attachments: files,
      });

      setCreatedCode(res.code);
      setCreatedToken(res.trackingToken);
      setStep(4);
      toast.success("Comunicación registrada con éxito conforme a la Ley 2/2023.");
    } catch (err) {
      toast.error("Error al registrar la comunicación.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Credencial copiada al portapapeles.");
  };

  return (
    <div className="mx-auto max-w-[1000px] p-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-[var(--t-text-secondary)]">
        <Link to="/sii" className="hover:text-[var(--t-text-primary)]">SII — Canal Interno</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[var(--t-text-primary)] font-semibold">Registro de Nueva Comunicación</span>
      </nav>

      {/* Header Garantías Legales */}
      <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-6 w-6 text-[var(--t-brand)]" />
              <h1 className="text-xl font-bold text-[var(--t-text-primary)]">
                Portal de Recepción del Sistema Interno de Información (SII)
              </h1>
            </div>
            <p className="text-xs text-[var(--t-text-secondary)] leading-relaxed max-w-3xl">
              Canal regulado por la <strong>Ley 2/2023</strong> y la <strong>Directiva (UE) 2019/1937</strong>. Aplica <strong>confidencialidad reforzada</strong> sobre la identidad del informante, acuse de recibo en 7 días naturales (art. 9.2.c) y protección frente a represalias (art. 36).
            </p>
          </div>
          <span className="px-3 py-1 bg-[var(--t-surface-subtle)] text-[var(--t-brand)] text-xs font-bold rounded-full border border-[var(--t-border-default)] shrink-0">
            Art. 31 bis CP & Ley 2/2023
          </span>
        </div>

        {/* Stepper Progress */}
        <div className="mt-6 grid grid-cols-4 gap-2 text-xs border-t border-[var(--t-border-default)] pt-4">
          {[
            { n: 1, label: "1. Modalidad & Anonimato" },
            { n: 2, label: "2. Hechos & Canal" },
            { n: 3, label: "3. Evidencias & Saneamiento" },
            { n: 4, label: "4. Credencial Segura" },
          ].map((s) => (
            <div
              key={s.n}
              className={`p-2 rounded border text-center font-medium transition-all ${
                step === s.n
                  ? "bg-[var(--t-brand)] text-white border-[var(--t-brand)]"
                  : step > s.n
                  ? "bg-[var(--t-surface-subtle)] text-[var(--t-text-primary)] border-[var(--t-border-default)]"
                  : "bg-[var(--t-surface-muted)] text-[var(--t-text-secondary)] border-transparent"
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </Card>

      {/* STEP 1: Modalidad y Anonimato */}
      {step === 1 && (
        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[var(--t-text-primary)] uppercase tracking-wider mb-2">
              Paso 1: Seleccione la modalidad de comunicación
            </h2>
            <p className="text-xs text-[var(--t-text-secondary)]">
              Usted decide si desea formular la comunicación de manera estrictamente anónima o confidencial identificada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setAnonymityMode("ANONIMO_ESTRICTO")}
              className={`p-5 rounded-lg border-2 cursor-pointer transition-all ${
                anonymityMode === "ANONIMO_ESTRICTO"
                  ? "border-[var(--t-brand)] bg-[var(--t-surface-subtle)]/40 shadow-sm"
                  : "border-[var(--t-border-default)] hover:border-[var(--t-border-focus)] bg-[var(--t-surface-card)]"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <EyeOff className="h-5 w-5 text-[var(--t-brand)]" />
                <h3 className="font-bold text-sm text-[var(--t-text-primary)]">Comunicación Anónima Estricta</h3>
              </div>
              <p className="text-xs text-[var(--t-text-secondary)] leading-relaxed mb-3">
                No se registra IP, huella de dispositivo ni datos de contacto. Se le entregará una <strong>credencial de alta entropía</strong> para acceder al Safe Inbox y mantener diálogo bidireccional seguro.
              </p>
              <span className="text-[11px] font-semibold text-[var(--status-success)] flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Máxima protección técnica
              </span>
            </div>

            <div
              onClick={() => setAnonymityMode("CONFIDENCIAL_IDENTIFICADO")}
              className={`p-5 rounded-lg border-2 cursor-pointer transition-all ${
                anonymityMode === "CONFIDENCIAL_IDENTIFICADO"
                  ? "border-[var(--t-brand)] bg-[var(--t-surface-subtle)]/40 shadow-sm"
                  : "border-[var(--t-border-default)] hover:border-[var(--t-border-focus)] bg-[var(--t-surface-card)]"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <Lock className="h-5 w-5 text-[var(--t-brand)]" />
                <h3 className="font-bold text-sm text-[var(--t-text-primary)]">Confidencial con Identificación</h3>
              </div>
              <p className="text-xs text-[var(--t-text-secondary)] leading-relaxed mb-3">
                Su identidad queda custodiada en una zona encriptada accesible únicamente por la Investigadora SII. No se comunica a RR.HH., evaluados ni terceros sin su autorización expresa.
              </p>
              <span className="text-[11px] font-semibold text-[var(--t-text-secondary)] flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Protección legal Ley 2/2023
              </span>
            </div>
          </div>

          {anonymityMode === "CONFIDENCIAL_IDENTIFICADO" && (
            <div className="p-4 bg-[var(--t-surface-subtle)] border border-[var(--t-border-default)] rounded-md space-y-3 animate-fade-in text-xs">
              <div className="font-bold text-[var(--t-text-primary)]">Datos de Contacto para Avisos Neutros</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[var(--t-text-secondary)] mb-1">
                    Seudónimo o Nombre
                  </label>
                  <input
                    type="text"
                    value={pseudonym}
                    onChange={(e) => setPseudonym(e.target.value)}
                    placeholder="Ej. Empleado Área Operaciones"
                    className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[var(--t-text-secondary)] mb-1">
                    Correo para avisos neutros (sin contenido sensible)
                  </label>
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="informante.aviso@empresa.com"
                    className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end border-t border-[var(--t-border-default)] pt-4">
            <Button onClick={() => setStep(2)} className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90">
              Continuar a Hechos y Canal <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: Hechos y Canal */}
      {step === 2 && (
        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[var(--t-text-primary)] uppercase tracking-wider mb-2">
              Paso 2: Canal de recepción y hechos comunicados
            </h2>
            <p className="text-xs text-[var(--t-text-secondary)]">
              La Ley 2/2023 exige recepción omnicanal escrita y verbal (reunión presencial, voz, web o correo).
            </p>
          </div>

          {/* Selector de Canal */}
          <div>
            <label className="block text-xs font-bold uppercase text-[var(--t-text-secondary)] mb-2">
              Canal de Entrada de la Comunicación
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {[
                { id: "WEB_ANONIMO", label: "Formulario Web Seguro", icon: Globe },
                { id: "TELEFONO_VOZ", label: "Teléfono / Mensaje de Voz", icon: Phone },
                { id: "REUNION_PRESENCIAL", label: "Reunión Presencial", icon: Users },
                { id: "EMAIL_CONFIDENCIAL", label: "Correo Confidencial", icon: Mail },
                { id: "POSTAL", label: "Correo Postal / Registro", icon: FileText },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChannel(c.id as WhistleblowingChannel)}
                    className={`p-3 rounded border flex flex-col items-center gap-1.5 text-center transition-all ${
                      channel === c.id
                        ? "bg-[var(--t-surface-subtle)] border-[var(--t-brand)] text-[var(--t-brand)] font-bold shadow-sm"
                        : "bg-[var(--t-surface-card)] border-[var(--t-border-default)] text-[var(--t-text-secondary)] hover:bg-[var(--t-surface-subtle)]/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">
                Entidad del Grupo Afectada
              </label>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
              >
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.common_name ?? ent.legal_name} ({ent.jurisdiction})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">
                Categoría / Materia
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
              >
                <option value="Corrupción y Fraude">Corrupción, Fraude y Soborno (Art. 31 bis CP)</option>
                <option value="Conflicto de Interés y Operación Irregular">Conflicto de Interés / Operación Irregular</option>
                <option value="Privacidad y Brecha de Datos RGPD">Privacidad y Brecha de Seguridad (RGPD)</option>
                <option value="Incidente TIC / Resiliencia DORA">Incidente Tecnológico / Ciberseguridad (DORA)</option>
                <option value="Sesgo Algorítmico y Gobernanza de IA">Inteligencia Artificial / Sesgo Algorítmico (AIMS 360)</option>
                <option value="Infracción Laboral y Acoso">Infracción Laboral, Acoso o Discriminación</option>
                <option value="Irregularidad en Contratación de Terceros">Terceros y Cadena de Suministro</option>
              </select>
            </div>
          </div>

          <div className="text-xs space-y-4">
            <div>
              <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">
                Resumen Ejecutivo de los Hechos (Sin datos identificativos innecesarios)
              </label>
              <input
                type="text"
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Ej. Presunta irregularidad en licitación de servicios TIC favoreciendo a un proveedor."
                className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">
                Descripción Detallada, Fechas y Diligencias Afectadas
              </label>
              <textarea
                rows={5}
                required
                value={detailedDescription}
                onChange={(e) => setDetailedDescription(e.target.value)}
                placeholder="Describa los hechos con la mayor precisión posible: fechas, departamentos implicados, importes, sistemas afectados o personas involucradas."
                className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)] leading-relaxed"
              />
            </div>

            {/* Checkboxes de Perímetro y Subexpedientes */}
            <div className="p-4 bg-[var(--t-surface-subtle)] border border-[var(--t-border-default)] rounded-md space-y-2">
              <div className="font-bold text-[var(--t-brand)] mb-1">
                Desencadenantes de Perímetro Regulatorio (Subexpedientes Autónomos)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affectsPersonalData}
                    onChange={(e) => setAffectsPersonalData(e.target.checked)}
                    className="accent-[var(--t-brand)]"
                  />
                  <span>Afecta a datos personales o brecha de seguridad (RGPD)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affectsICT}
                    onChange={(e) => setAffectsICT(e.target.checked)}
                    className="accent-[var(--t-brand)]"
                  />
                  <span>Afecta a infraestructura TIC o terceros esenciales (DORA)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affectsAI}
                    onChange={(e) => setAffectsAI(e.target.checked)}
                    className="accent-[var(--t-brand)]"
                  />
                  <span>Involucra modelos o sistemas de Inteligencia Artificial (AIMS 360)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBoardOrExecutiveTarget}
                    onChange={(e) => setIsBoardOrExecutiveTarget(e.target.checked)}
                    className="accent-[var(--t-brand)]"
                  />
                  <span>Afecta a miembros del Consejo de Administración o Alta Dirección</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-between border-t border-[var(--t-border-default)] pt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Modalidad
            </Button>
            <Button onClick={() => setStep(3)} className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90">
              Continuar a Evidencias <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 3: Evidencias y Saneamiento */}
      {step === 3 && (
        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-6">
          <div>
            <h2 className="text-sm font-bold text-[var(--t-text-primary)] uppercase tracking-wider mb-2">
              Paso 3: Aportación de evidencias y saneamiento de metadatos
            </h2>
            <p className="text-xs text-[var(--t-text-secondary)] leading-relaxed">
              Todos los archivos adjuntados se someten a un proceso automático de <strong>eliminación de metadatos EXIF, autor y rutas locales</strong> para impedir la reidentificación técnica involuntaria.
            </p>
          </div>

          {/* Formulario de carga de prueba */}
          <div className="border-2 border-dashed border-[var(--t-border-default)] p-6 rounded-lg text-center bg-[var(--t-surface-subtle)]/30 space-y-3 text-xs">
            <Upload className="h-8 w-8 mx-auto text-[var(--t-brand)]" />
            <div className="font-bold text-[var(--t-text-primary)]">
              Adjuntar documentos, actas, transcripciones o extractos probatorios
            </div>
            <p className="text-[11px] text-[var(--t-text-secondary)] max-w-md mx-auto">
              Formatos aceptados: PDF, DOCX, XLSX, PNG, JPG, MP3, WAV. Máx 50MB por archivo.
            </p>
            <div className="flex max-w-md mx-auto gap-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Nombre del documento (ej. Extracto_Contrato_TIC.pdf)"
                className="flex-1 px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-xs text-[var(--t-text-primary)]"
              />
              <Button type="button" size="sm" onClick={handleAddFile} className="bg-[var(--t-brand)] text-white">
                Adjuntar
              </Button>
            </div>
          </div>

          {/* Lista de Archivos y Saneamiento */}
          {files.length > 0 && (
            <div className="space-y-2 text-xs">
              <div className="font-bold uppercase text-[var(--t-text-secondary)]">Evidencias Preparadas ({files.length})</div>
              <div className="divide-y divide-[var(--t-border-default)] border border-[var(--t-border-default)] rounded overflow-hidden">
                {files.map((f, idx) => {
                  const sanitized = sanitizeMetadata(f.name);
                  return (
                    <div key={idx} className="p-3 bg-[var(--t-surface-card)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-[var(--t-brand)] shrink-0" />
                        <div>
                          <span className="font-bold text-[var(--t-text-primary)] block">{f.name}</span>
                          <span className="text-[11px] text-[var(--status-success)] flex items-center gap-1 font-mono">
                            <CheckCircle2 className="h-3 w-3" /> Metadatos purgados → {sanitized.sanitizedFilename}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-[var(--status-error)] hover:underline font-semibold"
                      >
                        Eliminar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between border-t border-[var(--t-border-default)] pt-4">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Hechos
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={createMutation.isPending}
              className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90"
            >
              {createMutation.isPending ? "Registrando con sellado EAD..." : "Firmar y Registrar Comunicación"}
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 4: Confirmación y Credencial Segura */}
      {step === 4 && (
        <Card className="border-[var(--status-success)] bg-[var(--t-surface-card)] p-8 space-y-6 text-center animate-fade-in">
          <div className="h-14 w-14 rounded-full bg-[var(--status-success)]/10 text-[var(--status-success)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[var(--t-text-primary)]">
              Comunicación Registrada Oficialmente en el SII
            </h2>
            <p className="text-xs text-[var(--t-text-secondary)] mt-1 max-w-lg mx-auto leading-relaxed">
              Su comunicación queda <strong>registrada y pendiente de decisión sobre su admisión</strong>. Se ha activado el <strong>plazo de acuse de recibo de 7 días naturales</strong> (art. 9.2.c). La admisión a trámite es una decisión posterior de la persona instructora.
            </p>
          </div>

          {/* Box de Credencial Segura */}
          <div className="p-6 bg-[var(--t-surface-subtle)] border-2 border-[var(--t-brand)] rounded-lg max-w-md mx-auto space-y-4 text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">
                Código Oficial del Expediente:
              </span>
              <span className="font-mono text-base font-bold text-[var(--t-brand)]">
                {createdCode}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">
                Token de Acceso Seguro (Safe Inbox):
              </span>
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="font-mono text-lg font-bold text-[var(--t-text-primary)] bg-[var(--t-surface-card)] px-3 py-1.5 rounded border border-[var(--t-border-default)]">
                  {createdToken}
                </span>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(createdToken)} className="shrink-0 gap-1">
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
            </div>

            <div className="text-[11px] text-[var(--status-warning)] bg-[var(--status-warning)]/10 p-2.5 rounded flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Guarde este token en un lugar seguro.</strong> Es la única forma de acceder al Safe Inbox para consultar requerimientos, aportar nuevas pruebas y comprobar el estado de su caso.
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-3 border-t border-[var(--t-border-default)] pt-6">
            <Button variant="outline" onClick={() => navigate("/sii")}>
              Ir al Dashboard SII
            </Button>
            <Button
              onClick={() => navigate(`/sii/buzon?token=${encodeURIComponent(createdToken)}`)}
              className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90 gap-1"
            >
              Entrar al Safe Inbox <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
