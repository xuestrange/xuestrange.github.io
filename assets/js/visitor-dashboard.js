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
    var activeToken = "";
    var numberFormat = new Intl.NumberFormat("zh-CN");
    var dateFormat = new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
    var countryNames = typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames(["zh-CN"], { type: "region" })
        : null;

    function setStatus(message, state) {
        status.textContent = message;
        status.dataset.state = state || "";
    }

    function formatNumber(value) {
        return numberFormat.format(Number(value) || 0);
    }

    function formatDate(value) {
        var date = new Date(value + "T00:00:00");
        return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
    }

    function countryName(code) {
        if (!code || code === "XX") {
            return "未知";
        }

        try {
            return countryNames ? countryNames.of(code) : code;
        } catch (_error) {
            return code;
        }
    }

    function clearRows(body) {
        while (body.firstChild) {
            body.removeChild(body.firstChild);
        }
    }

    function appendCell(row, value, numeric) {
        var cell = document.createElement("td");
        cell.textContent = value;
        if (numeric) {
            cell.className = "numeric-cell";
        }
        row.appendChild(cell);
    }

    function renderRegions(regions) {
        var body = document.getElementById("region-rows");
        var empty = document.getElementById("region-empty");
        clearRows(body);

        regions.forEach(function (region) {
            var row = document.createElement("tr");
            appendCell(row, countryName(region.countryCode));
            appendCell(row, region.region || "未知");
            appendCell(row, formatNumber(region.visitors), true);
            body.appendChild(row);
        });

        empty.hidden = regions.length !== 0;
        body.parentElement.parentElement.hidden = regions.length === 0;
    }

    function renderTrend(trend) {
        var body = document.getElementById("trend-rows");
        var empty = document.getElementById("trend-empty");
        clearRows(body);

        trend.forEach(function (day) {
            var row = document.createElement("tr");
            appendCell(row, formatDate(day.day));
            appendCell(row, formatNumber(day.visitors), true);
            appendCell(row, formatNumber(day.pageViews), true);
            body.appendChild(row);
        });

        empty.hidden = trend.length !== 0;
        body.parentElement.parentElement.hidden = trend.length === 0;
    }

    function renderPages(pages) {
        var body = document.getElementById("page-rows");
        var empty = document.getElementById("page-empty");
        clearRows(body);

        pages.forEach(function (page) {
            var row = document.createElement("tr");
            appendCell(row, page.path);
            appendCell(row, formatNumber(page.pageViews), true);
            body.appendChild(row);
        });

        empty.hidden = pages.length !== 0;
        body.parentElement.parentElement.hidden = pages.length === 0;
    }

    function render(data) {
        document.getElementById("stat-total-views").textContent = formatNumber(data.summary.totalPageViews);
        document.getElementById("stat-month-visitors").textContent = formatNumber(data.summary.monthVisitors);
        document.getElementById("stat-today-visitors").textContent = formatNumber(data.summary.todayVisitors);
        document.getElementById("stat-today-views").textContent = formatNumber(data.summary.todayPageViews);
        document.getElementById("analytics-period").textContent = "统计时区：" + data.period.timeZone + " · 更新于 " + new Date(data.generatedAt).toLocaleString("zh-CN");
        renderRegions(data.regions || []);
        renderTrend(data.trend || []);
        renderPages(data.pages || []);
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
