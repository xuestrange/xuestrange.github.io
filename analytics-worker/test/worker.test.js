import test from "node:test";
import assert from "node:assert/strict";

import {
    isAllowedPath,
    isLikelyBot,
    localDateKeys,
    normalizePath,
    readLimitedText
} from "../src/worker.js";

test("normalizePath keeps a safe site path", () => {
    assert.equal(normalizePath("/links.html"), "/links.html");
    assert.equal(normalizePath(" /research/paper/ "), "/research/paper/");
});

test("normalizePath rejects external, oversized, and invalid paths", () => {
    assert.equal(normalizePath("https://example.com"), "");
    assert.equal(normalizePath("//example.com/path"), "");
    assert.equal(normalizePath("/" + "a".repeat(241)), "");
    assert.equal(normalizePath(null), "");
});

test("isLikelyBot identifies common crawler user agents", () => {
    assert.equal(isLikelyBot("Mozilla/5.0 AppleWebKit Safari/605.1.15"), false);
    assert.equal(isLikelyBot("Mozilla/5.0 compatible; Googlebot/2.1"), true);
    assert.equal(isLikelyBot("HeadlessChrome/124.0"), true);
});

test("localDateKeys respects the configured time zone", () => {
    const instant = new Date("2026-08-19T16:30:00.000Z");
    assert.deepEqual(localDateKeys(instant, "Asia/Shanghai"), {
        day: "2026-08-20",
        month: "2026-08"
    });
});

test("localDateKeys falls back to UTC for an invalid time zone", () => {
    const instant = new Date("2026-08-19T16:30:00.000Z");
    assert.deepEqual(localDateKeys(instant, "Not/AZone"), {
        day: "2026-08-19",
        month: "2026-08"
    });
});

test("isAllowedPath only accepts configured public pages", () => {
    const configured = "/,/index.html,/links.html,/links/";
    assert.equal(isAllowedPath("/", configured), true);
    assert.equal(isAllowedPath("/links.html", configured), true);
    assert.equal(isAllowedPath("/made-up-page", configured), false);
});

test("readLimitedText rejects a body larger than the hard byte limit", async () => {
    const smallRequest = new Request("https://example.com", {
        method: "POST",
        body: "1234"
    });
    assert.equal(await readLimitedText(smallRequest, 4), "1234");

    const largeRequest = new Request("https://example.com", {
        method: "POST",
        body: "12345"
    });
    await assert.rejects(
        readLimitedText(largeRequest, 4),
        { name: "PayloadTooLargeError" }
    );
});
