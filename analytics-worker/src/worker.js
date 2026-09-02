const encoder = new TextEncoder();
const botPattern = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|preview)/i;
const maximumPayloadBytes = 4096;

export default {
    async fetch(request, env) {
        return handleRequest(request, env);
    },

    async scheduled(_controller, env, context) {
        context.waitUntil(removeExpiredDetails(env));
    }
};

export async function handleRequest(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
        return handlePreflight(origin, env);
    }

    if (url.pathname === "/health" && request.method === "GET") {
        return jsonResponse({ ok: true }, 200, origin, env);
    }

    if (!isAllowedOrigin(origin, env)) {
        return jsonResponse({ error: "Forbidden origin" }, 403, origin, env);
    }

    if (url.pathname === "/collect" && request.method === "POST") {
        if (!env.HASH_SECRET || !env.COLLECT_RATE_LIMITER) {
            return jsonResponse({ error: "Analytics service is not configured" }, 503, origin, env);
        }

        const rateLimitIp = clientIp(request);
        if (!rateLimitIp) {
            return emptyResponse(204, origin, env);
        }

        let rateLimit;
        try {
            const rateKey = await importHmacKey(env.HASH_SECRET);
            const rateHash = await hmacHex(rateKey, "rate\u0000" + rateLimitIp);
            rateLimit = await env.COLLECT_RATE_LIMITER.limit({ key: rateHash });
        } catch (error) {
            console.error("Analytics rate limit failed", error);
            return jsonResponse({ error: "Analytics service is unavailable" }, 503, origin, env);
        }

        if (!rateLimit.success) {
            return jsonResponse({ error: "Too many requests" }, 429, origin, env);
        }

        return collectVisit(request, env, origin);
    }

    if (url.pathname === "/stats" && request.method === "GET") {
        return serveStats(request, env, origin);
    }

    return jsonResponse({ error: "Not found" }, 404, origin, env);
}

async function collectVisit(request, env, origin) {
    if (!env.DB || !env.HASH_SECRET) {
        return jsonResponse({ error: "Analytics service is not configured" }, 503, origin, env);
    }

    const contentLengthHeader = request.headers.get("Content-Length");
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maximumPayloadBytes)) {
        return jsonResponse({ error: "Payload too large" }, 413, origin, env);
    }

    const userAgent = request.headers.get("User-Agent") || "";
    if (!userAgent || isLikelyBot(userAgent)) {
        return emptyResponse(204, origin, env);
    }

    let payload;
    try {
        payload = JSON.parse(await readLimitedText(request, maximumPayloadBytes));
    } catch (error) {
        if (error && error.name === "PayloadTooLargeError") {
            return jsonResponse({ error: "Payload too large" }, 413, origin, env);
        }
        return jsonResponse({ error: "Invalid JSON" }, 400, origin, env);
    }

    const path = normalizePath(payload && payload.path);
    if (!path) {
        return jsonResponse({ error: "Invalid path" }, 400, origin, env);
    }
    if (!isAllowedPath(path, env.ALLOWED_PATHS)) {
        return emptyResponse(204, origin, env);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const location = requestLocation(request);

    try {
        await env.DB.batch([
            env.DB.prepare(`
                INSERT INTO country_visit_totals
                    (country_code, visits, first_visited_at, last_visited_at)
                VALUES (?, 1, ?, ?)
                ON CONFLICT(country_code) DO UPDATE SET
                    visits = country_visit_totals.visits + 1,
                    last_visited_at = excluded.last_visited_at
            `).bind(
                location.countryCode,
                nowIso,
                nowIso
            ),
            env.DB.prepare(`
                INSERT INTO recent_visits (visited_at, country_code, city)
                VALUES (?, ?, ?)
            `).bind(nowIso, location.countryCode, location.city),
            env.DB.prepare(`
                DELETE FROM recent_visits
                WHERE id NOT IN (
                    SELECT id
                    FROM recent_visits
                    ORDER BY visited_at DESC, id DESC
                    LIMIT 10
                )
            `)
        ]);
    } catch (error) {
        console.error("Analytics write failed", error);
        return jsonResponse({ error: "Analytics write failed" }, 500, origin, env);
    }

    return emptyResponse(204, origin, env);
}

async function serveStats(request, env, origin) {
    if (!env.DB || !env.ADMIN_TOKEN) {
        return jsonResponse({ error: "Analytics service is not configured" }, 503, origin, env);
    }

    const authorization = request.headers.get("Authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match || !(await secureEqual(match[1], env.ADMIN_TOKEN))) {
        return jsonResponse({ error: "Unauthorized" }, 401, origin, env);
    }

    const now = new Date();

    try {
        const queryResults = await env.DB.batch([
            env.DB.prepare(`
                SELECT country_code, visits
                FROM country_visit_totals
                ORDER BY visits DESC, country_code
            `),
            env.DB.prepare(`
                SELECT visited_at, country_code, city
                FROM recent_visits
                ORDER BY visited_at DESC, id DESC
                LIMIT 10
            `)
        ]);

        return jsonResponse({
            countries: rows(queryResults[0]).map((row) => ({
                countryCode: row.country_code,
                visits: numberValue(row.visits)
            })),
            latestVisits: rows(queryResults[1]).map((row) => ({
                visitedAt: row.visited_at,
                city: row.city,
                countryCode: row.country_code
            })),
            timeZone: env.TIME_ZONE || "UTC",
            generatedAt: now.toISOString()
        }, 200, origin, env);
    } catch (error) {
        console.error("Analytics query failed", error);
        return jsonResponse({ error: "Analytics query failed" }, 500, origin, env);
    }
}

