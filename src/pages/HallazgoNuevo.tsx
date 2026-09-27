import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectHeader } from "@/components/ObjectHeader";
import { useCreateFinding } from "@/hooks/useFindings";

// MOI-149 (D-23, alta por pantalla): alta real de hallazgos GRC. Antes de
// esto, ocho tipos de registro (incl. hallazgos) solo existían sembrados: un
// grupo que empieza en blanco no tenía forma de dar de alta ninguno desde la
// aplicación.
const SEVERITY_OPTIONS = ["Crítico", "Alto", "Medio", "Bajo"];
const STATUS_OPTIONS = ["Abierto", "En remediación", "Cerrado"];

const defaultCode = () => {
  const ts = new Date().toISOString().slice(2, 19).replace(/[-:T]/g, "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `HALL-${ts}-${suffix}`;
};

export default function HallazgoNuevo() {
  const navigate = useNavigate();
  const createFinding = useCreateFinding();
  const [submitted, setSubmitted] = useState(false);
  const [code] = useState(defaultCode());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("Medio");
  const [status, setStatus] = useState("Abierto");
  const [dueDate, setDueDate] = useState("");

  const errors = useMemo(() => {
    if (!submitted) return { title: "" };
    return { title: title.trim().length < 3 ? "El título debe tener al menos 3 caracteres." : "" };
  }, [submitted, title]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (title.trim().length < 3) {
      toast.error("Revisa los campos obligatorios.");
      return;
    }
    try {
      const finding = await createFinding.mutateAsync({
        code,
        title: title.trim(),
        severity,
        status,
        due_date: dueDate || null,
      });
      toast.success("Hallazgo creado.");
      navigate(`/hallazgos/${finding.code}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo crear el hallazgo: ${message}`);
    }
  };

  return (
    <div className="mx-auto max-w-[720px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Hallazgos y Acciones", to: "/hallazgos" }, { label: "Nuevo" }]}
        title="Nuevo hallazgo"
      />

      <Card className="mt-4 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="finding-code">Código</Label>
            <Input id="finding-code" value={code} disabled className="font-mono text-xs" />
          </div>

          <div>
            <Label htmlFor="finding-title">Título *</Label>
            <Input
              id="finding-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Descripción breve del hallazgo"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "finding-title-error" : undefined}
            />
            {errors.title && (
              <p id="finding-title-error" className="mt-1 text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          <div>
            <Label htmlFor="finding-description">Descripción</Label>
            <Textarea
              id="finding-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contexto, causa y alcance (opcional, no se persiste todavía como campo propio)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="finding-severity">Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="finding-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="finding-status">Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="finding-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="finding-due">Vencimiento</Label>
            <Input id="finding-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate("/hallazgos")}>Cancelar</Button>
            <Button type="submit" disabled={createFinding.isPending} aria-busy={createFinding.isPending}>
              {createFinding.isPending ? "Guardando..." : "Crear hallazgo"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
