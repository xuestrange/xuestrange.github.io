(function () {
    "use strict";

    const table = document.querySelector(".conference-table");
    const timeline = document.querySelector(".conference-timeline ol");
    const reference = timeline && timeline.querySelector(".conference-milestone-reference");
    if (!table || !reference) return;

    const rows = Array.from(table.tBodies[0].rows);
    const milestones = Array.from(timeline.querySelectorAll("li[data-start-date]"));
    const groups = ["ongoing", "upcoming", "pending", "past"];
    let lastDate;
    let timer;

    function localDate(date) {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")].join("-");
    }

    function status(row, today) {
        const { startDate, endDate } = row.dataset;
        if (!startDate || !endDate) return "pending";
        if (endDate < today) return "past";
        return startDate <= today ? "ongoing" : "upcoming";
    }

    function setStatusClass(element, prefix, state) {
        groups.forEach(group => element.classList.toggle(prefix + group, group === state));
    }

    function refresh() {
        const now = new Date();
        const today = localDate(now);

        if (today !== lastDate) {
            const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
            const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
            const states = new Map(rows.map(row => [row.id, status(row, today)]));
            rows.forEach(row => {
                const state = states.get(row.id);
                setStatusClass(row, "conference-row-", state);
                row.querySelector(".conference-row-status").textContent =
                    state === "upcoming" ? " — upcoming" : state === "ongoing" ? " — in progress" : "";
                row.querySelector(".conference-date-status").textContent =
                    state === "past" ? " (past)" : state === "ongoing" ? " (in progress)" : "";
            });

            const sortedRows = rows.slice().sort((a, b) =>
                groups.indexOf(states.get(a.id)) - groups.indexOf(states.get(b.id)) ||
                (a.dataset.startDate || "").localeCompare(b.dataset.startDate || ""));
            const body = table.tBodies[0];
            if (sortedRows.some((row, index) => body.rows[index] !== row)) {
                sortedRows.forEach(row => body.appendChild(row));
            }

            milestones.forEach(milestone => {
                const links = Array.from(milestone.querySelectorAll("a"));
                links.forEach(link => {
                    const state = states.get(link.hash.slice(1));
                    setStatusClass(link, "conference-milestone-", state);
                    link.querySelector(".sr-only").textContent = " — " + (state === "ongoing" ? "in progress" : state);
                });
                milestone.classList.toggle("conference-milestone-past",
                    links.every(link => states.get(link.hash.slice(1)) === "past"));
            });

            const time = reference.querySelector("time");
            const year = document.createElement("span");
            year.textContent = String(now.getFullYear());
            time.dateTime = today;
            time.replaceChildren(shortDate.format(now), year);
            reference.querySelector(".conference-milestone-links").textContent = "Today";
            timeline.insertBefore(reference, milestones.find(item => item.dataset.startDate >= today) || null);
            table.querySelector(".conference-status-date").textContent = longDate.format(now);
            lastDate = today;
        }

        // Construct the next local midnight so daylight-saving changes are respected.
        clearTimeout(timer);
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 50);
    }

    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", function () {
        if (!document.hidden) refresh();
    });
}());
