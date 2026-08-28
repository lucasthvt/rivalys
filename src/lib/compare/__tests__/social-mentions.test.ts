// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts
//
// No network here: lookupThirdPartyMentions' only non-pure part is askPerplexity, so the
// response handling lives in parseMentionsResponse and is tested directly.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  groupMentionsByPlatform,
  isContentUrl,
  isMentionPlatformId,
  MENTION_PLATFORM_IDS,
  parseMentionsResponse,
} from "../social-mentions";
import { SOCIAL_PLATFORMS } from "../social";

const TIKTOK_VIDEO = "https://www.tiktok.com/@creator/video/7291234567890123456";
const TIKTOK_VIDEO_2 = "https://www.tiktok.com/@other/video/7299999999999999999";
const TIKTOK_VIDEO_3 = "https://www.tiktok.com/@third/video/7288888888888888888";
const YOUTUBE_WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const INSTAGRAM_REEL = "https://www.instagram.com/reel/CxYzAbCdEfG/";

describe("MENTION_PLATFORM_IDS", () => {
  test("only contains ids that exist in SOCIAL_PLATFORMS (one shared vocabulary)", () => {
    const socialIds = new Set<string>(SOCIAL_PLATFORMS.map((p) => p.id));
    for (const id of MENTION_PLATFORM_IDS) {
      assert.ok(socialIds.has(id), `${id} is not a SOCIAL_PLATFORMS id`);
    }
  });

  test("is scoped to the three platforms where individual content is checkable", () => {
    assert.deepEqual([...MENTION_PLATFORM_IDS].sort(), ["instagram", "tiktok", "youtube"]);
  });

  test("follows SOCIAL_PLATFORMS' declaration order", () => {
    const expected = SOCIAL_PLATFORMS.map((p) => p.id).filter((id) =>
      (MENTION_PLATFORM_IDS as readonly string[]).includes(id),
    );
    assert.deepEqual([...MENTION_PLATFORM_IDS], expected);
  });

  test("isMentionPlatformId rejects platforms with a different content model", () => {
    assert.equal(isMentionPlatformId("tiktok"), true);
    assert.equal(isMentionPlatformId("linkedin"), false);
    assert.equal(isMentionPlatformId("github"), false);
    assert.equal(isMentionPlatformId("discord"), false);
    assert.equal(isMentionPlatformId("x"), false);
  });
});

