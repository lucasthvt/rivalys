// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assertPublicHttpUrl, UnsafeUrlError } from "../url-safety";

describe("assertPublicHttpUrl", () => {
  test("accepts a normal public https URL", () => {
    assert.doesNotThrow(() => assertPublicHttpUrl("https://example.com/pricing"));
  });

  test("accepts a normal public http URL", () => {
    assert.doesNotThrow(() => assertPublicHttpUrl("http://example.com"));
  });

  test("rejects localhost", () => {
    assert.throws(() => assertPublicHttpUrl("http://localhost/"), UnsafeUrlError);
  });

  test("rejects a *.localhost hostname", () => {
    assert.throws(() => assertPublicHttpUrl("http://foo.localhost/"), UnsafeUrlError);
  });

  test("rejects 127.0.0.1 (loopback)", () => {
    assert.throws(() => assertPublicHttpUrl("http://127.0.0.1/"), UnsafeUrlError);
  });

  test("rejects shorthand loopback (127.1)", () => {
    assert.throws(() => assertPublicHttpUrl("http://127.1/"), UnsafeUrlError);
  });

  test("rejects 0.0.0.0", () => {
    assert.throws(() => assertPublicHttpUrl("http://0.0.0.0/"), UnsafeUrlError);
  });

  test("rejects the IPv6 loopback [::1]", () => {
    assert.throws(() => assertPublicHttpUrl("http://[::1]/"), UnsafeUrlError);
  });

  test("rejects a 10.x.x.x private address", () => {
    assert.throws(() => assertPublicHttpUrl("http://10.2.3.4/"), UnsafeUrlError);
  });

  test("rejects a 172.16.0.0/12 private address", () => {
    assert.throws(() => assertPublicHttpUrl("http://172.16.5.5/"), UnsafeUrlError);
  });

  test("does not reject a 172.x address outside the 172.16.0.0/12 range", () => {
    assert.doesNotThrow(() => assertPublicHttpUrl("http://172.32.0.5/"));
  });

  test("rejects a 192.168.x.x private address", () => {
    assert.throws(() => assertPublicHttpUrl("http://192.168.1.1/"), UnsafeUrlError);
  });

  test("rejects the cloud metadata endpoint (169.254.169.254)", () => {
    assert.throws(() => assertPublicHttpUrl("http://169.254.169.254/"), UnsafeUrlError);
  });

  test("rejects a non-http(s) protocol", () => {
    assert.throws(() => assertPublicHttpUrl("ftp://example.com/"), UnsafeUrlError);
    assert.throws(() => assertPublicHttpUrl("file:///etc/passwd"), UnsafeUrlError);
  });

  test("rejects a malformed URL", () => {
    assert.throws(() => assertPublicHttpUrl("not a url"), UnsafeUrlError);
  });
});
