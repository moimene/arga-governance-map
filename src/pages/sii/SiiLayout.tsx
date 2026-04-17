import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Shield } from "lucide-react";

const STORAGE_KEY = "sii_access_confirmed";

export function SiiAccessGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const confirmed = typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEY) === "true";
    if (!confirmed) setOpen(true);
  }, [location.pathname]);

  const accept = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };
  const cancel = () => {
    setOpen(false);
    navigate("/");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) cancel(); }}>
        <DialogContent className="w-[480px] border-2 border-sii-border">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-warning-bg">
              <Lock className="h-7 w-7 text-sii-border" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-sii-foreground">Zona de acceso restringido</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              El Sistema Interno de Información (SII) opera en un entorno técnico y funcional segregado del resto del sistema. El acceso queda registrado en un log de auditoría independiente. La identidad de los denunciantes está protegida por la Ley 2/2023.
            </p>
            <div className="my-4 h-px w-full bg-border" />
            <div className="text-xs text-muted-foreground">Usted está accediendo como:</div>
            <div className="mt-1 text-sm font-bold text-foreground">Dña. Elena Navarro Pons — Investigadora SII · Cumplimiento</div>
            <div className="my-4 h-px w-full bg-border" />
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={cancel}>Cancelar</Button>
              <Button className="flex-1" onClick={accept}>Entrar a zona SII</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {!open && children}
    </>
  );
}

export function SiiHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-sii-border bg-sii-foreground px-5 text-white">
      <Shield className="h-5 w-5" />
      <div className="text-sm font-semibold">SII — Sistema Interno de Información · Canal de Denuncias Confidencial · Grupo ARGA Seguros</div>
      <div className="ml-auto inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold">
        Entorno segregado · Log independiente
      </div>
    </header>
  );
}

export function SiiLayout() {
  return (
    <SiiAccessGate>
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
        <SiiHeader />
        <div className="flex-1 border-l-4 border-l-sii-border" style={{ backgroundColor: "hsl(var(--sii-bg))" }}>
          <Outlet />
        </div>
      </div>
    </SiiAccessGate>
  );
}