describe("isContentUrl", () => {
  test("accepts a TikTok video URL", () => {
    assert.equal(isContentUrl(TIKTOK_VIDEO, "tiktok"), true);
    assert.equal(isContentUrl("https://tiktok.com/@creator/photo/7291234567890123456", "tiktok"), true);
  });

  test("accepts a YouTube watch URL only when it carries a video id", () => {
    assert.equal(isContentUrl(YOUTUBE_WATCH, "youtube"), true);
    assert.equal(isContentUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42", "youtube"), true);
    // /watch with no v= identifies nothing.
    assert.equal(isContentUrl("https://www.youtube.com/watch", "youtube"), false);
    assert.equal(isContentUrl("https://www.youtube.com/watch?v=", "youtube"), false);
  });

  test("accepts a YouTube Shorts URL and a youtu.be short link", () => {
    assert.equal(isContentUrl("https://www.youtube.com/shorts/abcdefghijk", "youtube"), true);
    assert.equal(isContentUrl("https://youtu.be/dQw4w9WgXcQ", "youtube"), true);
  });

  test("accepts an Instagram reel and an Instagram post", () => {
    assert.equal(isContentUrl(INSTAGRAM_REEL, "instagram"), true);
    assert.equal(isContentUrl("https://www.instagram.com/p/CxYzAbCdEfG/", "instagram"), true);
    assert.equal(isContentUrl("https://www.instagram.com/creator/reel/CxYzAbCdEfG/", "instagram"), true);
  });

  test("REJECTS a search-results page — it proves nothing and can be built for any string", () => {
    assert.equal(isContentUrl("https://www.tiktok.com/search?q=acme", "tiktok"), false);
    assert.equal(isContentUrl("https://www.youtube.com/results?search_query=acme", "youtube"), false);
    assert.equal(isContentUrl("https://www.instagram.com/explore/search/keyword/?q=acme", "instagram"), false);
  });

  test("REJECTS a hashtag page — same reason", () => {
    assert.equal(isContentUrl("https://www.tiktok.com/tag/acme", "tiktok"), false);
    assert.equal(isContentUrl("https://www.youtube.com/hashtag/acme", "youtube"), false);
    assert.equal(isContentUrl("https://www.instagram.com/explore/tags/acme/", "instagram"), false);
  });

  test("rejects the platform's homepage", () => {
    assert.equal(isContentUrl("https://www.tiktok.com/", "tiktok"), false);
    assert.equal(isContentUrl("https://www.youtube.com", "youtube"), false);
    assert.equal(isContentUrl("https://www.instagram.com/", "instagram"), false);
  });

  test("rejects a profile page — presence, not a piece of content", () => {
    assert.equal(isContentUrl("https://www.tiktok.com/@acme", "tiktok"), false);
    assert.equal(isContentUrl("https://www.youtube.com/@acme", "youtube"), false);
    assert.equal(isContentUrl("https://www.instagram.com/acme/", "instagram"), false);
  });

  test("rejects a real content URL claimed for the WRONG platform", () => {
    assert.equal(isContentUrl(TIKTOK_VIDEO, "youtube"), false);
    assert.equal(isContentUrl(YOUTUBE_WATCH, "tiktok"), false);
    assert.equal(isContentUrl(INSTAGRAM_REEL, "tiktok"), false);
  });

  test("rejects a lookalike host that merely contains the platform name", () => {
    assert.equal(isContentUrl("https://tiktok.com.evil.example/@a/video/123", "tiktok"), false);
    assert.equal(isContentUrl("https://nottiktok.com/@a/video/123", "tiktok"), false);
    assert.equal(isContentUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "youtube"), false);
  });

  test("rejects malformed, relative and non-http URLs", () => {
    assert.equal(isContentUrl("tiktok.com/@a/video/123", "tiktok"), false);
    assert.equal(isContentUrl("/@a/video/123", "tiktok"), false);
    assert.equal(isContentUrl("javascript:void(0)", "tiktok"), false);
    assert.equal(isContentUrl("not a url", "tiktok"), false);
    assert.equal(isContentUrl("", "tiktok"), false);
  });

  test("keeps query strings and subdomains (share links carry both)", () => {
    assert.equal(isContentUrl(`${TIKTOK_VIDEO}?is_from_webapp=1`, "tiktok"), true);
    assert.equal(isContentUrl("https://m.tiktok.com/@a/video/123", "tiktok"), true);
  });
});

