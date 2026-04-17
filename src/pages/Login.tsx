import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Eye, KeyRound, Lock, Network, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const DEMO_EMAIL = "demo@arga-seguros.com";
  const DEMO_PASSWORD = "TGMSdemo2026!";

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setMode("signin");
  };

  const loginAsDemo = async () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setSubmitting(true);
    const { error } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    setSubmitting(false);
    if (error) {
      toast.error(`No se pudo entrar como demo: ${error.message}`);
      return;
    }
    navigate("/");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Introduce email y contraseña");
      return;
    }
    setSubmitting(true);
    const { error } =
      mode === "signin"
        ? await signIn(email, password)
        : await signUp(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (mode === "signup") {
      toast.success("Cuenta creada. Revisa tu email si la confirmación está activada.");
    }
    navigate("/");
  };

  const sso = () => toast("SSO disponible en entorno de producción");

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
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
          TGMS v1.0 · Entorno seguro
        </div>
      </div>

      <div className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Bienvenido</h1>
          <p className="mt-1 text-sm text-muted-foreground">Accede a tu entorno de gobernanza</p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6" />
            <TabsContent value="signup" className="mt-6" />
          </Tabs>

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
                  autoComplete="email"
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
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={6}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Procesando…" : mode === "signin" ? "Acceder" : "Crear cuenta"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={sso}>
            <Building2 className="h-4 w-4" />
            Acceder con SSO Corporativo
          </Button>

          <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-foreground">Credenciales de prueba</div>
                <div className="mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                  <div>{DEMO_EMAIL}</div>
                  <div>{DEMO_PASSWORD}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={fillDemo}
                    disabled={submitting}
                  >
                    Rellenar formulario
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={loginAsDemo}
                    disabled={submitting}
                  >
                    Acceder como demo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
