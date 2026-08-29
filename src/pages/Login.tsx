import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2,
  Eye,
  KeyRound,
  Lock,
  Network,
  ShieldCheck,
  User,
  Scale,
  Compass,
  Brain,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { resolveLoginBrand, type LoginBrandFeature } from "@/lib/login-brands";
import { cn } from "@/lib/utils";

function FeatureIcon({ icon }: { icon: LoginBrandFeature["icon"] }) {
  switch (icon) {
    case "network":
      return <Network className="h-5 w-5 text-white" />;
    case "shield":
      return <ShieldCheck className="h-5 w-5 text-white" />;
    case "eye":
      return <Eye className="h-5 w-5 text-white" />;
    case "scale":
      return <Scale className="h-5 w-5 text-white" />;
    case "compass":
      return <Compass className="h-5 w-5 text-white" />;
    case "brain":
      return <Brain className="h-5 w-5 text-white" />;
    default:
      return <Sparkles className="h-5 w-5 text-white" />;
  }
}

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialBrand = resolveLoginBrand(location.search);

  const [selectedTenant, setSelectedTenant] = useState<"arga" | "garrigues">(initialBrand.key);
  const brand = resolveLoginBrand(selectedTenant);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const DEMO_EMAIL = brand.demoEmail;
  const DEMO_PASSWORD = brand.demoPassword;

  const handleSelectTenant = (tenantKey: "arga" | "garrigues") => {
    setSelectedTenant(tenantKey);
    // Limpiar inputs al alternar entorno para evitar confusión
    setEmail("");
    setPassword("");
  };

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
    toast.success(`Conectado al entorno: ${brand.nombre} ${brand.sufijo}`);
    navigate(brand.defaultPath);
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
    } else {
      toast.success(`Conectado al entorno: ${brand.nombre} ${brand.sufijo}`);
    }
    navigate(brand.defaultPath);
  };

  const sso = () => toast("SSO disponible en entorno de producción");

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      {/* Panel Izquierdo: Branding del Entorno Seleccionado */}
      <div
        className="relative hidden flex-col justify-between px-12 py-16 text-white transition-all duration-300 md:flex"
        style={brand.panelBg ? { background: brand.panelBg } : undefined}
      >
        <div className="mx-auto w-full max-w-sm">
          {/* Badge del Entorno */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm">
            <span
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ backgroundColor: brand.accentColor }}
            />
            {brand.badge}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-extrabold tracking-tight leading-none">
              {brand.nombre}
            </span>
            <span className="text-xl font-medium text-white/90">{brand.sufijo}</span>
          </div>
          <div className="mt-2 text-sm text-white/70">{brand.tagline}</div>

          {/* Features del Entorno */}
          <div className="mt-10 space-y-4">
            {brand.features.map((feat, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-white/5 p-3 backdrop-blur-sm border border-white/10">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <FeatureIcon icon={feat.icon} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{feat.title}</div>
                  {feat.description && (
                    <div className="mt-0.5 text-xs text-white/70">{feat.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-sm pt-8 text-[12px] text-white/60">
          {brand.footer}
        </div>
      </div>

      {/* Panel Derecho: Formulario y Selector de Entorno */}
      <div className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Selector de Entorno Interactivo */}
          <div className="mb-6 space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Seleccionar Entorno de Gobernanza
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/50 p-1.5">
              <button
                type="button"
                onClick={() => handleSelectTenant("arga")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-semibold transition-all",
                  selectedTenant === "arga"
                    ? "bg-background text-foreground shadow-sm font-bold border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#E8112D]" />
                Grupo ARGA
              </button>
              <button
                type="button"
                onClick={() => handleSelectTenant("garrigues")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md py-2 px-3 text-xs font-semibold transition-all",
                  selectedTenant === "garrigues"
                    ? "bg-background text-foreground shadow-sm font-bold border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#004438]" />
                Garrigues
              </button>
            </div>
          </div>

          <h1 className="text-[26px] font-bold tracking-tight text-foreground">
            Acceso a {brand.nombre}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entorno {selectedTenant === "arga" ? "Corporativo Asegurador" : "de Despacho & Asesorías"}
          </p>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-5">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4" />
            <TabsContent value="signup" className="mt-4" />
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
                  placeholder={selectedTenant === "arga" ? "usuario@argaseguros.com" : "usuario@garrigues-demo.dev"}
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
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              style={selectedTenant === "garrigues" ? { backgroundColor: "var(--g-brand-3308, #004438)", color: "#fff" } : undefined}
            >
              {submitting ? "Procesando…" : mode === "signin" ? `Acceder a ${brand.nombre}` : "Crear cuenta"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />o<div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={sso}>
            <Building2 className="h-4 w-4" />
            Acceder con SSO {brand.nombre}
          </Button>

          {/* Caja de credenciales demo para el entorno seleccionado */}
          <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/40 p-4">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-foreground">
                  Acceso Rápido Demo ({brand.nombre})
                </div>
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
                    Rellenar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={loginAsDemo}
                    disabled={submitting}
                    style={selectedTenant === "garrigues" ? { backgroundColor: "var(--g-brand-3308, #004438)", color: "#fff" } : undefined}
                  >
                    Entrar como Demo
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
