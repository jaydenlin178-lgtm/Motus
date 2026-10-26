import { decimate, yin, rms, toDecibels, median, std, mean, normalizedAutocorrelation, findPeaks, movingAverage, downsampleForPlot } from "../dsp.js";

const TARGET_RATE = 8000;
const FRAME_MS = 40;
const HOP_MS = 10;
const MIN_F0 = 70;
const MAX_F0 = 400;

export function prepare(samples, sampleRate)
{
    const factor = Math.max(1, Math.floor(sampleRate / TARGET_RATE));
    const prepared = { signal: decimate(samples, factor, sampleRate), rate: sampleRate / factor };
    return prepared;
}

export function frameFeatures(signal, rate, voiceFloor, withPitch)
{
    const frameLength = Math.round(rate * FRAME_MS / 1000);
    const hop = Math.round(rate * HOP_MS / 1000);
    const frames = [];
    for (let start = 0; start + frameLength <= signal.length; start += hop)
    {
        const frame = signal.subarray(start, start + frameLength);
        const level = rms(frame);
        let f0 = NaN;
        let aperiodicity = 1;
        if (withPitch && level > voiceFloor)
        {
            const estimate = yin(frame, rate, MIN_F0, MAX_F0, 0.15);
            f0 = estimate.frequency;
            aperiodicity = estimate.aperiodicity;
        }
        const voiced = level > voiceFloor && aperiodicity < 0.25 && f0 >= MIN_F0 && f0 <= MAX_F0;
        frames.push({ t: (start + frameLength / 2) / rate, start, level, db: toDecibels(level), f0, voiced });
    }
    const features = { frames, frameLength, hop, rate };
    return features;
}

export function noiseLevel(samples, sampleRate)
{
    const prepared = prepare(samples, sampleRate);
    const features = frameFeatures(prepared.signal, prepared.rate, Infinity, false);
    const levels = features.frames.map((f) => f.level);
    const level = levels.length ? median(levels) : 0;
    return level;
}

export function voiceFloorFrom(noise)
{
    return Math.max(noise * 3.2, 0.0015);
}

function cleanPitch(frames, window)
{
    const voiced = frames.filter((f) => f.voiced);
    if (voiced.length === 0)
    {
        return voiced;
    }
    const kept = [];
    for (let i = 0; i < voiced.length; i++)
    {
        const lo = Math.max(0, i - window);
        const hi = Math.min(voiced.length - 1, i + window);
        const local = [];
        for (let k = lo; k <= hi; k++)
        {
            local.push(voiced[k].f0);
        }
        const reference = median(local);
        if (Math.abs(12 * Math.log2(voiced[i].f0 / reference)) <= 5)
        {
            kept.push(voiced[i]);
        }
    }
    return kept;
}

function semitoneSd(frequencies)
{
    if (frequencies.length < 3)
    {
        return NaN;
    }
    const reference = median(frequencies);
    return std(frequencies.map((f) => 12 * Math.log2(f / reference)));
}

function pitchContour(frames, maxPoints)
{
    const voicedF0 = frames.filter((f) => f.voiced).map((f) => f.f0);
    const reference = voicedF0.length ? median(voicedF0) : 1;
    const values = frames.map((f) => (f.voiced ? 12 * Math.log2(f.f0 / reference) : NaN));
    return downsampleForPlot(values, maxPoints);
}

export function analyzeVowel(samples, sampleRate, noise)
{
    const prepared = prepare(samples, sampleRate);
    const features = frameFeatures(prepared.signal, prepared.rate, voiceFloorFrom(noise), true);
    const voicedAll = cleanPitch(features.frames, 15);
    if (voicedAll.length < 80)
    {
        const failure = { ok: false, reason: "no-voice" };
        return failure;
    }
    const trim = Math.floor(voicedAll.length * 0.1);
    const voiced = voicedAll.slice(trim, voicedAll.length - trim);
    const f0s = voiced.map((f) => f.f0);
    const steps = [];
    for (let i = 1; i < voiced.length; i++)
    {
        if (Math.abs(voiced[i].start - voiced[i - 1].start) <= features.hop * 1.5)
        {
            steps.push(Math.abs(voiced[i].f0 - voiced[i - 1].f0));
        }
    }
    const levels = voiced.map((f) => f.level);
    const hnrValues = [];
    for (let i = 0; i < voiced.length; i += 3)
    {
        const frame = prepared.signal.subarray(voiced[i].start, voiced[i].start + features.frameLength);
        const lag = Math.round(prepared.rate / voiced[i].f0);
        const r = Math.min(0.999, Math.max(0.01, normalizedAutocorrelation(frame, lag)));
        hnrValues.push(10 * Math.log10(r / (1 - r)));
    }
    const result =
    {
        ok: true,
        voicedSeconds: voicedAll.length * HOP_MS / 1000,
        meanF0: mean(f0s),
        f0SdSemitones: semitoneSd(f0s),
        perturbationPct: steps.length ? mean(steps) / mean(f0s) * 100 : NaN,
        amplitudeCv: std(levels) / mean(levels) * 100,
        hnrDb: mean(hnrValues),
        contour: pitchContour(features.frames, 300)
    };
    return result;
}

