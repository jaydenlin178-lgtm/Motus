import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSteps } from "../js/analysis/gait.js";
import { walkingSignal } from "../js/sim/fake-motion.js";
import { letterSizes, shrinkPct } from "../js/analysis/handwriting.js";
import { formatNumber } from "../js/ui.js";

test("step detection recovers walking cadence", () =>
{
    const result = analyzeSteps(walkingSignal(30, 104));
    assert.ok(result.ok);
    assert.ok(Math.abs(result.cadence - 104) < 4, `cadence ${result.cadence}`);
    assert.ok(result.variationPct < 10, `variation ${result.variationPct}`);
});

test("step detection rejects a phone lying still", () =>
{
    const still = [];
    for (let t = 0; t < 20000; t += 20)
    {
        still.push({ t, m: 9.81 + (Math.random() - 0.5) * 0.05 });
    }
    assert.equal(analyzeSteps(still).ok, false);
});

function loops(count, startHeight, endHeight)
{
    const points = [];
    const total = 400;
    for (let i = 0; i <= total; i++)
    {
        const u = i / total;
        const height = startHeight + (endHeight - startHeight) * u;
        points.push({ x: 20 + 300 * u, y: 150 - height * Math.abs(Math.sin(Math.PI * count * u)) });
    }
    return points;
}

test("handwriting sizes catch letters that shrink across the row", () =>
{
    const sizes = letterSizes(loops(9, 80, 40), 340);
    assert.ok(sizes);
    assert.equal(sizes.length, 4);
    assert.ok(sizes[0] > sizes[3], `sizes ${sizes}`);
    const shrink = shrinkPct(sizes);
    assert.ok(shrink > 25 && shrink < 50, `shrink ${shrink}`);
});

test("handwriting sizes stay level for even letters", () =>
{
    const shrink = shrinkPct(letterSizes(loops(9, 60, 60), 340));
    assert.ok(Math.abs(shrink) < 8, `shrink ${shrink}`);
});

test("handwriting sizes reject a row that is too short", () =>
{
    const short = loops(3, 60, 60).map((p) => ({ x: p.x * 0.3, y: p.y }));
    assert.equal(letterSizes(short, 340), null);
});

test("numbers never display as negative zero", () =>
{
    assert.equal(formatNumber(-0.2, 0, "en"), "0");
    assert.equal(formatNumber(-0.04, 1, "es"), "0.0");
    assert.equal(formatNumber(-0.6, 0, "en"), "-1");
});
