// Run with: node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/auth/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeNextPath } from "../next-path";

describe("sanitizeNextPath", () => {
  test("keeps an internal relative path", () => {
    assert.equal(sanitizeNextPath("/dashboard"), "/dashboard");
    assert.equal(sanitizeNextPath("/concurrent?x=1"), "/concurrent?x=1");
  });

  test("rejects missing values", () => {
    assert.equal(sanitizeNextPath(null), null);
    assert.equal(sanitizeNextPath(""), null);
  });

  test("rejects absolute and protocol-relative URLs", () => {
    assert.equal(sanitizeNextPath("https://evil.example/"), null);
    assert.equal(sanitizeNextPath("//evil.example"), null);
  });

  test("rejects backslash variants that browsers read as //host", () => {
    assert.equal(sanitizeNextPath("/\\evil.example"), null);
    assert.equal(sanitizeNextPath("/\\\\evil.example"), null);
    assert.equal(sanitizeNextPath("/%5Cevil.example"), "/%5Cevil.example");
  });

  test("rejects control characters", () => {
    assert.equal(sanitizeNextPath("/\tevil.example"), null);
    assert.equal(sanitizeNextPath("/\nfoo"), null);
  });
});
