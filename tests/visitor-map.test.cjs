const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const map = require("../assets/js/visitor-map.js");

test("zoom preserves the map coordinate under the mouse", () => {
    const view = { x: 200, y: 100, width: 480, height: 250 };
    const anchor = { x: 350, y: 200 };
    const next = map.zoomView(view, 2, anchor);
    assert.equal((anchor.x - next.x) / next.width, (anchor.x - view.x) / view.width);
    assert.equal((anchor.y - next.y) / next.height, (anchor.y - view.y) / view.height);
    const restored = map.zoomView(next, 0.5, anchor);
    assert.deepEqual(restored, view);
});

test("zoom and panning stay within the world and the 1–12× range", () => {
    const max = map.zoomView({ x: 0, y: 0, width: 960, height: 500 }, 1000, { x: 960, y: 500 });
    assert.equal(max.width, 80);
    assert.equal(max.height, 500 / 12);
    assert.equal(max.x, 880);
    assert.equal(max.y, 500 - 500 / 12);
    const min = map.zoomView(max, 0.00001, { x: 950, y: 490 });
    assert.deepEqual(min, { x: 0, y: 0, width: 960, height: 500 });
    assert.deepEqual(map.constrainView({ x: -500, y: 1000, width: 480 }),
        { x: 0, y: 250, width: 480, height: 250 });
});

test("fit includes separated visit regions with padding", () => {
    const boxes = [{ x: 180, y: 80, width: 130, height: 70 }, { x: 640, y: 75, width: 140, height: 105 }];
    const view = map.fitView(boxes);
    for (const box of boxes) {
        assert.ok(view.x <= box.x);
        assert.ok(view.y <= box.y);
        assert.ok(view.x + view.width >= box.x + box.width);
        assert.ok(view.y + view.height >= box.y + box.height);
    }
    assert.ok(view.width < 960);
    assert.deepEqual(map.fitView([]), { x: 0, y: 0, width: 960, height: 500 });
});

test("tiny regions fit at a useful zoom without exceeding the limit", () => {
    const view = map.fitView([{ x: 767, y: 172, width: 2, height: 2 }]);
    assert.ok(view.width >= 80);
    assert.ok(view.width < 100);
    assert.ok(view.x < 767 && view.x + view.width > 769);
});

test("keyboard focus reveals an offscreen country while preserving zoom", () => {
    const view = { x: 50, y: 100, width: 240, height: 125 };
    const anchor = { x: 724, y: 128 };
    const next = map.revealView(view, anchor);
    assert.equal(next.width, view.width);
    assert.equal(next.height, view.height);
    assert.ok(next.x < anchor.x && next.x + next.width > anchor.x);
    assert.ok(next.y < anchor.y && next.y + next.height > anchor.y);
    assert.deepEqual(map.revealView(next, anchor), next);
    const edge = map.revealView(view, { x: 950, y: 20 });
    assert.equal(edge.x, 720);
    assert.equal(edge.y, 0);
});

test("count labels retain their pixel size on mobile and after zoom", () => {
    for (const width of [276, 820]) {
        for (const viewWidth of [960, 80]) {
            const scale = map.screenScale(viewWidth, width);
            assert.equal((12 / scale) * scale, 12);
        }
    }
    assert.equal(map.screenScale(960, 0), 1);
    assert.equal(map.screenScale(80, 0), 12);
});

test("count labels prefer country anchors, then nearby space without overlaps", () => {
    const items = ["a", "b", "c", "d", "e", "f"].map(id => ({ id, x: 100, y: 100, width: 20 }));
    const labels = map.placeLabels(items, 200, 200);
    assert.equal(labels[0].x, 100);
    assert.equal(labels[0].y, 100);
    assert.ok(labels[1].y < 100);
    assert.ok(labels[2].y > 100);
    assert.ok(labels[3].x > 100);
    assert.ok(labels[4].x < 100);
    assert.equal(labels[5].hidden, true);
    const visible = labels.filter(label => !label.hidden);
    for (let i = 0; i < visible.length; i++) {
        for (let j = i + 1; j < visible.length; j++) {
            const a = visible[i].bounds;
            const b = visible[j].bounds;
            assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x ||
                a.y + a.height <= b.y || b.y + b.height <= a.y);
        }
    }
});

test("count labels stay inside the mobile map frame near its edges", () => {
    const labels = map.placeLabels([
        { id: "UK", x: 160, y: 14, width: 17 },
        { id: "DE", x: 165, y: 24, width: 17 },
        { id: "edge", x: 324, y: 85, width: 28 }
    ], 331, 172);
    assert.ok(labels.every(label => !label.hidden));
    for (const label of labels) {
        assert.ok(label.bounds.x >= 4 && label.bounds.y >= 4);
        assert.ok(label.bounds.x + label.bounds.width <= 327);
        assert.ok(label.bounds.y + label.bounds.height <= 168);
    }
    assert.equal(map.placeLabels([{ id: "too-wide", x: 20, y: 20, width: 35 }], 40, 40)[0].hidden, true);
});

