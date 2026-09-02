import test from "node:test";
import assert from "node:assert/strict";

import {
    cleanLocationText,
    handleRequest,
    isAllowedPath,
    isLikelyBot,
    localDateKeys,
    normalizePath,
    normalizeCountryCode,
    requestLocation,
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

test("requestLocation records only a clean city and country code", () => {
    const request = new Request("https://example.com", {
        headers: { "CF-IPCountry": "US" }
    });
    Object.defineProperty(request, "cf", {
        value: { country: "cn", city: " Shang\u0000hai " }
    });

    assert.deepEqual(requestLocation(request), {
        countryCode: "CN",
        city: "Shanghai"
    });
});

test("location helpers use privacy-safe fallbacks", () => {
    assert.equal(normalizeCountryCode("t1"), "T1");
    assert.equal(normalizeCountryCode("USA"), "XX");
    assert.equal(normalizeCountryCode(null), "XX");
    assert.equal(cleanLocationText("\u0007", 20), "Unknown");
    assert.equal(cleanLocationText("A very long city", 6), "A very");
});

function createFakeDb(results = []) {
    const captured = [];
    return {
        captured,
        prepare(sql) {
            const statement = {
                sql,
                values: [],
                bind(...values) {
                    this.values = values;
                    return this;
                }
            };
            return statement;
        },
        async batch(statements) {
            captured.push(...statements);
            return results.length ? results : statements.map(() => ({ results: [] }));
        }
    };
}

test("stats returns only map totals and the latest visits", async () => {
    const db = createFakeDb([
        { results: [{ country_code: "CN", visits: 4 }] },
        { results: [{ visited_at: "2026-09-02T10:00:00.000Z", country_code: "CN", city: "Shanghai" }] }
    ]);
    const request = new Request("https://worker.example/stats", {
        headers: {
            Origin: "https://xuestrange.github.io",
            Authorization: "Bearer test-admin-token"
        }
    });
    const response = await handleRequest(request, {
        DB: db,
        ADMIN_TOKEN: "test-admin-token",
        SITE_ORIGIN: "https://xuestrange.github.io",
        TIME_ZONE: "Asia/Shanghai"
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.generatedAt, "string");
    delete body.generatedAt;
    assert.deepEqual(body, {
        countries: [{ countryCode: "CN", visits: 4 }],
        latestVisits: [{
            visitedAt: "2026-09-02T10:00:00.000Z",
            city: "Shanghai",
            countryCode: "CN"
        }],
        timeZone: "Asia/Shanghai"
    });
    assert.deepEqual(db.captured.map((statement) => statement.values), [[], []]);
});

test("collect stores no raw IP and caps the recent list at ten", async () => {
    const db = createFakeDb();
    const request = new Request("https://worker.example/collect", {
        method: "POST",
        headers: {
            Origin: "https://xuestrange.github.io",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 Safari/605.1.15",
            "CF-Connecting-IP": "203.0.113.42",
            "CF-IPCountry": "GB"
        },
        body: JSON.stringify({ path: "/" })
    });
    Object.defineProperty(request, "cf", {
        value: { country: "GB", city: "London" }
    });

    const response = await handleRequest(request, {
        DB: db,
        HASH_SECRET: "test-hash-secret",
        SITE_ORIGIN: "https://xuestrange.github.io",
        ALLOWED_PATHS: "/",
        COLLECT_RATE_LIMITER: { limit: async () => ({ success: true }) }
    });

    assert.equal(response.status, 204);
    assert.equal(db.captured.length, 3);
    assert.match(db.captured[0].sql, /country_visit_totals/);
    assert.match(db.captured[1].sql, /recent_visits/);
    assert.match(db.captured[2].sql, /LIMIT 10/);
    assert.equal(JSON.stringify(db.captured).includes("203.0.113.42"), false);
    assert.deepEqual(db.captured[1].values.slice(1), ["GB", "London"]);
});
