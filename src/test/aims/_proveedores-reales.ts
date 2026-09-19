// src/test/aims/_proveedores-reales.ts
//
// Los proveedores REALES de la aplicación, para renderizar una pestaña con sus
// hooks de verdad en vez de sustituirlos con `mock.module`.
//
// Por qué: `mock.module` de bun es global a la corrida, y un componente que se
// importa por primera vez DESPUÉS de que otro fichero haya mockeado y repuesto
// el mismo hook recibe el hook real aunque el fichero lo vuelva a mockear
// (medido el 2026-09-19: `tab-expediente-tecnico` + `tab-vigilancia` daban 2
// rojos «No QueryClient set» que solo desaparecían si otro fichero cargaba la
// pestaña antes). Con los proveedores reales el resultado no depende del orden.
//
// Sin sesión en el almacenamiento, `AuthProvider` no llama a la red y
// `TenantProvider` deja el tenant en null; `useMutation` no hace nada hasta que
// se le llama. Donde un test sí dispara la escritura, sustituye `supabase.from`
// en el propio objeto del cliente (ver `tab-expediente-tecnico.test.tsx`).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { TenantProvider } from "@/context/TenantContext";

export function clienteDePrueba() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function conProveedoresReales(hijo: ReactNode, qc = clienteDePrueba()) {
  return createElement(
    QueryClientProvider,
    { client: qc },
    createElement(AuthProvider, null, createElement(TenantProvider, null, hijo)),
  );
}
