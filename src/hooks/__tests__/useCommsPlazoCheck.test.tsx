import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCommsPlazoCheck, type CommunicationDraft } from '../useCommsPlazoCheck';

vi.mock('@/hooks/useNormativeFramework', () => ({
  useEntityNormativeProfile: () => ({
    data: { tipo_social: 'SA', es_cotizada: false, jurisdiction: 'ES' },
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const baseDraft: CommunicationDraft = {
  tipo_comunicacion: 'CONVOCATORIA',
  organo_tipo: 'JUNTA_GENERAL',
  entity_id: 'e1',
  meeting_date: new Date('2026-07-01T10:00:00Z'),
  agreement_date: null,
  fecha_programada: null,
  template_id: null,
};

describe('useCommsPlazoCheck', () => {
  it('returns isValid=false if fecha_programada < min_envio_date', () => {
    const { result } = renderHook(
      () => useCommsPlazoCheck({ ...baseDraft, fecha_programada: new Date('2026-06-15T10:00:00Z') }),
      { wrapper },
    );
    expect(result.current.isValid).toBe(false);
    expect(result.current.reason).toMatch(/Plazo legal/);
  });

  it('returns isValid=true if fecha_programada respects 30 días JG SA', () => {
    const { result } = renderHook(
      () => useCommsPlazoCheck({ ...baseDraft, fecha_programada: new Date('2026-05-25T10:00:00Z') }),
      { wrapper },
    );
    expect(result.current.isValid).toBe(true);
  });

  it('returns isValid=false with "Fecha sin programar" when fecha_programada is null', () => {
    const { result } = renderHook(() => useCommsPlazoCheck(baseDraft), { wrapper });
    expect(result.current.isValid).toBe(false);
    expect(result.current.reason).toMatch(/Fecha sin programar/);
  });
});
