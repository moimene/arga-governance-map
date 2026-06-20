import { createRequire } from "node:module";
import * as matchers from "@testing-library/jest-dom/matchers";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");

function ensureDom() {
  if (typeof globalThis.window !== "undefined" && typeof globalThis.document !== "undefined") {
    return;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });
  const win = dom.window;

  Object.defineProperty(globalThis, "window", { value: win, writable: true, configurable: true });
  Object.defineProperty(globalThis, "document", { value: win.document, writable: true, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: win.navigator, writable: true, configurable: true });

  const globals = [
    "HTMLElement",
    "HTMLButtonElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "HTMLFormElement",
    "HTMLAnchorElement",
    "HTMLDivElement",
    "Element",
    "Node",
    "DocumentFragment",
    "MutationObserver",
    "Event",
    "MouseEvent",
    "KeyboardEvent",
    "FocusEvent",
    "CustomEvent",
    "File",
    "Blob",
  ] as const;

  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      value: win[key],
      writable: true,
      configurable: true,
    });
  }

  Object.defineProperty(globalThis, "localStorage", { value: win.localStorage, writable: true, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: win.sessionStorage, writable: true, configurable: true });
}

ensureDom();

try {
  const vitestModule = require("vitest") as {
    vi?: { hoisted?: <T>(factory: () => T) => T };
  };
  if (vitestModule.vi && typeof vitestModule.vi.hoisted !== "function") {
    vitestModule.vi.hoisted = <T,>(factory: () => T) => factory();
  }
} catch {
  // Native Bun can load Vitest-style tests without Vitest's hoist helper.
}

const testExpect = (globalThis as { expect?: { extend?: (value: unknown) => void } }).expect;
if (testExpect?.extend) {
  testExpect.extend(matchers);
}

let cleanupRegistered = false;
const testAfterEach = (globalThis as { afterEach?: (fn: () => void) => void }).afterEach;
if (testAfterEach) {
  const { cleanup } = require("@testing-library/react");
  testAfterEach(() => cleanup());
  cleanupRegistered = true;
}

if (!cleanupRegistered) {
  try {
    const { afterEach: bunAfterEach } = require("bun:test");
    const { cleanup } = require("@testing-library/react");
    if (bunAfterEach) {
      bunAfterEach(() => cleanup());
    }
  } catch {
    // Vitest exposes afterEach globally; Bun exposes it through bun:test.
  }
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

if (!globalThis.ResizeObserver) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
}

if (!globalThis.IntersectionObserver) {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  });
}

if (!globalThis.requestAnimationFrame) {
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    writable: true,
    configurable: true,
    value: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
  });
}

if (!globalThis.cancelAnimationFrame) {
  Object.defineProperty(globalThis, "cancelAnimationFrame", {
    writable: true,
    configurable: true,
    value: (id: number) => clearTimeout(id),
  });
}

if (typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: () => "blob:tgms-test",
  });
}

if (typeof URL.revokeObjectURL !== "function") {
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: () => undefined,
  });
}

Object.defineProperty(HTMLAnchorElement.prototype, "click", {
  writable: true,
  configurable: true,
  value: () => undefined,
});
