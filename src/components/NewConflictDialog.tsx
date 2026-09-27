import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { useCreateConflict } from "@/hooks/useConflicts";

// MOI-149 · D-23: alta por pantalla para `conflicts_of_interest`. La persona
// se elige del censo del propio tenant (RLS ya acota `usePersonasCanonical`
// a `tenant_id` de sesión, así que nunca se ofrece a alguien de otro grupo).
export function NewConflictDialog() {
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState<string>("");
  const [conflictType, setConflictType] = useState<"Permanente" | "Situacional" | "">("");
  const [description, setDescription] = useState("");

  const { data: personas = [] } = usePersonasCanonical();
  const createConflict = useCreateConflict();

  const reset = () => {
    setPersonId("");
    setConflictType("");
    setDescription("");
  };

  const canSubmit = personId && conflictType && description.trim();

  const handleSubmit = async () => {
    if (!conflictType) return;
    try {
      await createConflict.mutateAsync({
        person_id: personId,
        conflict_type: conflictType,
        description: description.trim(),
      });
      toast.success("Conflicto de interés declarado");
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo declarar el conflicto");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />Declarar conflicto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Declarar conflicto de interés</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Persona</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue placeholder="Quién declara el conflicto" /></SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={conflictType} onValueChange={(v) => setConflictType(v as "Permanente" | "Situacional")}>
              <SelectTrigger><SelectValue placeholder="Duración del conflicto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Permanente">Permanente</SelectItem>
                <SelectItem value="Situacional">Situacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe la naturaleza del conflicto" />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!canSubmit || createConflict.isPending} onClick={handleSubmit}>
            {createConflict.isPending ? "Guardando…" : "Declarar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
