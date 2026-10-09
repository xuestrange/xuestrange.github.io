(function (root, factory) {
    "use strict";
    var api = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    } else {
        root.VisitMap = api;
    }
}(typeof window === "undefined" ? globalThis : window, function () {
    "use strict";

    var WORLD = { x: 0, y: 0, width: 960, height: 500 };
    var MAX_ZOOM = 12;
    var SVG_NS = "http://www.w3.org/2000/svg";

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function constrainView(view) {
        var width = clamp(view.width, WORLD.width / MAX_ZOOM, WORLD.width);
        var height = width * WORLD.height / WORLD.width;
        return {
            x: clamp(view.x, 0, WORLD.width - width),
            y: clamp(view.y, 0, WORLD.height - height),
            width: width,
            height: height
        };
    }

    function zoomView(view, factor, anchor) {
        var width = clamp(view.width / factor, WORLD.width / MAX_ZOOM, WORLD.width);
        var ratio = width / view.width;
        return constrainView({
            x: anchor.x - (anchor.x - view.x) * ratio,
            y: anchor.y - (anchor.y - view.y) * ratio,
            width: width
        });
    }

    function fitView(bounds) {
        if (!bounds || !bounds.length) {
            return Object.assign({}, WORLD);
        }
        var left = Math.min.apply(null, bounds.map(function (box) { return box.x; }));
        var top = Math.min.apply(null, bounds.map(function (box) { return box.y; }));
        var right = Math.max.apply(null, bounds.map(function (box) { return box.x + box.width; }));
        var bottom = Math.max.apply(null, bounds.map(function (box) { return box.y + box.height; }));
        var width = Math.max(right - left, (bottom - top) * WORLD.width / WORLD.height, WORLD.width / MAX_ZOOM) * 1.22;
        return constrainView({
            x: (left + right - width) / 2,
            y: (top + bottom - width * WORLD.height / WORLD.width) / 2,
            width: width
        });
    }

    function revealView(view, anchor) {
        var insetX = view.width * 0.1;
        var insetY = view.height * 0.1;
        var x = view.x;
        var y = view.y;
        if (anchor.x < x + insetX || anchor.x > x + view.width - insetX) {
            x = anchor.x - view.width / 2;
        }
        if (anchor.y < y + insetY || anchor.y > y + view.height - insetY) {
            y = anchor.y - view.height / 2;
        }
        return constrainView({ x: x, y: y, width: view.width });
    }

    function screenScale(viewWidth, viewportWidth) {
        // Hidden login results have no screen size yet. ResizeObserver applies
        // the true viewport scale as soon as the map becomes visible.
        var width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : WORLD.width;
        return width / viewWidth;
    }

    function visitColor(visits, maximum) {
        if (!Number.isFinite(visits) || visits <= 0) { return "rgb(221, 229, 232)"; }
        var upper = Math.max(1, Number.isFinite(maximum) ? maximum : visits);
        // A logarithmic ramp keeps occasional visits visible when one country
        // has many more visits, without grouping counts into broad bands.
        var intensity = upper === 1 ? 1 : clamp(Math.log(Math.max(1, visits)) / Math.log(upper), 0, 1);
        var light = [196, 219, 229];
        var dark = [31, 90, 123];
        return "rgb(" + light.map(function (channel, index) {
            return Math.round(channel + (dark[index] - channel) * intensity);
        }).join(", ") + ")";
    }

    function placeLabels(items, width, height) {
        var occupied = [];
        return items.map(function (item) {
            if (item.x < 0 || item.x > width || item.y < 0 || item.y > height) {
                return { id: item.id, hidden: true };
            }
            var w = item.width + 6;
            var h = 18;
            // Prefer the country's geometry anchor, then nearby alternatives.
            // Reserve only label space; countries remain unobscured and clickable.
            var candidates = [
                { x: item.x - w / 2, y: item.y - h / 2 },
                { x: item.x - w / 2, y: item.y - h * 1.5 - 4 },
                { x: item.x - w / 2, y: item.y + h / 2 + 4 },
                { x: item.x + w / 2 + 4, y: item.y - h / 2 },
                { x: item.x - w * 1.5 - 4, y: item.y - h / 2 }
            ];
            for (var index = 0; index < candidates.length; index += 1) {
                var rect = { x: candidates[index].x, y: candidates[index].y, width: w, height: h };
                if (rect.x < 4 || rect.y < 4 || rect.x + w > width - 4 || rect.y + h > height - 4) { continue; }
                var collision = occupied.some(function (other) {
                    return rect.x < other.x + other.width + 2 && rect.x + w + 2 > other.x &&
                        rect.y < other.y + other.height + 2 && rect.y + h + 2 > other.y;
                });
                if (!collision) {
                    occupied.push(rect);
                    return { id: item.id, x: rect.x + w / 2, y: rect.y + h / 2, bounds: rect };
                }
            }
            return { id: item.id, hidden: true };
        });
    }

    function polygonInfo(points) {
        var twiceArea = 0;
        var xTotal = 0;
        var yTotal = 0;
        points.forEach(function (point, index) {
            var next = points[(index + 1) % points.length];
            var cross = point.x * next.y - next.x * point.y;
            twiceArea += cross;
            xTotal += (point.x + next.x) * cross;
            yTotal += (point.y + next.y) * cross;
        });
        return {
            area: Math.abs(twiceArea / 2),
            x: twiceArea ? xTotal / (3 * twiceArea) : points[0].x,
            y: twiceArea ? yTotal / (3 * twiceArea) : points[0].y
        };
    }

    function insidePolygon(point, polygon) {
        var inside = false;
        for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            var a = polygon[i];
            var b = polygon[j];
            if ((a.y > point.y) !== (b.y > point.y) &&
                    point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) {
                inside = !inside;
            }
        }
        return inside;
    }

    // The bundled map contains only M/L/Z polygons. Use the largest component
    // so overseas territories and dateline fragments do not misplace labels.
    function polygonAnchor(pathData) {
        var polygons = String(pathData || "").match(/M[^M]+/g) || [];
        var largest = null;
        polygons.forEach(function (polygon) {
            var numbers = polygon.match(/-?\d+(?:\.\d+)?/g) || [];
            var points = [];
            for (var index = 0; index + 1 < numbers.length; index += 2) {
                points.push({ x: Number(numbers[index]), y: Number(numbers[index + 1]) });
            }
            if (points.length < 3) {
                return;
            }
            var info = polygonInfo(points);
            if (!largest || info.area > largest.area) {
                largest = { area: info.area, x: info.x, y: info.y, points: points };
            }
        });
        if (!largest) {
            return null;
        }
        var xs = largest.points.map(function (point) { return point.x; });
        var ys = largest.points.map(function (point) { return point.y; });
        var bounds = {
            x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
            width: Math.max.apply(null, xs) - Math.min.apply(null, xs),
            height: Math.max.apply(null, ys) - Math.min.apply(null, ys)
        };
        var anchor = { x: largest.x, y: largest.y };
        if (!insidePolygon(anchor, largest.points)) {
            var bestDistance = Infinity;
            // Concave countries can have a centroid in the sea. Find a nearby
            // interior sample before falling back to the polygon's first point.
            for (var x = 0.5; x < 16; x += 1) {
                for (var y = 0.5; y < 16; y += 1) {
                    var candidate = { x: bounds.x + bounds.width * x / 16, y: bounds.y + bounds.height * y / 16 };
                    var distance = Math.pow(candidate.x - largest.x, 2) + Math.pow(candidate.y - largest.y, 2);
                    if (distance < bestDistance && insidePolygon(candidate, largest.points)) {
                        anchor = candidate;
                        bestDistance = distance;
                    }
                }
            }
            if (!Number.isFinite(bestDistance)) {
                anchor = largest.points[0];
            }
        }
        return { x: anchor.x, y: anchor.y, bounds: bounds };
    }

    function countryTotals(countries) {
        var totals = new Map();
        countries.forEach(function (country) {
            if (!country || typeof country !== "object") { return; }
            var code = String(country.countryCode || "").toUpperCase();
            var visits = Number(country.visits);
            if ((/^[A-Z]{2}$/.test(code) || code === "T1") && Number.isFinite(visits) && visits > 0) {
                totals.set(code, (totals.get(code) || 0) + visits);
            }
        });
        return totals;
    }

    function create(options) {
        var map = options.map;
        var frame = options.frame;
        var tooltip = options.tooltip;
        var document = map.ownerDocument;
        var countryName = options.countryName;
        var format = options.numberFormat;
        var view = Object.assign({}, WORLD);
        var totals = new Map();
        var totalVisits = 0;
        var colorMaximum = 0;
        var selectedCode = "";
        var entries = new Map();
        var pointers = new Map();
        var gesture = null;
        var didDrag = false;
        var pendingClick = false;
        var heatVisible = true;
        var labelsVisible = false;
        var labelLayer = document.createElementNS(SVG_NS, "g");
        labelLayer.setAttribute("class", "visit-map-labels");
        labelLayer.setAttribute("aria-hidden", "true");
        map.appendChild(labelLayer);
        map.setAttribute("role", "group");
        map.setAttribute("tabindex", "0");
        map.setAttribute("aria-roledescription", "交互式地图");
        map.setAttribute("aria-describedby", "visit-map-help");
        document.getElementById("visit-map-description").textContent = "可平移和缩放的国家或地区累计访问地图；蓝色越深，累计访问次数越多。使用上方按钮切换国家着色和次数标签。";
        map.querySelectorAll(".world-map-sphere, .world-map-graticule").forEach(function (element) {
            element.setAttribute("aria-hidden", "true");
        });

        function byId(id) { return document.getElementById(id); }
        function label(code, visits) { return countryName(code) + "：" + format.format(visits) + " 次访问"; }
        function hideTooltip() { tooltip.hidden = true; }

        map.querySelectorAll(".world-country").forEach(function (country) {
            country.setAttribute("aria-hidden", "true");
            var anchor = null;
            if (country.tagName.toLowerCase() === "path") {
                anchor = polygonAnchor(country.getAttribute("d"));
            } else {
                var transform = (country.getAttribute("transform") || "").match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/);
                if (transform) {
                    anchor = { x: Number(transform[1]), y: Number(transform[2]) };
                    anchor.bounds = { x: anchor.x - 2, y: anchor.y - 2, width: 4, height: 4 };
                }
            }
            if (anchor) {
                entries.set(country.dataset.country, { country: country, anchor: anchor, text: null });
            }
        });

        function updateLabels() {
            var rect = map.getBoundingClientRect();
            var scale = screenScale(view.width, rect.width);
            entries.forEach(function (entry) {
                if (!entry.text) { return; }
                var text = entry.text;
                text.style.display = "";
                text.setAttribute("x", entry.anchor.x);
                text.setAttribute("y", entry.anchor.y);
                text.setAttribute("font-size", 12 / scale);
                text.style.strokeWidth = 3 / scale + "px";
            });
            if (!labelsVisible || !rect.width) { return; }
            var items = [];
            entries.forEach(function (entry, code) {
                if (!entry.text) { return; }
                var text = entry.text;
                items.push({
                    id: code, x: (entry.anchor.x - view.x) * scale, y: (entry.anchor.y - view.y) * scale,
                    width: text.getComputedTextLength() * scale || text.textContent.length * 7
                });
            });
            // Give the largest totals first choice of the available label space.
            items.sort(function (a, b) { return totals.get(b.id) - totals.get(a.id) || a.id.localeCompare(b.id); });
            placeLabels(items, rect.width, rect.height).forEach(function (placement) {
                var entry = entries.get(placement.id);
                var text = entry.text;
                if (placement.hidden) {
                    text.style.display = "none";
                } else {
                    text.setAttribute("x", view.x + placement.x / scale);
                    text.setAttribute("y", view.y + placement.y / scale);
                }
            });
        }

        function setView(next) {
            view = constrainView(next);
            map.setAttribute("viewBox", [view.x, view.y, view.width, view.height].join(" "));
            var zoom = WORLD.width / view.width;
            byId("map-zoom-level").textContent = Number(zoom.toFixed(1)) + "×";
            byId("map-zoom-in").disabled = zoom >= MAX_ZOOM - 0.001;
            byId("map-zoom-out").disabled = zoom <= 1.001;
            updateLabels();
            hideTooltip();
        }

        function mapPoint(clientX, clientY) {
            var point = map.createSVGPoint();
            point.x = clientX;
            point.y = clientY;
            var matrix = map.getScreenCTM();
            return matrix ? point.matrixTransform(matrix.inverse()) : { x: view.x + view.width / 2, y: view.y + view.height / 2 };
        }

        function zoom(factor, point) {
            setView(zoomView(view, factor, point || { x: view.x + view.width / 2, y: view.y + view.height / 2 }));
        }

        function eventCountry(event) {
            return event.target && event.target.closest ? event.target.closest("[data-country]") : null;
        }

        function showTooltip(country, clientX, clientY) {
            if (!country || gesture) { hideTooltip(); return; }
            tooltip.textContent = label(country.dataset.country, totals.get(country.dataset.country) || 0);
            tooltip.hidden = false;
            var frameRect = frame.getBoundingClientRect();
            var rect = country.getBoundingClientRect();
            var x = Number.isFinite(clientX) ? clientX - frameRect.left : rect.left + rect.width / 2 - frameRect.left;
            var y = Number.isFinite(clientY) ? clientY - frameRect.top : rect.top - frameRect.top;
            var tooltipRect = tooltip.getBoundingClientRect();
            var inset = Math.min(tooltipRect.width / 2 + 8, frameRect.width / 2);
            tooltip.style.left = clamp(x, inset, frameRect.width - inset) + "px";
            tooltip.style.top = clamp(y - tooltipRect.height - 12, 8, frameRect.height - tooltipRect.height - 8) + "px";
        }

        function selectCountry(code, focusRegion) {
            selectedCode = code;
            entries.forEach(function (entry, entryCode) {
                entry.country.classList.toggle("is-selected", entryCode === code);
            });
            var visits = totals.get(code) || 0;
            byId("map-selection").textContent = label(code, visits) +
                (totalVisits ? " · 占累计访问的 " + (visits / totalVisits * 100).toFixed(1) + "%" : "");
            if (focusRegion && entries.has(code)) {
                setView(fitView([entries.get(code).anchor.bounds]));
                map.focus({ preventScroll: true });
            }
        }

        function updateLayers() {
            frame.classList.toggle("map-heat-hidden", !heatVisible);
            labelLayer.style.display = labelsVisible ? "" : "none";
            byId("map-toggle-heat").setAttribute("aria-pressed", String(heatVisible));
            byId("map-toggle-labels").setAttribute("aria-pressed", String(labelsVisible));
            byId("map-heat-legend").hidden = !heatVisible || !colorMaximum;
            updateLabels();
            hideTooltip();
        }

        function render(countries) {
            totals = countryTotals(countries);
            var sorted = Array.from(totals).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
            var known = sorted.filter(function (entry) { return entry[0] !== "XX" && entry[0] !== "T1"; });
            totalVisits = sorted.reduce(function (sum, entry) { return sum + entry[1]; }, 0);
            var maximum = Math.max.apply(null, sorted.filter(function (entry) { return entries.has(entry[0]); })
                .map(function (entry) { return entry[1]; }).concat([0]));
            colorMaximum = maximum;
            var plotted = [];
            var unmappedVisits = 0;
            var summary = byId("map-summary");
            summary.replaceChildren();
            labelLayer.replaceChildren();
            entries.forEach(function (entry, code) {
                var visits = totals.get(code) || 0;
                var country = entry.country;
                entry.text = null;
                country.style.removeProperty("--visit-fill");
                country.removeAttribute("data-visits");
                country.setAttribute("tabindex", "-1");
                country.removeAttribute("aria-label");
                country.removeAttribute("role");
                country.setAttribute("aria-hidden", "true");
                if (!visits) { return; }
                country.style.setProperty("--visit-fill", visitColor(visits, maximum));
                country.dataset.visits = String(visits);
                country.setAttribute("aria-label", label(code, visits));
                country.setAttribute("tabindex", "0");
                country.setAttribute("role", "button");
                country.removeAttribute("aria-hidden");
                plotted.push(entry.anchor.bounds);

                var text = document.createElementNS(SVG_NS, "text");
                text.textContent = format.format(visits);
                text.setAttribute("text-anchor", "middle");
                text.setAttribute("dominant-baseline", "central");
                labelLayer.appendChild(text);
                entry.text = text;
            });
            sorted.forEach(function (entry) {
                var item = document.createElement("li");
                if (entries.has(entry[0])) {
                    var button = document.createElement("button");
                    button.type = "button";
                    button.textContent = label(entry[0], entry[1]);
                    button.addEventListener("click", function () { selectCountry(entry[0], true); });
                    item.appendChild(button);
                } else {
                    item.textContent = label(entry[0], entry[1]);
                    unmappedVisits += entry[1];
                }
                summary.appendChild(item);
            });
            byId("map-total-visits").textContent = format.format(totalVisits);
            byId("map-country-count").textContent = format.format(known.length);
            byId("map-leading-country").textContent = known.length ? countryName(known[0][0]) : "—";
            byId("map-scale-min").textContent = maximum ? "1" : "0";
            byId("map-scale-max").textContent = format.format(maximum);
            byId("map-heat-legend").hidden = !heatVisible || !maximum;
            byId("map-heat-legend").style.setProperty("--scale-start", visitColor(1, maximum));
            byId("map-empty").hidden = plotted.length > 0;
            byId("map-fit").disabled = plotted.length === 0;
            byId("map-unmapped").hidden = unmappedVisits === 0;
            byId("map-unmapped").textContent = format.format(unmappedVisits) + " 次访问没有可定位的地图区域，已计入累计访问并列在汇总中。";
            if (selectedCode && totals.has(selectedCode)) {
                selectCountry(selectedCode, false);
            } else {
                selectedCode = "";
                entries.forEach(function (entry) { entry.country.classList.remove("is-selected"); });
                byId("map-selection").textContent = "选择国家或地区查看累计访问。";
            }
            updateLabels();
            if (window && typeof window.requestAnimationFrame === "function") {
                window.requestAnimationFrame(updateLabels);
            }
            hideTooltip();
        }

        byId("map-zoom-in").addEventListener("click", function () { zoom(1.5); });
        byId("map-zoom-out").addEventListener("click", function () { zoom(1 / 1.5); });
        byId("map-reset").addEventListener("click", function () { setView(WORLD); });
        byId("map-fit").addEventListener("click", function () {
            var bounds = [];
            entries.forEach(function (entry, code) { if (totals.has(code)) { bounds.push(entry.anchor.bounds); } });
            setView(fitView(bounds));
        });
        byId("map-toggle-heat").addEventListener("click", function () { heatVisible = !heatVisible; updateLayers(); });
        byId("map-toggle-labels").addEventListener("click", function () { labelsVisible = !labelsVisible; updateLayers(); });

        map.addEventListener("wheel", function (event) {
            event.preventDefault();
            var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 500 : 1);
            zoom(Math.exp(clamp(-delta * 0.002, -0.7, 0.7)), mapPoint(event.clientX, event.clientY));
        }, { passive: false });
        map.addEventListener("dblclick", function (event) {
            event.preventDefault();
            zoom(event.shiftKey ? 1 / 1.8 : 1.8, mapPoint(event.clientX, event.clientY));
        });

        function beginGesture() {
            var active = Array.from(pointers.values());
            var matrix = map.getScreenCTM();
            gesture = {
                view: Object.assign({}, view),
                points: active,
                matrix: matrix ? matrix.inverse() : null
            };
        }

        function pointInGesture(point) {
            var svgPoint = map.createSVGPoint();
            svgPoint.x = point.x;
            svgPoint.y = point.y;
            return gesture.matrix ? svgPoint.matrixTransform(gesture.matrix) : { x: view.x, y: view.y };
        }

        map.addEventListener("pointerdown", function (event) {
            if (event.pointerType === "mouse" && event.button !== 0) { return; }
            pendingClick = !pointers.size;
            if (!pointers.size) { didDrag = false; }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            map.setPointerCapture(event.pointerId);
            beginGesture();
            frame.classList.add("is-dragging");
            hideTooltip();
        });
        map.addEventListener("pointermove", function (event) {
            if (!pointers.has(event.pointerId)) {
                showTooltip(eventCountry(event), event.clientX, event.clientY);
                return;
            }
            pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            var active = Array.from(pointers.values());
            if (active.length > 1 && gesture.points.length > 1) {
                didDrag = true;
                var initialA = gesture.points[0];
                var initialB = gesture.points[1];
                var initialDistance = Math.hypot(initialB.x - initialA.x, initialB.y - initialA.y);
                var currentDistance = Math.hypot(active[1].x - active[0].x, active[1].y - active[0].y);
                if (initialDistance < 1 || currentDistance < 1) { return; }
                var initialCenter = pointInGesture({ x: (initialA.x + initialB.x) / 2, y: (initialA.y + initialB.y) / 2 });
                var currentCenter = pointInGesture({ x: (active[0].x + active[1].x) / 2, y: (active[0].y + active[1].y) / 2 });
                var next = zoomView(gesture.view, currentDistance / initialDistance, initialCenter);
                var ratio = next.width / gesture.view.width;
                next.x += (initialCenter.x - currentCenter.x) * ratio;
                next.y += (initialCenter.y - currentCenter.y) * ratio;
                setView(next);
            } else {
                var start = gesture.points[0];
                if (Math.hypot(active[0].x - start.x, active[0].y - start.y) > 4) { didDrag = true; }
                var a = pointInGesture(start);
                var b = pointInGesture(active[0]);
                setView({ x: gesture.view.x + a.x - b.x, y: gesture.view.y + a.y - b.y, width: gesture.view.width });
            }
        });

        function endPointer(event) {
            var wasActive = pointers.has(event.pointerId);
            pointers.delete(event.pointerId);
            if (!wasActive) { return; }
            if (map.hasPointerCapture(event.pointerId)) { map.releasePointerCapture(event.pointerId); }
            if (pointers.size) {
                beginGesture();
                return;
            }
            gesture = null;
            frame.classList.remove("is-dragging");
            if (event.type === "pointerup" && !didDrag && pendingClick) {
                // Pointer capture retargets pointerup, so resolve the tapped
                // country at its actual screen coordinate after release.
                var target = document.elementFromPoint(event.clientX, event.clientY);
                var country = target && target.closest ? target.closest("[data-country]") : null;
                if (country && map.contains(country)) { selectCountry(country.dataset.country, false); }
            }
        }
        map.addEventListener("pointerup", endPointer);
        map.addEventListener("pointercancel", endPointer);
        map.addEventListener("lostpointercapture", endPointer);
        map.addEventListener("pointerleave", function () { if (!gesture) { hideTooltip(); } });
        map.addEventListener("click", function (event) {
            // Assistive technology can activate a button without a pointer.
            if (event.detail === 0) {
                var country = eventCountry(event);
                if (country) { selectCountry(country.dataset.country, false); }
            }
        });
        map.addEventListener("focusin", function (event) {
            var country = eventCountry(event);
            var entry = country && entries.get(country.dataset.country);
            if (!entry || gesture) { return; }
            setView(revealView(view, entry.anchor));
            var anchor = map.createSVGPoint();
            anchor.x = entry.anchor.x;
            anchor.y = entry.anchor.y;
            var matrix = map.getScreenCTM();
            var point = matrix ? anchor.matrixTransform(matrix) : null;
            showTooltip(country, point ? point.x : undefined, point ? point.y : undefined);
        });
        map.addEventListener("focusout", hideTooltip);
        map.addEventListener("keydown", function (event) {
            var handled = true;
            var stepX = view.width * (event.shiftKey ? 0.2 : 0.08);
            var stepY = view.height * (event.shiftKey ? 0.2 : 0.08);
            switch (event.key) {
            case "+": case "=": zoom(1.5); break;
            case "-": case "_": zoom(1 / 1.5); break;
            case "Home": case "0": setView(WORLD); break;
            case "ArrowLeft": setView({ x: view.x - stepX, y: view.y, width: view.width }); break;
            case "ArrowRight": setView({ x: view.x + stepX, y: view.y, width: view.width }); break;
            case "ArrowUp": setView({ x: view.x, y: view.y - stepY, width: view.width }); break;
            case "ArrowDown": setView({ x: view.x, y: view.y + stepY, width: view.width }); break;
            case "Enter": case " ":
                var country = eventCountry(event);
                if (country) { selectCountry(country.dataset.country, false); } else { handled = false; }
                break;
            case "Escape": hideTooltip(); break;
            default: handled = false;
            }
            if (handled) { event.preventDefault(); }
        });

        updateLayers();
        setView(WORLD);
        var window = document.defaultView;
        if (window && typeof window.ResizeObserver === "function") {
            new window.ResizeObserver(updateLabels).observe(map);
        } else if (window) {
            window.addEventListener("resize", updateLabels);
        }
        return { render: render };
    }

    return { create: create, constrainView: constrainView, zoomView: zoomView, fitView: fitView,
        revealView: revealView, screenScale: screenScale, placeLabels: placeLabels,
        polygonAnchor: polygonAnchor, insidePolygon: insidePolygon, countryTotals: countryTotals,
        visitColor: visitColor };
}));
