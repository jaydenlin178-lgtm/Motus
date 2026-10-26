import { mean, median, linearRegression, resampleUniform, bandpass, powerSpectrum, bandPower, bandPeak, rms } from "../dsp.js";

const RATE = 60;

export function analyzeSpiral(points, template)
{
    if (!points || points.length < 40)
    {
        const failure = { ok: false, reason: "short" };
        return failure;
    }
    const thetas = [];
    const radii = [];
    let cumulative = 0;
    let previous = Math.atan2(points[0].y - template.cy, points[0].x - template.cx);
    for (let i = 0; i < points.length; i++)
    {
        const dx = points[i].x - template.cx;
        const dy = points[i].y - template.cy;
        const angle = Math.atan2(dy, dx);
        if (i > 0)
        {
            let step = angle - previous;
            if (step > Math.PI)
            {
                step -= 2 * Math.PI;
            }
            else if (step < -Math.PI)
            {
                step += 2 * Math.PI;
            }
            cumulative += step;
        }
        previous = angle;
        thetas.push(cumulative);
        radii.push(Math.hypot(dx, dy));
    }
    const direction = cumulative >= 0 ? 1 : -1;
    const unwrapped = thetas.map((v) => v * direction);
    const turns = Math.abs(cumulative) / (2 * Math.PI);
    if (turns < 1.2)
    {
        const partial = { ok: false, reason: "short", turns };
        return partial;
    }
    const fit = linearRegression(unwrapped, radii);
    const residuals = radii.map((r, i) => r - (fit.intercept + fit.slope * unwrapped[i]));
    const userSpacing = Math.abs(fit.slope) * 2 * Math.PI;
    const armErrors = points.map((p, i) =>
    {
        let angle = Math.atan2(p.y - template.cy, p.x - template.cx);
        if (angle < 0)
        {
            angle += 2 * Math.PI;
        }
        const base = template.spacing * angle / (2 * Math.PI);
        const k = Math.round((radii[i] - base) / template.spacing);
        const nearest = base + Math.max(0, k) * template.spacing;
        return Math.abs(radii[i] - nearest);
    });
    const templateError = mean(armErrors) / template.spacing * 100;
    const times = points.map((p) => p.t);
    const durationS = (times[times.length - 1] - times[0]) / 1000;
    const series = resampleUniform(times, residuals, RATE);
    const filtered = bandpass(series.values, 2, 20, RATE);
    const spectrum = powerSpectrum(filtered, RATE, 1024);
    const total = bandPower(spectrum, 2, 20);
    const peak = bandPeak(spectrum, 3, 12);
    const peakPower = bandPower(spectrum, peak.frequency - 0.6, peak.frequency + 0.6);
    const concentration = total > 0 ? peakPower / total : 0;
    const narrow = rms(bandpass(filtered, Math.max(1, peak.frequency - 1.2), peak.frequency + 1.2, RATE));
    const amplitudePct = userSpacing > 0 ? narrow * 2 * Math.SQRT2 / userSpacing * 100 : 0;
    const irregularityPct = userSpacing > 0 ? rms(filtered) / userSpacing * 100 : 0;
    const speeds = [];
    for (let i = 1; i < points.length; i++)
    {
        const dt = (points[i].t - points[i - 1].t) / 1000;
        if (dt > 0)
        {
            speeds.push(Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y) / dt);
        }
    }
    const plotFreqs = [];
    const plotPower = [];
    let maxPower = 0;
    for (let k = 0; k < spectrum.freqs.length; k++)
    {
        if (spectrum.freqs[k] >= 1 && spectrum.freqs[k] <= 15)
        {
            plotFreqs.push(spectrum.freqs[k]);
            plotPower.push(spectrum.power[k]);
            maxPower = Math.max(maxPower, spectrum.power[k]);
        }
    }
    const result =
    {
        ok: true,
        turns,
        durationS,
        turnsPerSecond: durationS > 0 ? turns / durationS : NaN,
        medianSpeed: median(speeds),
        templateErrorPct: templateError,
        irregularityPct,
        tremor:
        {
            detected: concentration >= 0.3 && amplitudePct >= 2 && narrow >= 0.8,
            frequency: peak.frequency,
            amplitudePct,
            concentration
        },
        spectrum: { freqs: plotFreqs, power: plotPower.map((p) => maxPower > 0 ? p / maxPower : 0) }
    };
    return result;
}
