import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Brain,
  Compass,
  Eye,
  Lock,
  Network,
  Scale,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  LOGIN_BRANDS,
  loginTenantMismatch,
  resolveLoginBrand,
  type LoginBrandFeature,
  type LoginBrandKey,
} from "@/lib/login-brands";
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

const ENTORNOS: LoginBrandKey[] = ["arga", "garrigues"];

export default function Login() {
  const { signIn, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [selected, setSelected] = useState<LoginBrandKey>(resolveLoginBrand(location.search).key);
  const brand = resolveLoginBrand(selected);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectEntorno = (key: LoginBrandKey) => {
    setSelected(key);
    // Limpiar inputs al alternar entorno para evitar confusión
    setEmail("");
    setPassword("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Introduce usuario y contraseña");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // La selección de entorno no es decorativa: la cuenta debe pertenecer al
    // tenant elegido. Si no, se cierra la sesión recién abierta y se explica.
    const { data: auth } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("user_id", auth.user?.id ?? "")
      .maybeSingle();
    const mismatch = loginTenantMismatch(brand, profile?.tenant_id);
    if (mismatch) {
      await logout();
      setSubmitting(false);
      setPassword("");
      toast.error(mismatch);
      return;
    }

    setSubmitting(false);
    toast.success(`Conectado al entorno: ${brand.nombre} ${brand.sufijo}`);
    navigate(brand.defaultPath);
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      {/* Panel Izquierdo: Branding del Entorno Seleccionado */}
      <div
        className="relative hidden flex-col justify-between px-12 py-16 text-white transition-all duration-300 md:flex"
        style={brand.panelBg ? { background: brand.panelBg } : undefined}
      >
        <div className="mx-auto w-full max-w-sm">
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

          <div className="mt-10 space-y-4">
            {brand.features.map((feat, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-white/5 p-3 backdrop-blur-sm border border-white/10"
              >
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

      {/* Panel Derecho: Selector de Entorno + Formulario */}
      <div className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Paso 1 · Elige el entorno
          </div>
          <div role="radiogroup" aria-label="Entorno de gobernanza" className="mt-2 grid grid-cols-2 gap-3">
            {ENTORNOS.map((key) => {
              const b = LOGIN_BRANDS[key];
              const active = selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-entorno={key}
                  onClick={() => selectEntorno(key)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    active
                      ? "border-foreground/60 bg-background shadow-sm"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: b.accentColor }}
                    />
                    <span className={cn("text-sm font-bold", active && "text-foreground")}>
                      {b.nombre}
                    </span>
                  </span>
                  <span className="text-[11px] leading-snug">{b.entorno}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Paso 2 · Identifícate
          </div>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-foreground">
            Acceso a {brand.nombre}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{brand.entorno}</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Usuario corporativo
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  className="pl-9"
                  placeholder={brand.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  className="pl-9"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              aria-busy={submitting}
              style={
                selected === "garrigues"
                  ? { backgroundColor: "var(--g-brand-3308, #004438)", color: "#fff" }
                  : undefined
              }
            >
              {submitting ? "Comprobando acceso…" : `Acceder a ${brand.nombre}`}
            </Button>
          </form>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            Entorno de demostración con datos sintéticos. El acceso es nominativo: no hay
            autoalta ni credenciales públicas. Si necesitas una cuenta, solicítala al
            administrador del entorno.
          </p>
        </div>
      </div>
    </div>
  );
}
