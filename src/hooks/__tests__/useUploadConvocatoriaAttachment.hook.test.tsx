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
  insertPayloads: [] as Array<Record<string, unknown>>,
  insertError: { current: null as { message: string } | null },
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
    from: vi.fn((table: string) => {
      if (table !== "attachments") throw new Error(`Unexpected table ${table}`);
      const chain = {
        insert: vi.fn((payload: Record<string, unknown>) => {
          mocks.insertPayloads.push(payload);
          return chain;
        }),
        select: vi.fn(() => chain),
        single: vi.fn(async () => {
          if (mocks.insertError.current) {
            return { data: null, error: mocks.insertError.current };
          }
          return {
            data: {
              id: "attachment-1",
              file_name: "acuerdo.pdf",
              file_url: "https://storage.test/acuerdo.pdf",
              file_hash: "hash",
            },
            error: null,
          };
        }),
      };
      return chain;
    }),
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
    mocks.insertPayloads.length = 0;
    mocks.insertError.current = null;
  });

  it("elimina el objeto de Storage si falla la insercion en attachments", async () => {
    mocks.insertError.current = { message: "insert failed" };
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
        await result.current.mutateAsync({ convocatoriaId: "convocatoria-1", file });
      } catch (e) {
        mutationError = e;
      }
    });

    expect(mutationError).toMatchObject({ message: "insert failed" });

    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
    const uploadedPath = mocks.upload.mock.calls[0][0];
    expect(mocks.remove).toHaveBeenCalledWith([uploadedPath]);
  });
});
