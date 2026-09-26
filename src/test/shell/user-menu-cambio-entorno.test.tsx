// MOI-134 — El menú de usuario no debe ofrecer un cambio de entorno que no
// lleve de vuelta al tenant de la sesión. Para ARGA y Garrigues (los dos
// entornos que se alternan entre sí) el destino no cambia; para un tenant
// fuera de esos dos (p.ej. el grupo nuevo, …0003) la entrada se oculta:
// no hay ningún entorno "propio" al que ese destino pudiera llevar.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { mockearModulos } from "../garrigues/_mock-restaurable";

// jsdom no implementa PointerEvent (Radix abre el DropdownMenu por
// `pointerdown`, no por `click`): sin esto, testing-library cae a un `Event`
// base que no lleva `button`/`ctrlKey` y el menú nunca se abre.
if (typeof (window as unknown as { PointerEvent?: unknown }).PointerEvent === "undefined") {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}
// `setup.ts` no expone `getComputedStyle` en `globalThis` (solo en `window`),
// y Radix lo llama directamente sin prefijo al posicionar el menú.
if (typeof globalThis.getComputedStyle === "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}

let tenantId: string | null = "00000000-0000-0000-0000-000000000001";

const restore = await mockearModulos([
  [
    "@/context/AuthContext",
    () => ({ useAuth: () => ({ user: { email: "demo@test.dev" }, logout: async () => {} }) }),
  ],
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId, roleCode: "SECRETARIO" }) })],
  ["@/context/TenantBrandContext", () => ({ useTenantBranding: () => null })],
  [
    "@/hooks/useCurrentUser",
    () => ({ useCurrentUserRole: () => ({ primaryRole: "SECRETARIO", displayName: "Usuario de prueba" }) }),
  ],
]);

const { UserMenu } = await import("@/components/shell/UserMenu");
const { GarriguesUserMenu } = await import("@/components/garrigues-shell/GarriguesUserMenu");

afterAll(restore);
afterEach(cleanup);

/** Radix abre el menú por `pointerdown`, no por `click`. */
function abrirMenu(nombreBoton: RegExp | string) {
  const boton = screen.getByRole("button", { name: nombreBoton });
  fireEvent.pointerDown(boton, { button: 0, ctrlKey: false });
  return screen.getByRole("menu");
}

describe("UserMenu (shell TGMS) — cambio de entorno por tenant", () => {
  it("ARGA (…0001) conserva exactamente su entrada y destino anteriores", () => {
    tenantId = "00000000-0000-0000-0000-000000000001";
    render(<UserMenu />);
    const menu = abrirMenu(/Menú de usuario/);
    expect(within(menu).getByText("Cambiar a Entorno Garrigues")).toBeTruthy();
  });

  it("un tenant fuera de ARGA/Garrigues (…0003, grupo nuevo) no ofrece ningún cambio de entorno", () => {
    tenantId = "00000000-0000-0000-0000-000000000003";
    render(<UserMenu />);
    const menu = abrirMenu(/Menú de usuario/);
    expect(within(menu).queryByText(/Cambiar a Entorno/)).toBeNull();
  });
});

describe("GarriguesUserMenu (shell Garrigues) — cambio de entorno por tenant", () => {
  it("Garrigues (…0002) conserva exactamente su entrada y destino anteriores", () => {
    tenantId = "00000000-0000-0000-0000-000000000002";
    render(<GarriguesUserMenu />);
    const menu = abrirMenu(/Menú de usuario/);
    expect(within(menu).getByText("Cambiar a Entorno Corporativo")).toBeTruthy();
  });

  it("un tenant fuera de ARGA/Garrigues (…0003, grupo nuevo) no ofrece ningún cambio de entorno", () => {
    tenantId = "00000000-0000-0000-0000-000000000003";
    render(<GarriguesUserMenu />);
    const menu = abrirMenu(/Menú de usuario/);
    expect(within(menu).queryByText(/Cambiar a Entorno/)).toBeNull();
  });
});
