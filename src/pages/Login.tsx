import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Eye, Lock, Network, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login(email || "lucia.paredes@argaseguros.com");
    navigate("/");
  };

  const sso = () => toast("SSO disponible en entorno de producción");

  const directAccess = () => {
    setEmail("lucia.paredes@argaseguros.com");
    login("lucia.paredes@argaseguros.com");
    navigate("/");
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-center bg-sidebar px-12 py-16 text-white md:flex">
        <div className="mx-auto max-w-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold leading-none">ARGA</span>
            <span className="text-xl font-medium text-sidebar-foreground">Seguros</span>
          </div>
          <div className="mt-2 text-sm text-sidebar-muted">Sistema de Gobernanza Corporativa</div>

          <div className="mt-12 space-y-5">
            {[
              { icon: Network, t: "Gobernanza conectada en tiempo real" },
              { icon: ShieldCheck, t: "Trazabilidad norma → control → evidencia" },
              { icon: Eye, t: "Auditoría nativa e inmutable" },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <b.icon className="h-5 w-5 text-white" />
                </div>
                <div className="pt-2 text-sm font-medium text-sidebar-foreground">{b.t}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-6 left-12 text-[12px] text-sidebar-muted">
          TGMS v1.0 · Entorno de demostración
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Bienvenido</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accede a tu entorno de gobernanza</p>

          <div className="my-6 h-px bg-border" />

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Usuario corporativo
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="usuario@argaseguros.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Acceder
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={sso}>
            <Building2 className="h-4 w-4" />
            Acceder con SSO Corporativo
          </Button>

          <div className="my-5 h-px bg-border" />

          <div className="text-center">
            <button
              type="button"
              onClick={directAccess}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Acceso directo (demo) →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
