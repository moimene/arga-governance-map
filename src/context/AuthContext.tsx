/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Identidad de la sesión anterior, para detectar un cambio de usuario.
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    // 1. Subscribe FIRST (sync state updates only inside the callback)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // La caché de TanStack sobrevive al cambio de sesión: RLS separa la base
      // de datos, pero no el navegador. Con dos tenants reales (ARGA y
      // Garrigues) y claves de consulta que no siempre llevan tenantId, entrar
      // como un tenant después de otro servía dato del anterior hasta el
      // siguiente refetch. Vaciar en cada cambio de identidad —incluido el
      // cierre de sesión— es la única defensa que no depende de que todas las
      // queryKeys estén bien construidas.
      const nextUserId = newSession?.user?.id ?? null;
      if (previousUserId.current !== nextUserId) {
        queryClient.clear();
        previousUserId.current = nextUserId;
      }
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    // 2. THEN read existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      previousUserId.current = existing?.user?.id ?? null;
      setSession(existing);
      setUser(existing?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    return { error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    // Defensa explícita además del onAuthStateChange: si la suscripción no
    // llegara a disparar, el dato del tenant saliente no puede quedarse.
    queryClient.clear();
    previousUserId.current = null;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        loading,
        user,
        session,
        signIn,
        signUp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
