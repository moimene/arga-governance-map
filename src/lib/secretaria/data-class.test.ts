import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isVisibleDataClass,
  shouldIncludeTestData,
  applyVisibleDataClass,
  filterVisibleByDataClass,
  TEST_DATA_CLASS,
} from "./data-class";

describe("isVisibleDataClass (pura)", () => {
  it("DEMO/PRE_RELEASE/PRODUCTION y null son visibles", () => {
    expect(isVisibleDataClass("DEMO")).toBe(true);
    expect(isVisibleDataClass("PRE_RELEASE")).toBe(true);
    expect(isVisibleDataClass("PRODUCTION")).toBe(true);
    expect(isVisibleDataClass(null)).toBe(true);
    expect(isVisibleDataClass(undefined)).toBe(true);
  });
  it("TEST se oculta por defecto", () => {
    expect(isVisibleDataClass("TEST")).toBe(false);
  });
  it("TEST se muestra con includeTest=true", () => {
    expect(isVisibleDataClass("TEST", true)).toBe(true);
  });
});

describe("shouldIncludeTestData", () => {
  const orig = globalThis.localStorage;
  beforeEach(() => {
    const store: Record<string, string> = {};
    // @ts-expect-error stub mínimo
    globalThis.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  afterEach(() => {
    // @ts-expect-error restore
    globalThis.localStorage = orig;
  });
  it("por defecto es false", () => {
    expect(shouldIncludeTestData()).toBe(false);
  });
  it("true si localStorage tgms.includeTestData=1", () => {
    globalThis.localStorage.setItem("tgms.includeTestData", "1");
    expect(shouldIncludeTestData()).toBe(true);
  });
});

describe("applyVisibleDataClass (builder)", () => {
  it("añade .neq('data_class','TEST') cuando no hay opt-in", () => {
    const calls: Array<[string, string]> = [];
    const fakeQuery = { neq(col: string, val: string) { calls.push([col, val]); return this; } };
    applyVisibleDataClass(fakeQuery);
    expect(calls).toEqual([["data_class", TEST_DATA_CLASS]]);
  });
});

describe("filterVisibleByDataClass", () => {
  it("descarta filas TEST por defecto", () => {
    const rows = [{ id: 1, data_class: "DEMO" }, { id: 2, data_class: "TEST" }, { id: 3, data_class: null }];
    expect(filterVisibleByDataClass(rows).map((r) => r.id)).toEqual([1, 3]);
  });
});
