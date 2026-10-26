import { mean, median, std, percentile, resampleUniform, filtfilt, findPeaks, derivative, linearRegression, downsampleForPlot } from "../dsp.js";

const RATE = 60;

function frameRate(times)
{
    const intervals = [];
    for (let i = 1; i < times.length; i++)
    {
        intervals.push(times[i] - times[i - 1]);
    }
    const typical = median(intervals);
    return typical > 0 ? 1000 / typical : 0;
}

function nearestTrough(troughs, peakIndex, direction, limit)
{
    let found = -1;
    if (direction < 0)
    {
        for (let k = troughs.length - 1; k >= 0; k--)
        {
            if (troughs[k] < peakIndex && troughs[k] > limit)
            {
                found = troughs[k];
                break;
            }
        }
    }
    else
    {
        for (let k = 0; k < troughs.length; k++)
        {
            if (troughs[k] > peakIndex && troughs[k] < limit)
            {
                found = troughs[k];
                break;
            }
        }
    }
    return found;
}

function maxOver(values, start, end)
{
    let best = -Infinity;
    for (let i = Math.max(0, start); i <= Math.min(values.length - 1, end); i++)
    {
        best = Math.max(best, values[i]);
    }
    return best;
}

function minOver(values, start, end)
{
    let best = Infinity;
    for (let i = Math.max(0, start); i <= Math.min(values.length - 1, end); i++)
    {
        best = Math.min(best, values[i]);
    }
    return best;
}

function thirdsChange(values)
{
    const n = values.length;
    const third = Math.max(1, Math.floor(n / 3));
    const first = mean(values.slice(0, third));
    const last = mean(values.slice(n - third));
    return first > 0 ? (first - last) / first * 100 : 0;
}

export function analyzeTapping(frames)
{
    const valid = frames.filter((f) => f.d !== null && f.d !== undefined && isFinite(f.d));
    const coverage = frames.length ? valid.length / frames.length : 0;
    const fps = frameRate(frames.map((f) => f.t));
    const failure = { ok: false, reason: "tracking", coverage, fps };
    if (valid.length < 30 || coverage < 0.6)
    {
        return failure;
    }
    const times = valid.map((f) => f.t);
    const series = resampleUniform(times, valid.map((f) => f.d), RATE);
    const smooth = filtfilt(series.values, "lowpass", 10, RATE, 2);
    const low = percentile(smooth, 5);
    const high = percentile(smooth, 95);
    const range = high - low;
    if (range < 0.8)
    {
        const still = { ok: false, reason: "no-taps", coverage, fps };
        return still;
    }
    const minDistance = Math.round(0.11 * RATE);
    const minProminence = Math.max(0.18 * range, 0.5);
    const peaks = findPeaks(smooth, { minDistance, minProminence }).map((p) => p.index);
    const negated = smooth.map((v) => -v);
    const troughs = findPeaks(negated, { minDistance, minProminence }).map((p) => p.index);
    const velocity = derivative(smooth, RATE);
    const taps = [];
    for (let k = 0; k < peaks.length; k++)
    {
        const peak = peaks[k];
        const previousPeak = k > 0 ? peaks[k - 1] : -1;
        const nextPeak = k < peaks.length - 1 ? peaks[k + 1] : smooth.length;
        const before = nearestTrough(troughs, peak, -1, previousPeak);
        const after = nearestTrough(troughs, peak, 1, nextPeak);
        if (before < 0 && after < 0)
        {
            continue;
        }
        const floors = [];
        if (before >= 0)
        {
            floors.push(smooth[before]);
        }
        if (after >= 0)
        {
            floors.push(smooth[after]);
        }
        const amplitude = smooth[peak] - mean(floors);
        const opening = before >= 0 ? maxOver(velocity, before, peak) : NaN;
        const closing = after >= 0 ? -minOver(velocity, peak, after) : NaN;
        taps.push({ time: peak / RATE, amplitude, opening, closing, index: peak });
    }
    if (taps.length < 4)
    {
        const few = { ok: false, reason: "few-taps", coverage, fps, tapCount: taps.length };
        return few;
    }
    const tapTimes = taps.map((t) => t.time);
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++)
    {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    const span = tapTimes[tapTimes.length - 1] - tapTimes[0];
    const rate = span > 0 ? (taps.length - 1) / span : 0;
    const typicalInterval = median(intervals);
    const pauses = intervals.filter((i) => i > Math.max(2 * typicalInterval, 0.5)).length;
    const amplitudes = taps.map((t) => t.amplitude);
    const openings = taps.map((t) => t.opening).filter((v) => isFinite(v));
    const indices = amplitudes.map((_, i) => i);
    const fit = linearRegression(indices, amplitudes);
    const meanAmplitude = mean(amplitudes);
    const traceTimes = [];
    const traceValues = downsampleForPlot(smooth, 480);
    for (let i = 0; i < traceValues.length; i++)
    {
        traceTimes.push(i * (smooth.length / traceValues.length) / RATE);
    }
    const result =
    {
        ok: true,
        coverage,
        fps,
        tapCount: taps.length,
        rate,
        meanAmplitude,
        amplitudeCv: std(amplitudes) / meanAmplitude * 100,
        intervalCv: intervals.length > 1 ? std(intervals) / mean(intervals) * 100 : 0,
        pauses,
        decrementPct: thirdsChange(amplitudes),
        decrementP: fit.pValue,
        slopePerTapPct: meanAmplitude > 0 ? fit.slope / meanAmplitude * 100 : 0,
        meanOpeningSpeed: openings.length ? mean(openings) : NaN,
        speedDecrementPct: openings.length >= 6 ? thirdsChange(openings) : 0,
        taps: taps.map((t) => ({ time: t.time, amplitude: t.amplitude })),
        fit: { slope: fit.slope, intercept: fit.intercept },
        trace: { times: traceTimes, values: traceValues }
    };
    return result;
}

export function asymmetry(right, left)
{
    if (!right || !left || !right.ok || !left.ok)
    {
        return null;
    }
    const ratePct = Math.abs(right.rate - left.rate) / ((right.rate + left.rate) / 2) * 100;
    const amplitudePct = Math.abs(right.meanAmplitude - left.meanAmplitude) / ((right.meanAmplitude + left.meanAmplitude) / 2) * 100;
    const rightScore = right.rate * right.meanAmplitude;
    const leftScore = left.rate * left.meanAmplitude;
    const summary =
    {
        ratePct,
        amplitudePct,
        weakerSide: rightScore < leftScore ? "right" : "left",
        largest: Math.max(ratePct, amplitudePct)
    };
    return summary;
}
