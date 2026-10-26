import { median, resampleUniform, bandpass, powerSpectrum, addSpectra, bandPower, bandPeak, rms } from "../dsp.js";

const MIN_RATE = 12;

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

export function analyzeTremorHand(samples)
{
    const valid = samples.filter((s) => s && isFinite(s.palmX) && isFinite(s.mmPerPx));
    const coverage = samples.length ? valid.length / samples.length : 0;
    const fps = frameRate(samples.map((s) => s.t));
    if (valid.length < 45 || coverage < 0.6 || fps < MIN_RATE)
    {
        const failure = { ok: false, reason: fps < MIN_RATE ? "slow-camera" : "tracking", coverage, fps };
        return failure;
    }
    const scale = median(valid.map((s) => s.mmPerPx));
    const rate = Math.min(30, Math.max(MIN_RATE, Math.round(fps)));
    const top = Math.min(14, 0.45 * rate);
    const times = valid.map((s) => s.t);
    const channels =
    [
        valid.map((s) => s.palmX * scale),
        valid.map((s) => s.palmY * scale),
        valid.map((s) => (s.tipX - s.palmX) * scale),
        valid.map((s) => (s.tipY - s.palmY) * scale)
    ];
    const filtered = channels.map((values) => bandpass(resampleUniform(times, values, rate).values, 1.5, top, rate));
    let spectrum = null;
    for (const signal of filtered)
    {
        const part = powerSpectrum(signal, rate, 1024);
        spectrum = spectrum ? addSpectra(spectrum, part) : part;
    }
    const total = bandPower(spectrum, 2, top);
    const peak = bandPeak(spectrum, 3, Math.min(12, top));
    const peakPower = bandPower(spectrum, peak.frequency - 0.6, peak.frequency + 0.6);
    const concentration = total > 0 ? peakPower / total : 0;
    const narrowLow = Math.max(1, peak.frequency - 1.2);
    const narrowHigh = Math.min(top, peak.frequency + 1.2);
    const narrow = filtered.map((signal) => rms(bandpass(signal, narrowLow, narrowHigh, rate)));
    const palmRms = Math.hypot(narrow[0], narrow[1]);
    const fingerRms = Math.hypot(narrow[2], narrow[3]);
    const displacementRms = Math.max(palmRms, fingerRms);
    const detected = concentration >= 0.35 && displacementRms >= 0.5;
    const plotFreqs = [];
    const plotPower = [];
    let maxPower = 0;
    for (let k = 0; k < spectrum.freqs.length; k++)
    {
        if (spectrum.freqs[k] >= 1 && spectrum.freqs[k] <= top)
        {
            plotFreqs.push(spectrum.freqs[k]);
            plotPower.push(spectrum.power[k]);
            maxPower = Math.max(maxPower, spectrum.power[k]);
        }
    }
    const result =
    {
        ok: true,
        coverage,
        fps,
        frequency: peak.frequency,
        concentration,
        amplitudeMm: displacementRms * 2 * Math.SQRT2,
        detected,
        parkinsonianRange: detected && peak.frequency >= 3.5 && peak.frequency <= 7.5,
        spectrum: { freqs: plotFreqs, power: plotPower.map((p) => maxPower > 0 ? p / maxPower : 0) }
    };
    return result;
}

export function analyzeTremorPhase(frames)
{
    const right = frames.map((f) => (f.right ? { t: f.t, ...f.right } : { t: f.t }));
    const left = frames.map((f) => (f.left ? { t: f.t, ...f.left } : { t: f.t }));
    const phase = { right: analyzeTremorHand(right), left: analyzeTremorHand(left) };
    return phase;
}
