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
    var visitMap = window.VisitMap.create({
        map: map,
        frame: mapFrame,
        tooltip: mapTooltip,
        countryName: countryName,
        numberFormat: numberFormat
    });

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
        visitMap.render(Array.isArray(data.countries) ? data.countries : []);
        renderLatestVisits(Array.isArray(data.latestVisits) ? data.latestVisits : [], timeZone);
        results.hidden = false;
    }

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