test("offscreen country labels remain hidden until their anchors enter the view", () => {
    const items = [{ id: "west", x: -1, y: 50, width: 10 },
        { id: "north", x: 50, y: -1, width: 10 },
        { id: "east", x: 101, y: 50, width: 10 },
        { id: "south", x: 50, y: 101, width: 10 }];
    assert.ok(map.placeLabels(items, 100, 100).every(label => label.hidden));
});

test("a multipart country uses its largest component, not its whole bbox", () => {
    const anchor = map.polygonAnchor("M0,0L2,0L2,2L0,2ZM100,100L120,100L120,120L100,120Z");
    assert.equal(anchor.x, 110);
    assert.equal(anchor.y, 110);
    assert.deepEqual(anchor.bounds, { x: 100, y: 100, width: 20, height: 20 });
});

test("a concave country keeps its label anchor inside the country", () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 },
        { x: 2, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const anchor = map.polygonAnchor("M0,0L10,0L10,2L2,2L2,8L10,8L10,10L0,10Z");
    assert.ok(map.insidePolygon(anchor, points));
});

test("visit colors use neutral zero and the light-to-dark legend endpoints", () => {
    assert.equal(map.visitColor(0, 246), "rgb(221, 229, 232)");
    assert.equal(map.visitColor(-1, 246), "rgb(221, 229, 232)");
    assert.equal(map.visitColor(NaN, 246), "rgb(221, 229, 232)");
    assert.equal(map.visitColor(Infinity, 246), "rgb(221, 229, 232)");
    assert.equal(map.visitColor(1, 246), "rgb(196, 219, 229)");
    assert.equal(map.visitColor(246, 246), "rgb(31, 90, 123)");
    assert.equal(map.visitColor(300, 246), map.visitColor(246, 246));
    assert.equal(map.visitColor(1, 1), "rgb(31, 90, 123)");
});

test("frequency colors darken monotonically and distinguish common high totals", () => {
    const channels = color => color.match(/\d+/g).map(Number);
    let previous = channels(map.visitColor(1, 246));
    for (const count of [2, 4, 8, 16, 32, 84, 246]) {
        const current = channels(map.visitColor(count, 246));
        assert.ok(current.every((value, index) => value < previous[index]));
        previous = current;
    }
    const china = channels(map.visitColor(246, 246));
    const unitedStates = channels(map.visitColor(84, 246));
    assert.ok(unitedStates.every((value, index) => value > china[index]));
    assert.ok(unitedStates[0] - china[0] >= 25);
});

test("country totals combine duplicates, preserve unknown/Tor totals and reject bad counts", () => {
    const totals = map.countryTotals([
        { countryCode: "cn", visits: 8 }, { countryCode: "CN", visits: "2" },
        { countryCode: "XX", visits: 3 }, { countryCode: "T1", visits: 4 },
        { countryCode: "GB", visits: -2 }, { countryCode: "US", visits: Infinity },
        { countryCode: "bad", visits: 9 }, { countryCode: "FR", visits: "NaN" }, null
    ]);
    assert.deepEqual(Array.from(totals), [["CN", 10], ["XX", 3], ["T1", 4]]);
});

test("bundled country polygon anchors remain on the map and avoid overseas/dateline centers", () => {
    const svg = fs.readFileSync(path.join(__dirname, "../_includes/world-visit-map.svg"), "utf8");
    const anchors = new Map();
    for (const tag of svg.match(/<path\b[^>]*data-country="[A-Z]{2}"[^>]*>/g)) {
        const code = tag.match(/data-country="([A-Z]{2})"/)[1];
        const anchor = map.polygonAnchor(tag.match(/ d="([^"]+)"/)[1]);
        assert.ok(anchor, code + " has a usable geometry");
        assert.ok(anchor.x >= 0 && anchor.x <= 960 && anchor.y >= 0 && anchor.y <= 500, code + " remains on the world");
        anchors.set(code, anchor);
    }
    assert.ok(anchors.size > 170);
    assert.ok(anchors.get("US").x > 190 && anchors.get("US").x < 330);
    assert.ok(anchors.get("FR").x > 470 && anchors.get("FR").x < 500);
    assert.ok(anchors.get("RU").x > 530);
    assert.ok(anchors.get("CN").x > 650 && anchors.get("CN").x < 780);
});
