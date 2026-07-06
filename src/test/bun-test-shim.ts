import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest";

const mock = {
  module: (specifier: string, factory: () => unknown) => vi.doMock(specifier, factory),
};

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  test,
};
