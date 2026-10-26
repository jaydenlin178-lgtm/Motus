import { median, resampleUniform, bandpass, findPeaks, std, coefficientOfVariation } from "../dsp.js";

const RATE = 50;

export function analyzeSteps(samples)
{
    if (samples.length < 100)
    {
        const failure = { ok: false, reason: "no-motion" };
        return failure;
    }
    const times = samples.map((s) => s.t);
    const series = resampleUniform(times, samples.map((s) => s.m), RATE);
    const filtered = bandpass(Array.from(series.values), 0.7, 3.2, RATE);
    const spread = std(filtered);
    if (!(spread > 0.25))
    {
        const failure = { ok: false, reason: "still" };
        return failure;
    }
    const peaks = findPeaks(filtered, { minDistance: Math.round(0.32 * RATE), minProminence: spread * 0.6 });
    const stepTimes = peaks.map((p) => series.start + p.index * 1000 / RATE);
    const intervals = [];
    for (let i = 1; i < stepTimes.length; i++)
    {
        const gap = stepTimes[i] - stepTimes[i - 1];
        if (gap < 1500)
        {
            intervals.push(gap);
        }
    }
    if (intervals.length < 8)
    {
        const failure = { ok: false, reason: "few-steps" };
        return failure;
    }
    const typical = median(intervals);
    const result =
    {
        ok: true,
        steps: stepTimes.length,
        cadence: 60000 / typical,
        variationPct: coefficientOfVariation(intervals) * 100,
        stepTimes
    };
    return result;
}
