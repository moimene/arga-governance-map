import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/context/TenantContext";
import * as __realModule1 from "@/integrations/supabase/client";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  invoke: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  invokedFunctions: [] as string[],
  registrationPayloads: [] as Array<Record<string, unknown>>,
  registrationError: { current: null as Error | null },
}));

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/context/TenantContext", { ...__realModule0 }],
  ["@/integrations/supabase/client", { ...__realModule1 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({ tenantId: "tenant-1" }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: mocks.upload,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
        remove: mocks.remove,
      })),
    },
    functions: { invoke: mocks.invoke },
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      refreshSession: mocks.refreshSession,
    },
  },
}));

import { useUploadConvocatoriaAttachment } from "../useConvocatorias";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useUploadConvocatoriaAttachment", () => {
  beforeEach(() => {
    mocks.upload.mockReset();
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockReset();
    mocks.remove.mockResolvedValue({ error: null });
    mocks.registrationPayloads.length = 0;
    mocks.invokedFunctions.length = 0;
    mocks.registrationError.current = null;
    mocks.invoke.mockReset();
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "live-token" } },
      error: null,
    });
    mocks.getUser.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.refreshSession.mockReset();
    mocks.refreshSession.mockResolvedValue({
      data: { session: { access_token: "refreshed-token" } },
      error: null,
    });
    mocks.invoke.mockImplementation(async (name: string, options: { body: Record<string, unknown> }) => {
      mocks.invokedFunctions.push(name);
      mocks.registrationPayloads.push(options.body);
      if (mocks.registrationError.current) {
        return { data: null, error: mocks.registrationError.current };
      }
      return {
        data: {
          attachment: {
            id: "attachment-1",
            file_name: options.body.fileName,
            file_url: options.body.storageUri,
            file_hash: options.body.expectedHashSha256,
            file_hash_sha512: options.body.expectedHashSha512,
            artifact_kind: "SUPPORTING_DOCUMENT",
            agenda_item_index: null,
            artifact_verified_at: new Date().toISOString(),
            artifact_verified_by_service: true,
            artifact_verified_size_bytes: 9,
            artifact_verified_mime_type: options.body.expectedMimeType,
          },
        },
        error: null,
      };
    });
  });

  it("no borra Storage tras una respuesta ambigua del registro servidor", async () => {
    mocks.registrationError.current = new Error("server verification failed");
    const { result } = renderHook(() => useUploadConvocatoriaAttachment(), { wrapper });
    const file = {
      name: "acuerdo.pdf",
      type: "application/pdf",
      size: 9,
      arrayBuffer: async () => new TextEncoder().encode("contenido").buffer,
    } as unknown as File;

    let mutationError: unknown = null;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          convocatoriaId: "convocatoria-1",
          file,
          intentId: "11111111-1111-4111-8111-111111111111",
        });
      } catch (e) {
        mutationError = e;
      }
    });

    expect(mutationError).toMatchObject({
      message: expect.stringContaining("server verification failed"),
    });

    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();
    const uploadedPath = mocks.upload.mock.calls[0][0];
    expect(uploadedPath).toContain(
      "convocatorias/convocatoria-1/supporting/11111111-1111-4111-8111-111111111111-",
    );
  });

  it("envía ambos hashes candidatos al servidor y consume solo su fila verificada", async () => {
    const { result } = renderHook(() => useUploadConvocatoriaAttachment(), { wrapper });
    const file = {
      name: "acuerdo.pdf",
      type: "application/pdf",
      size: 9,
      arrayBuffer: async () => new TextEncoder().encode("contenido").buffer,
    } as unknown as File;

    await act(async () => {
      await result.current.mutateAsync({
        convocatoriaId: "convocatoria-1",
        file,
        intentId: "22222222-2222-4222-8222-222222222222",
      });
    });

    expect(mocks.registrationPayloads).toHaveLength(1);
    expect(mocks.registrationPayloads[0].expectedHashSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(mocks.registrationPayloads[0].expectedHashSha512).toMatch(/^[0-9a-f]{128}$/);
    expect(mocks.registrationPayloads[0].expectedHashSha256)
      .not.toBe(mocks.registrationPayloads[0].expectedHashSha512);
    expect(mocks.registrationPayloads[0]).toMatchObject({
      expectedMimeType: "application/pdf",
    });
    expect(mocks.registrationPayloads[0]).not.toHaveProperty("artifactKind");
    expect(mocks.invokedFunctions).toEqual(["convocation-supporting-artifact-register"]);
  });
});
