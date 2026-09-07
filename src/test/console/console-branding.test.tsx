import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { TenantBranding } from '@/context/TenantBrandContext';
import { mockearModulos } from '../garrigues/_mock-restaurable';

let branding: TenantBranding | null = null;
let tenantId: string | null = '00000000-0000-0000-0000-000000000001';
const restore = await mockearModulos([
  ['@/context/TenantBrandContext', () => ({ useTenantBranding: () => branding })],
  ['@/context/TenantContext', () => ({ useTenantContext: () => ({ tenantId }) })],
]);
const { ErpConsolePanel } = await import('@/components/arga-console/ErpConsolePanel');
afterAll(restore);
afterEach(cleanup);

function mount(value: TenantBranding | null, id: string | null = '00000000-0000-0000-0000-000000000001') {
  branding = value;
  tenantId = id;
  return render(<MemoryRouter><ErpConsolePanel moduleStatus={undefined} unreadAlertsCount={null} /></MemoryRouter>);
}

// `exact` NO es opción de getByRole (es de getByText) y rompía el typecheck.
// Se retira sin aflojar nada: con `name` en string, getByRole ya exige que el
// nombre accesible coincida ENTERO, que es justo lo que este bloque comprueba.
describe('Consola — identidad del tenant en el contenido renderizado', () => {
  it('ARGA conserva exactamente su título anterior', () => {
    mount(null);
    expect(screen.getByRole('heading', { level: 2, name: 'Consola General ARGA' })).toBeTruthy();
  });

  it('Garrigues muestra su marca y no se presenta como ARGA', () => {
    mount({ nombre: 'Garrigues' }, '00000000-0000-0000-0000-000000000002');
    expect(screen.getByRole('heading', { level: 2, name: 'Consola General Garrigues' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Consola General ARGA' })).toBeNull();
  });

  it('resuelve la marca del contexto, sin sustituir un literal por otro', () => {
    mount({ nombre: 'Marca de prueba' });
    expect(screen.getByRole('heading', { name: 'Consola General Marca de prueba' })).toBeTruthy();
  });

  it('sin tenant identificado no atribuye la consola a ARGA', () => {
    mount(null, null);
    expect(screen.getByRole('heading', { name: 'Consola General' })).toBeTruthy();
  });

  it('marca pendiente o fallida de Garrigues no usa la identidad de ARGA', () => {
    mount(null, '00000000-0000-0000-0000-000000000002');
    expect(screen.getByRole('heading', { name: 'Consola General' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /ARGA/ })).toBeNull();
  });

  it('actualiza el mismo montaje cuando llega la marca', () => {
    const view = mount(null, '00000000-0000-0000-0000-000000000002');
    branding = { nombre: 'Garrigues' };
    view.rerender(<MemoryRouter><ErpConsolePanel moduleStatus={undefined} unreadAlertsCount={null} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Consola General Garrigues' })).toBeTruthy();
  });
});

describe('Consola — total de alertas medido', () => {
  function alerts(count: number | null | undefined) {
    branding = null;
    tenantId = '00000000-0000-0000-0000-000000000001';
    render(<MemoryRouter><ErpConsolePanel moduleStatus={undefined} unreadAlertsCount={count} /></MemoryRouter>);
    return screen.getByRole('link', { name: /Alertas no leídas/ });
  }

  it.each([null, undefined])('sin medición (%s) no muestra cero ni tono de éxito', (value) => {
    const row = alerts(value);
    expect(row.textContent).toContain('Alertas no medidas');
    const badge = row.querySelector('.tabular-nums')!;
    expect(badge.textContent).toBe('—');
    expect(badge.className).not.toContain('text-status-active');
  });

  it('cero medido sí es cero', () => {
    const row = alerts(0);
    expect(row.querySelector('.tabular-nums')!.textContent).toBe('0');
    expect(row.textContent).not.toContain('Alertas no medidas');
  });

  it('el total puede superar las siete filas de la lista de recientes', () => {
    expect(alerts(12).querySelector('.tabular-nums')!.textContent).toBe('12');
  });
});
