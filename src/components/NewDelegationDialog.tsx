import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useEntitiesList } from "@/hooks/useEntities";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { useCreateDelegation } from "@/hooks/useDelegations";

// MOI-149 · D-23: alta por pantalla para `delegations`. `code`/`slug` se
// generan en el hook (UNIQUE global, no por tenant). El grantor y el
// delegado se eligen del censo del propio tenant (no hay personas ajenas
// que ofrecer: RLS ya acota `usePersonasCanonical` a `tenant_id` de sesión).
export function NewDelegationDialog() {
  const [open, setOpen] = useState(false);
  const [entityId, setEntityId] = useState<string>("");
  const [grantorId, setGrantorId] = useState<string>("");
  const [delegateId, setDelegateId] = useState<string>("");
  const [delegationType, setDelegationType] = useState("");
  const [scope, setScope] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: entities = [] } = useEntitiesList();
  const { data: personas = [] } = usePersonasCanonical();
  const createDelegation = useCreateDelegation();

  const reset = () => {
    setEntityId("");
    setGrantorId("");
    setDelegateId("");
    setDelegationType("");
    setScope("");
    setStartDate("");
    setEndDate("");
  };

  const canSubmit = entityId && grantorId && delegateId && delegationType.trim() && scope.trim() && startDate;

  const handleSubmit = async () => {
    const delegate = personas.find((p) => p.id === delegateId);
    try {
      await createDelegation.mutateAsync({
        entity_id: entityId,
        grantor_id: grantorId,
        delegate_id: delegateId,
        delegate_name: delegate?.full_name ?? "delegado",
        delegation_type: delegationType.trim(),
        scope: scope.trim(),
        start_date: startDate,
        end_date: endDate || null,
      });
      toast.success("Delegación creada");
      reset();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear la delegación");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />Nueva delegación
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva delegación de poderes</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Entidad</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger><SelectValue placeholder="Selecciona entidad" /></SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.common_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Otorgante</Label>
            <Select value={grantorId} onValueChange={setGrantorId}>
              <SelectTrigger><SelectValue placeholder="Quién otorga el poder" /></SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Apoderado</Label>
            <Select value={delegateId} onValueChange={setDelegateId}>
              <SelectTrigger><SelectValue placeholder="Quién recibe el poder" /></SelectTrigger>
              <SelectContent>
                {personas.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de delegación</Label>
            <Input value={delegationType} onChange={(e) => setDelegationType(e.target.value)} placeholder="Ej. Poder mercantil general" />
          </div>
          <div>
            <Label>Ámbito / facultades</Label>
            <Textarea value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Describe el alcance del poder" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha de inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Fecha de fin (opcional)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!canSubmit || createDelegation.isPending} onClick={handleSubmit}>
            {createDelegation.isPending ? "Guardando…" : "Crear delegación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