export function analyzeDdk(samples, sampleRate, noise)
{
    const prepared = prepare(samples, sampleRate);
    const floor = voiceFloorFrom(noise);
    const features = frameFeatures(prepared.signal, prepared.rate, floor, false);
    const frames = features.frames;
    const active = frames.filter((f) => f.level > floor);
    if (active.length < 60)
    {
        const failure = { ok: false, reason: "no-voice" };
        return failure;
    }
    const envelope = movingAverage(frames.map((f) => f.db), 3);
    const peaks = findPeaks(envelope, { minDistance: 7, minProminence: 4 }).filter((p) => frames[p.index].level > floor);
    if (peaks.length < 5)
    {
        const few = { ok: false, reason: "few-syllables", count: peaks.length };
        return few;
    }
    const times = peaks.map((p) => frames[p.index].t);
    const intervals = [];
    for (let i = 1; i < times.length; i++)
    {
        intervals.push(times[i] - times[i - 1]);
    }
    const typical = median(intervals);
    const steady = intervals.filter((i) => i <= 3 * typical);
    const totalTime = steady.reduce((a, b) => a + b, 0);
    const result =
    {
        ok: true,
        count: peaks.length,
        syllableRate: totalTime > 0 ? steady.length / totalTime : NaN,
        intervalCv: steady.length > 2 ? std(steady) / mean(steady) * 100 : NaN,
        envelope: downsampleForPlot(envelope, 300)
    };
    return result;
}

export function analyzeReading(samples, sampleRate, noise)
{
    const prepared = prepare(samples, sampleRate);
    const floor = voiceFloorFrom(noise);
    const features = frameFeatures(prepared.signal, prepared.rate, floor, true);
    const frames = features.frames;
    let first = -1;
    let last = -1;
    for (let i = 0; i < frames.length; i++)
    {
        if (frames[i].level > floor)
        {
            if (first < 0)
            {
                first = i;
            }
            last = i;
        }
    }
    if (first < 0 || last - first < 200)
    {
        const failure = { ok: false, reason: "no-voice" };
        return failure;
    }
    const span = frames.slice(first, last + 1);
    let pausedFrames = 0;
    let run = 0;
    let pauseCount = 0;
    for (const frame of span)
    {
        if (frame.level <= floor)
        {
            run++;
        }
        else
        {
            if (run >= 25)
            {
                pausedFrames += run;
                pauseCount++;
            }
            run = 0;
        }
    }
    const voiced = cleanPitch(span, 10);
    const envelope = movingAverage(span.map((f) => f.db), 3);
    const syllables = findPeaks(envelope, { minDistance: 10, minProminence: 3 }).filter((p) => span[p.index].voiced);
    const duration = span.length * HOP_MS / 1000;
    const speaking = duration - pausedFrames * HOP_MS / 1000;
    const voicedDb = voiced.map((f) => f.db);
    const result =
    {
        ok: voiced.length >= 100,
        reason: voiced.length >= 100 ? null : "no-voice",
        duration,
        pauseRatio: pausedFrames / span.length,
        pauseCount,
        f0SdSemitones: semitoneSd(voiced.map((f) => f.f0)),
        intensitySdDb: voicedDb.length > 2 ? std(voicedDb) : NaN,
        speechRate: syllables.length / duration,
        articulationRate: speaking > 0 ? syllables.length / speaking : NaN,
        contour: pitchContour(span, 360)
    };
    return result;
}
