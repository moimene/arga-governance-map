import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
/**
 * Aislamiento de la caché entre sesiones.
 *
 * POR QUÉ EXISTE. `logout()` era literalmente `await supabase.auth.signOut()` y
 * en todo `src/` no había ni una llamada a `queryClient.clear()`. La caché de
 * TanStack sobrevivía al cambio de sesión: RLS separa la base de datos, pero no
 * el navegador. Con dos tenants reales y varias queryKeys sin `tenantId`, entrar
 * como un tenant después de otro servía dato del anterior hasta el refetch.
 *
 * Estas pruebas son de COMPORTAMIENTO: invocan el flujo y miran la caché. No
 * comprueban que el fuente contenga la cadena "queryClient.clear", que es un
 * guard de texto y lo derrota una llamada de señuelo.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type AuthCallback = (event: string, session: unknown) => void;

let capturedCallback: AuthCallback | null = null;
const mockSignOut = vi.fn(async () => ({ error: null }));
let currentSession: unknown = null;

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCallback) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: async () => ({ data: { session: currentSession } }),
      signOut: () => mockSignOut(),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ error: null }),
    },
  },
}));

const { AuthProvider, useAuth } = await import("../AuthContext");

function sesionDe(userId: string) {
  return { user: { id: userId }, access_token: `tok-${userId}` };
}

/** Deja dato del tenant anterior en la caché para ver si sobrevive. */
function sembrarCache(qc: QueryClient) {
  qc.setQueryData(["dashboard", "kpis"], { entidades: 33 });
  qc.setQueryData(["governing_bodies", "list"], [{ id: "b1" }]);
}

function contarEntradas(qc: QueryClient) {
  return qc.getQueryCache().getAll().length;
}

let logoutFn: (() => Promise<void>) | null = null;

function Sonda() {
  const { logout } = useAuth();
  logoutFn = logout;
  return null;
}

function montar(qc: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  let r: ReturnType<typeof render>;
  act(() => {
    r = render(
    <Wrapper>
      <AuthProvider>
        <Sonda />
      </AuthProvider>
    </Wrapper>,
    );
  });
  return r!;
}

describe("AuthContext — la caché no cruza sesiones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = null;
    logoutFn = null;
    currentSession = null;
  });

  it("vacía la caché al cambiar de usuario", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentSession = sesionDe("usuario-arga");
    montar(qc);

    await waitFor(() => expect(capturedCallback).not.toBeNull());
    sembrarCache(qc);
    expect(contarEntradas(qc)).toBe(2);

    // Entra otro usuario en la misma pestaña.
    act(() => capturedCallback!("SIGNED_IN", sesionDe("usuario-garrigues")));

    expect(contarEntradas(qc)).toBe(0);
    expect(qc.getQueryData(["dashboard", "kpis"])).toBeUndefined();
  });

  it("vacía la caché al cerrar sesión", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentSession = sesionDe("usuario-arga");
    montar(qc);

    await waitFor(() => expect(capturedCallback).not.toBeNull());
    sembrarCache(qc);

    act(() => capturedCallback!("SIGNED_OUT", null));

    expect(contarEntradas(qc)).toBe(0);
  });

  it("logout() cierra sesión en Supabase Y vacía la caché", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentSession = sesionDe("usuario-arga");
    montar(qc);

    await waitFor(() => expect(logoutFn).not.toBeNull());
    sembrarCache(qc);

    await act(async () => { await logoutFn!(); });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(contarEntradas(qc)).toBe(0);
  });

  it("control negativo: un evento de la MISMA identidad no tira la caché", async () => {
    // Si vaciáramos en cada evento, un refresco de token borraría el trabajo en
    // curso del usuario. La invariante es «cambio de identidad», no «cualquier evento».
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    currentSession = sesionDe("usuario-arga");
    montar(qc);

    await waitFor(() => expect(capturedCallback).not.toBeNull());
    sembrarCache(qc);

    act(() => capturedCallback!("TOKEN_REFRESHED", sesionDe("usuario-arga")));

    expect(contarEntradas(qc)).toBe(2);
  });
});
