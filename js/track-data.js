import { mean, std } from "./dsp.js";
import { createRandom } from "./sim/signals.js";

const HOUR = 3600000;
const DAY = 24 * HOUR;

export function checkSpeed(check)
{
    const rates = [check.right, check.left].filter((side) => side && isFinite(side.rate)).map((side) => side.rate);
    return rates.length ? mean(rates) : NaN;
}

export function checkTremor(check)
{
    if (!check.tremor)
    {
        return NaN;
    }
    const sizes = [check.tremor.right, check.tremor.left].filter((side) => side && side.ok).map((side) => (side.detected ? side.amplitudeMm : 0));
    return sizes.length ? Math.max(...sizes) : NaN;
}

export function hoursSinceDose(check, doses)
{
    let latest = null;
    for (const dose of doses)
    {
        if (dose.at <= check.at && (!latest || dose.at > latest.at))
        {
            latest = dose;
        }
    }
    if (!latest)
    {
        return null;
    }
    const hours = (check.at - latest.at) / HOUR;
    return hours <= 8 ? hours : null;
}

export function baseline(checks)
{
    if (checks.length === 0)
    {
        return null;
    }
    const first = checks[0].at;
    const window = checks.filter((check) => check.at - first <= 7 * DAY).map(checkSpeed).filter((v) => isFinite(v));
    if (window.length < 3)
    {
        return null;
    }
    const center = mean(window);
    const spread = std(window);
    const range = { mean: center, low: center - spread, high: center + spread, count: window.length };
    return range;
}

export function doseCurve(points)
{
    const bins = [];
    for (let start = 0; start < 8; start += 0.5)
    {
        const inBin = points.filter((p) => p.x >= start && p.x < start + 0.5).map((p) => p.y);
        if (inBin.length >= 2)
        {
            bins.push({ x: start + 0.25, y: mean(inBin), n: inBin.length });
        }
    }
    const smoothed = bins.map((bin, i) =>
    {
        const neighbors = bins.slice(Math.max(0, i - 1), Math.min(bins.length, i + 2));
        const point = { x: bin.x, y: mean(neighbors.map((b) => b.y)), n: bin.n };
        return point;
    });
    return smoothed;
}

export function doseResponse(hours)
{
    const k = Math.max(0, hours) / 1.2;
    return k * k * Math.exp(2 * (1 - k));
}

export function exampleData(now = Date.now())
{
    const random = createRandom(2026);
    const checks = [];
    const doses = [];
    const startDay = new Date(now);
    startDay.setHours(0, 0, 0, 0);
    const firstDay = startDay.getTime() - 9 * DAY;
    const doseHours = [8, 12, 16, 20];
    for (let day = 0; day < 10; day++)
    {
        const dayStart = firstDay + day * DAY;
        const dayDoses = doseHours.map((hour) => dayStart + hour * HOUR + Math.round((random() - 0.5) * 30) * 60000);
        dayDoses.forEach((at, i) =>
        {
            doses.push({ id: "ex-d-" + day + "-" + i, at, example: true });
        });
        const times = [];
        if (random() < 0.6)
        {
            times.push(dayDoses[0] - (0.3 + random() * 0.6) * HOUR);
        }
        for (const doseAt of dayDoses)
        {
            const count = random() < 0.25 ? 2 : 1;
            for (let k = 0; k < count; k++)
            {
                times.push(doseAt + (0.2 + random() * 3.7) * HOUR);
            }
        }
        times.sort((a, b) => a - b);
        times.forEach((at, index) =>
        {
            if (at > now)
            {
                return;
            }
            const lastDose = doses.filter((dose) => dose.at <= at).pop();
            const since = lastDose ? (at - lastDose.at) / HOUR : 10;
            const level = doseResponse(Math.min(since, 10));
            const noise = () => (random() - 0.5) * 0.26;
            const tremorMm = Math.max(0, 4 - 3.4 * level + (random() - 0.5) * 0.8);
            checks.push(
            {
                id: "ex-c-" + day + "-" + index,
                at: Math.round(at),
                example: true,
                right: { rate: 2.3 + 1.25 * level + noise(), meanAmplitude: 4.6 + 1.4 * level, decrementPct: 30 - 18 * level },
                left: { rate: 2.05 + 1.1 * level + noise(), meanAmplitude: 4.1 + 1.2 * level, decrementPct: 36 - 20 * level },
                tremor:
                {
                    right: { ok: true, detected: false, amplitudeMm: 0, frequency: NaN },
                    left: { ok: true, detected: tremorMm > 0.8, amplitudeMm: tremorMm, frequency: 4.8 + random() * 0.6 }
                }
            });
        });
    }
    const data = { checks, doses: doses.filter((dose) => dose.at <= now) };
    return data;
}

export function doseDomain(points)
{
    const largest = points.reduce((max, point) => Math.max(max, point.x), 0);
    return [0, Math.min(8, Math.max(4, Math.ceil(largest + 0.5)))];
}

export const TIME = { HOUR, DAY };