describe("parseMentionsResponse", () => {
  test("keeps every entry whose URL verifies", () => {
    const raw = JSON.stringify([
      { platform: "tiktok", url: TIKTOK_VIDEO },
      { platform: "youtube", url: YOUTUBE_WATCH },
    ]);
    assert.deepEqual(parseMentionsResponse(raw), [
      { platform: "youtube", url: YOUTUBE_WATCH },
      { platform: "tiktok", url: TIKTOK_VIDEO },
    ]);
  });

  test("DROPS an unverifiable entry while the valid ones survive", () => {
    // The model backs its TikTok claim with a search page — an unverifiable claim never
    // reaches the user's task list.
    const raw = JSON.stringify([
      { platform: "tiktok", url: "https://www.tiktok.com/search?q=acme" },
      { platform: "youtube", url: YOUTUBE_WATCH },
    ]);
    assert.deepEqual(parseMentionsResponse(raw), [{ platform: "youtube", url: YOUTUBE_WATCH }]);
  });

  test("drops an entry whose URL belongs to another platform than the one it names", () => {
    const raw = JSON.stringify([{ platform: "youtube", url: TIKTOK_VIDEO }]);
    assert.deepEqual(parseMentionsResponse(raw), []);
  });

  test("drops an unknown platform id", () => {
    const raw = JSON.stringify([
      { platform: "linkedin", url: "https://www.linkedin.com/posts/acme-activity-123" },
      { platform: "snapchat", url: "https://www.snapchat.com/spotlight/abc" },
    ]);
    assert.deepEqual(parseMentionsResponse(raw), []);
  });

  test("drops malformed entries (missing url, wrong types, nested arrays, null)", () => {
    const raw = JSON.stringify([
      { platform: "tiktok" },
      { platform: 42, url: TIKTOK_VIDEO },
      { platform: "tiktok", url: 7 },
      ["tiktok", TIKTOK_VIDEO],
      null,
    ]);
    assert.deepEqual(parseMentionsResponse(raw), []);
  });

  test("accepts a markdown-fenced answer", () => {
    const raw = `\`\`\`json\n[{"platform": "instagram", "url": "${INSTAGRAM_REEL}"}]\n\`\`\``;
    assert.deepEqual(parseMentionsResponse(raw), [{ platform: "instagram", url: INSTAGRAM_REEL }]);
  });

  test("returns [] — checked, found nothing — for a well-formed empty array", () => {
    assert.deepEqual(parseMentionsResponse("[]"), []);
  });

  test("returns null on malformed JSON: unusable answer means 'never checked'", () => {
    assert.equal(parseMentionsResponse("Je n'ai trouvé aucun contenu."), null);
    assert.equal(parseMentionsResponse('[{"platform": "tiktok",'), null);
  });

  test("returns null on a non-array JSON value", () => {
    assert.equal(parseMentionsResponse('{"platform": "tiktok"}'), null);
    assert.equal(parseMentionsResponse("null"), null);
    assert.equal(parseMentionsResponse('"tiktok"'), null);
  });

  test("returns null on a missing or blank answer (Perplexity failure path)", () => {
    assert.equal(parseMentionsResponse(null), null);
    assert.equal(parseMentionsResponse(""), null);
    assert.equal(parseMentionsResponse("   "), null);
  });

  test("normalizes the platform id's case and whitespace", () => {
    const raw = JSON.stringify([{ platform: " TikTok ", url: TIKTOK_VIDEO }]);
    assert.deepEqual(parseMentionsResponse(raw), [{ platform: "tiktok", url: TIKTOK_VIDEO }]);
  });

  test("caps the result at 2 URLs per platform — enough to verify, not a volume claim", () => {
    const raw = JSON.stringify([
      { platform: "tiktok", url: TIKTOK_VIDEO },
      { platform: "tiktok", url: TIKTOK_VIDEO_2 },
      { platform: "tiktok", url: TIKTOK_VIDEO_3 },
      { platform: "youtube", url: YOUTUBE_WATCH },
    ]);
    const parsed = parseMentionsResponse(raw);

    assert.equal(parsed?.filter((m) => m.platform === "tiktok").length, 2);
    assert.deepEqual(
      parsed?.filter((m) => m.platform === "tiktok").map((m) => m.url),
      [TIKTOK_VIDEO, TIKTOK_VIDEO_2],
    );
    assert.equal(parsed?.filter((m) => m.platform === "youtube").length, 1);
  });

  test("dedupes the same URL returned twice", () => {
    const raw = JSON.stringify([
      { platform: "tiktok", url: TIKTOK_VIDEO },
      { platform: "tiktok", url: ` ${TIKTOK_VIDEO} ` },
    ]);
    assert.deepEqual(parseMentionsResponse(raw), [{ platform: "tiktok", url: TIKTOK_VIDEO }]);
  });

  test("returns platforms in a stable order regardless of the model's ordering", () => {
    const a = parseMentionsResponse(
      JSON.stringify([
        { platform: "tiktok", url: TIKTOK_VIDEO },
        { platform: "instagram", url: INSTAGRAM_REEL },
        { platform: "youtube", url: YOUTUBE_WATCH },
      ]),
    );
    const b = parseMentionsResponse(
      JSON.stringify([
        { platform: "youtube", url: YOUTUBE_WATCH },
        { platform: "tiktok", url: TIKTOK_VIDEO },
        { platform: "instagram", url: INSTAGRAM_REEL },
      ]),
    );

    assert.deepEqual(a?.map((m) => m.platform), ["instagram", "youtube", "tiktok"]);
    assert.deepEqual(a, b);
  });
});

describe("groupMentionsByPlatform", () => {
  test("groups by platform in stable order, omitting empty groups", () => {
    const groups = groupMentionsByPlatform([
      { platform: "tiktok", url: TIKTOK_VIDEO },
      { platform: "instagram", url: INSTAGRAM_REEL },
      { platform: "tiktok", url: TIKTOK_VIDEO_2 },
    ]);

    assert.deepEqual(groups, [
      { platform: "instagram", urls: [INSTAGRAM_REEL] },
      { platform: "tiktok", urls: [TIKTOK_VIDEO, TIKTOK_VIDEO_2] },
    ]);
  });

  test("re-verifies stored URLs, so nothing uncheckable can reach the gap description", () => {
    const groups = groupMentionsByPlatform([
      { platform: "tiktok", url: "https://www.tiktok.com/tag/acme" },
      { platform: "tiktok", url: "https://evil.example/whatever" },
      { platform: "tiktok", url: TIKTOK_VIDEO },
    ]);

    assert.deepEqual(groups, [{ platform: "tiktok", urls: [TIKTOK_VIDEO] }]);
  });

  test("returns an empty list for no mentions at all", () => {
    assert.deepEqual(groupMentionsByPlatform([]), []);
  });
});
