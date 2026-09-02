(function () {
    "use strict";

    var dashboard = document.getElementById("analytics-dashboard");
    if (!dashboard) {
        return;
    }

    var endpoint = (dashboard.dataset.endpoint || "").replace(/\/$/, "");
    var setup = document.getElementById("analytics-setup");
    var form = document.getElementById("analytics-login");
    var tokenInput = document.getElementById("analytics-token");
    var status = document.getElementById("analytics-status");
    var results = document.getElementById("analytics-results");
    var refreshButton = document.getElementById("analytics-refresh");
    var map = document.getElementById("visit-world-map");
    var mapFrame = document.getElementById("visit-map-frame");
    var mapTooltip = document.getElementById("visit-map-tooltip");
    var activeToken = "";
    var numberFormat = new Intl.NumberFormat("zh-CN");
    var countryNames = typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames(["zh-CN"], { type: "region" })
        : null;

    function setStatus(message, state) {
        status.textContent = message;
        status.dataset.state = state || "";
    }

    function countryName(code) {
        if (!code || code === "XX" || code === "T1") {
            return code === "T1" ? "Tor 网络" : "未知";
        }

        try {
            return countryNames ? countryNames.of(code) : code;
        } catch (_error) {
            return code;
        }
    }

    function clearChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function appendCell(row, value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
    }

    function visitLabel(code, visits) {
        return countryName(code) + "：" + numberFormat.format(visits) + " 次访问";
    }

    function colorLevel(visits, maximum) {
        if (!visits || !maximum) {
            return 0;
        }
        return Math.max(1, Math.ceil((Math.log1p(visits) / Math.log1p(maximum)) * 5));
    }

    function renderMap(countries) {
        var totals = new Map();
        countries.forEach(function (country) {
            var code = String(country.countryCode || "").toUpperCase();
            var visits = Number(country.visits) || 0;
            if (/^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1" && visits > 0) {
                totals.set(code, (totals.get(code) || 0) + visits);
            }
        });

        var maximum = Math.max.apply(null, Array.from(totals.values()).concat([0]));
        var summary = document.getElementById("map-summary");
        var plottableCodes = new Set();
        clearChildren(summary);

        map.querySelectorAll(".world-country").forEach(function (path) {
            var code = path.dataset.country || "";
            var visits = totals.get(code) || 0;
            path.classList.remove("visit-level-1", "visit-level-2", "visit-level-3", "visit-level-4", "visit-level-5");
            path.removeAttribute("data-visits");
            path.removeAttribute("aria-label");
            path.setAttribute("tabindex", "-1");

            if (visits > 0) {
                path.classList.add("visit-level-" + colorLevel(visits, maximum));
                path.dataset.visits = String(visits);
                path.setAttribute("aria-label", visitLabel(code, visits));
                path.setAttribute("tabindex", "0");
                plottableCodes.add(code);
            }
        });

        Array.from(totals.entries())
            .sort(function (left, right) { return right[1] - left[1] || left[0].localeCompare(right[0]); })
            .forEach(function (entry) {
                var item = document.createElement("li");
                item.textContent = visitLabel(entry[0], entry[1]);
                summary.appendChild(item);
            });

        document.getElementById("map-empty").hidden = plottableCodes.size !== 0;
    }

    function formatVisitDate(value, timeZone) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value || "未知";
        }

        try {
            return new Intl.DateTimeFormat("zh-CN", {
                timeZone: timeZone || "Asia/Shanghai",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            }).format(date);
        } catch (_error) {
            return date.toLocaleString("zh-CN");
        }
    }

    function renderLatestVisits(visits, timeZone) {
        var body = document.getElementById("latest-visit-rows");
        var empty = document.getElementById("latest-visits-empty");
        clearChildren(body);

        visits.slice(0, 10).forEach(function (visit) {
            var row = document.createElement("tr");
            appendCell(row, formatVisitDate(visit.visitedAt, timeZone));
            appendCell(row, visit.city || "未知");
            appendCell(row, countryName(visit.countryCode));
            body.appendChild(row);
        });

        empty.hidden = visits.length !== 0;
        body.parentElement.parentElement.hidden = visits.length === 0;
    }

    function render(data) {
        var timeZone = data.timeZone || "Asia/Shanghai";
        document.getElementById("analytics-updated").textContent =
            "统计时区：" + timeZone + " · 更新于 " + formatVisitDate(data.generatedAt, timeZone);
        renderMap(Array.isArray(data.countries) ? data.countries : []);
        renderLatestVisits(Array.isArray(data.latestVisits) ? data.latestVisits : [], timeZone);
        results.hidden = false;
    }

    function showMapTooltip(path, clientX, clientY) {
        if (!path || !path.dataset.visits) {
            mapTooltip.hidden = true;
            return;
        }

        var frameRect = mapFrame.getBoundingClientRect();
        var pathRect = path.getBoundingClientRect();
        var x = Number.isFinite(clientX) ? clientX - frameRect.left : pathRect.left + pathRect.width / 2 - frameRect.left;
        var y = Number.isFinite(clientY) ? clientY - frameRect.top : pathRect.top - frameRect.top;
        var horizontalInset = Math.min(120, frameRect.width / 2);
        mapTooltip.textContent = visitLabel(path.dataset.country, Number(path.dataset.visits));
        mapTooltip.style.left = Math.max(horizontalInset, Math.min(x, frameRect.width - horizontalInset)) + "px";
        mapTooltip.style.top = Math.max(40, y) + "px";
        mapTooltip.hidden = false;
    }

    function mapPathFromEvent(event) {
        return event.target && event.target.closest ? event.target.closest(".world-country[data-visits]") : null;
    }

    map.addEventListener("pointermove", function (event) {
        showMapTooltip(mapPathFromEvent(event), event.clientX, event.clientY);
    });
    map.addEventListener("pointerleave", function () {
        mapTooltip.hidden = true;
    });
    map.addEventListener("focusin", function (event) {
        showMapTooltip(mapPathFromEvent(event));
    });
    map.addEventListener("focusout", function () {
        mapTooltip.hidden = true;
    });

    async function loadStats() {
        if (!activeToken) {
            return;
        }

        setStatus("正在读取统计…", "loading");
        refreshButton.disabled = true;

        try {
            var response = await fetch(endpoint + "/stats", {
                method: "GET",
                headers: { Authorization: "Bearer " + activeToken },
                mode: "cors",
                credentials: "omit",
                cache: "no-store"
            });

            if (response.status === 401) {
                activeToken = "";
                results.hidden = true;
                form.hidden = false;
                tokenInput.value = "";
                tokenInput.focus();
                throw new Error("口令不正确，请重试。");
            }

            if (!response.ok) {
                throw new Error("统计服务暂时不可用（" + response.status + "）。");
            }

            render(await response.json());
            form.hidden = true;
            setStatus("", "success");
        } catch (error) {
            setStatus(error.message || "无法读取统计，请稍后重试。", "error");
        } finally {
            refreshButton.disabled = false;
        }
    }

    if (!endpoint) {
        setup.hidden = false;
        form.hidden = true;
        setStatus("", "");
        return;
    }

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        activeToken = tokenInput.value;
        tokenInput.value = "";
        loadStats();
    });

    refreshButton.addEventListener("click", loadStats);
}());