export async function removeExpiredDetails(env, now = new Date()) {
    if (!env.DB) {
        return;
    }

    const retentionDays = boundedInteger(env.DATA_RETENTION_DAYS, 31, 30, 730);
    const retainedMonths = boundedInteger(env.MONTH_RETENTION, 13, 2, 36);
    const dailyCutoff = new Date(now.getTime() - (retentionDays - 1) * 86400000);
    const monthCutoff = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - retainedMonths + 1,
        1
    ));
    const dailyKey = localDateKeys(dailyCutoff, env.TIME_ZONE || "UTC").day;
    const monthKey = monthCutoff.toISOString().slice(0, 7);

    await env.DB.batch([
        env.DB.prepare("DELETE FROM daily_visitors WHERE day_key < ?").bind(dailyKey),
        env.DB.prepare("DELETE FROM daily_pages WHERE day_key < ?").bind(dailyKey),
        env.DB.prepare("DELETE FROM monthly_visitors WHERE month_key < ?").bind(monthKey)
    ]);
}

export function normalizePath(value) {
    if (typeof value !== "string") {
        return "";
    }

    const path = value.trim();
    if (!path.startsWith("/") || path.startsWith("//") || path.length > 240) {
        return "";
    }

    return path.replace(/[\u0000-\u001f\u007f]/g, "");
}

export function isLikelyBot(userAgent) {
    return botPattern.test(userAgent);
}

export function isAllowedPath(path, configuredPaths) {
    if (typeof configuredPaths !== "string") {
        return false;
    }

    const paths = configuredPaths.split(",").map((entry) => entry.trim()).filter(Boolean);
    return paths.includes(path);
}

export async function readLimitedText(request, maximumBytes) {
    if (!request.body) {
        return "";
    }

    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let text = "";

    while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
            break;
        }

        totalBytes += chunk.value.byteLength;
        if (totalBytes > maximumBytes) {
            await reader.cancel();
            const error = new Error("Payload too large");
            error.name = "PayloadTooLargeError";
            throw error;
        }

        text += decoder.decode(chunk.value, { stream: true });
    }

    return text + decoder.decode();
}

export function localDateKeys(date, timeZone) {
    let formatter;
    try {
        formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
    } catch (_error) {
        formatter = new Intl.DateTimeFormat("en-CA", {
            timeZone: "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        });
    }

    const parts = Object.fromEntries(
        formatter.formatToParts(date)
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, part.value])
    );
    const day = parts.year + "-" + parts.month + "-" + parts.day;

    return { day, month: day.slice(0, 7) };
}

function clientIp(request) {
    const direct = request.headers.get("CF-Connecting-IP");
    if (direct) {
        return direct.trim().slice(0, 64);
    }

    return "";
}

export function requestLocation(request) {
    const cf = request.cf || {};
    return {
        countryCode: normalizeCountryCode(cf.country || request.headers.get("CF-IPCountry")),
        city: cleanLocationText(cf.city, 100)
    };
}

export function normalizeCountryCode(value) {
    const code = String(value || "").trim().toUpperCase();
    return /^(?:[A-Z]{2}|T1)$/.test(code) ? code : "XX";
}

export function cleanLocationText(value, maxLength) {
    const text = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return (text || "Unknown").slice(0, maxLength);
}

async function importHmacKey(secret) {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
}

async function hmacHex(key, value) {
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function secureEqual(left, right) {
    const [leftHash, rightHash] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(left)),
        crypto.subtle.digest("SHA-256", encoder.encode(right))
    ]);
    const leftBytes = new Uint8Array(leftHash);
    const rightBytes = new Uint8Array(rightHash);
    let difference = 0;

    for (let index = 0; index < leftBytes.length; index += 1) {
        difference |= leftBytes[index] ^ rightBytes[index];
    }

    return difference === 0;
}

function isAllowedOrigin(origin, env) {
    return Boolean(origin) && origin === env.SITE_ORIGIN;
}

function handlePreflight(origin, env) {
    if (!isAllowedOrigin(origin, env)) {
        return new Response(null, { status: 403 });
    }

    return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
    });
}

function corsHeaders(origin) {
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
        "Cache-Control": "no-store",
        "Vary": "Origin"
    };
}

function responseHeaders(origin, env) {
    const headers = {
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
    };

    if (isAllowedOrigin(origin, env)) {
        Object.assign(headers, corsHeaders(origin));
    }

    return headers;
}

function jsonResponse(body, status, origin, env) {
    const headers = responseHeaders(origin, env);
    headers["Content-Type"] = "application/json; charset=utf-8";
    return new Response(JSON.stringify(body), { status, headers });
}

function emptyResponse(status, origin, env) {
    return new Response(null, { status, headers: responseHeaders(origin, env) });
}

function rows(result) {
    return result && Array.isArray(result.results) ? result.results : [];
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function boundedInteger(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(maximum, Math.max(minimum, parsed));
}
