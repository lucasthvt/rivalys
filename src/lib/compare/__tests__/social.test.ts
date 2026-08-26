// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectSocialPlatforms, labelPlatforms, missingPlatforms } from "../social";

describe("detectSocialPlatforms", () => {
  test("detects a plain profile link", () => {
    assert.deepEqual(detectSocialPlatforms(["https://www.linkedin.com/company/acme"]), ["linkedin"]);
  });

  test("treats twitter.com and x.com as the same platform, without duplicating", () => {
    const found = detectSocialPlatforms([
      "https://twitter.com/acme",
      "https://x.com/acme",
    ]);
    assert.deepEqual(found, ["x"]);
  });

  test("ignores the www prefix and matches subdomains", () => {
    assert.deepEqual(detectSocialPlatforms(["https://fr.linkedin.com/company/acme"]), ["linkedin"]);
  });

  test("returns platforms in a stable declaration order regardless of link order", () => {
    const found = detectSocialPlatforms([
      "https://github.com/acme",
      "https://www.linkedin.com/company/acme",
      "https://youtube.com/@acme",
    ]);
    assert.deepEqual(found, ["linkedin", "youtube", "github"]);
  });

  test("ignores share/compose buttons — they prove no account exists", () => {
    const found = detectSocialPlatforms([
      "https://twitter.com/intent/tweet?url=https://acme.com",
      "https://www.facebook.com/sharer/sharer.php?u=https://acme.com",
      "https://www.linkedin.com/sharing/share-offsite/?url=https://acme.com",
      "https://www.reddit.com/submit?url=https://acme.com",
    ]);
    assert.deepEqual(found, []);
  });

  test("ignores a bare link to the network's root", () => {
    assert.deepEqual(detectSocialPlatforms(["https://twitter.com/", "https://facebook.com"]), []);
  });

  test("ignores relative, malformed, and non-http links", () => {
    const found = detectSocialPlatforms([
      "/about",
      "mailto:hello@acme.com",
      "javascript:void(0)",
      "not a url",
    ]);
    assert.deepEqual(found, []);
  });

  test("ignores unrelated outbound links", () => {
    assert.deepEqual(detectSocialPlatforms(["https://acme.com/blog", "https://stripe.com"]), []);
  });

  test("returns an empty list for no links at all", () => {
    assert.deepEqual(detectSocialPlatforms([]), []);
  });
});

describe("missingPlatforms", () => {
  test("returns competitor platforms we don't have", () => {
    assert.deepEqual(missingPlatforms(["linkedin"], ["linkedin", "youtube", "tiktok"]), [
      "youtube",
      "tiktok",
    ]);
  });

  test("returns nothing when we match or exceed the competitor", () => {
    assert.deepEqual(missingPlatforms(["linkedin", "youtube"], ["linkedin"]), []);
  });

  test("returns nothing when the competitor has none", () => {
    assert.deepEqual(missingPlatforms([], []), []);
  });
});

describe("labelPlatforms", () => {
  test("maps ids to display labels", () => {
    assert.deepEqual(labelPlatforms(["linkedin", "x"]), ["LinkedIn", "X (Twitter)"]);
  });

  test("passes through an unknown id rather than dropping it", () => {
    assert.deepEqual(labelPlatforms(["mastodon"]), ["mastodon"]);
  });
});
