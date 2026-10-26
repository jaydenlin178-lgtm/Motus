import test from "node:test";
import assert from "node:assert/strict";
import { mean, median, percentile, std, linearRegression, studentTwoTailedP, resampleUniform, powerSpectrum, bandPeak, findPeaks, filtfilt, yin, decimate, rms } from "../js/dsp.js";
import { createRandom } from "../js/sim/signals.js";

test("basic statistics", () =>
{
    assert.equal(mean([1, 2, 3, 4]), 2.5);
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(percentile([0, 10], 25), 2.5);
    assert.ok(Math.abs(std([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.001);
});

test("student t two-tailed p matches tables", () =>
{
    assert.ok(Math.abs(studentTwoTailedP(2.228, 10) - 0.05) < 0.001);
    assert.ok(Math.abs(studentTwoTailedP(1.96, 100000) - 0.05) < 0.001);
    assert.ok(Math.abs(studentTwoTailedP(0, 12) - 1) < 1e-9);
});

test("linear regression recovers slope and flags a real trend", () =>
{
    const random = createRandom(3);
    const xs = [];
    const ys = [];
    for (let i = 0; i < 30; i++)
    {
        xs.push(i);
        ys.push(10 - 0.2 * i + (random() - 0.5));
    }
    const fit = linearRegression(xs, ys);
    assert.ok(Math.abs(fit.slope + 0.2) < 0.03);
    assert.ok(fit.pValue < 0.001);
});

test("spectrum finds a 5 Hz oscillation in unevenly sampled data", () =>
{
    const random = createRandom(9);
    const times = [];
    const values = [];
    let t = 0;
    while (t < 12000)
    {
        times.push(t);
        values.push(Math.sin(2 * Math.PI * 5 * t / 1000) + (random() - 0.5) * 0.4);
        t += 33.3 + (random() - 0.5) * 8;
    }
    const series = resampleUniform(times, values, 30);
    const spectrum = powerSpectrum(series.values, 30, 1024);
    const peak = bandPeak(spectrum, 2, 12);
    assert.ok(Math.abs(peak.frequency - 5) < 0.1, `peak at ${peak.frequency}`);
});

test("peak finder counts oscillations", () =>
{
    const values = [];
    for (let i = 0; i < 600; i++)
    {
        values.push(Math.sin(2 * Math.PI * 3 * i / 60));
    }
    const peaks = findPeaks(values, { minDistance: 6, minProminence: 0.5 });
    assert.equal(peaks.length, 30);
});

test("zero-phase lowpass keeps a slow sine and removes a fast one", () =>
{
    const slow = [];
    const mixed = [];
    for (let i = 0; i < 600; i++)
    {
        const s = Math.sin(2 * Math.PI * 2 * i / 60);
        slow.push(s);
        mixed.push(s + 0.5 * Math.sin(2 * Math.PI * 20 * i / 60));
    }
    const filtered = filtfilt(mixed, "lowpass", 8, 60, 2);
    let error = 0;
    for (let i = 60; i < 540; i++)
    {
        error = Math.max(error, Math.abs(filtered[i] - slow[i]));
    }
    assert.ok(error < 0.08, `max error ${error}`);
});

test("YIN tracks pitch of a harmonic tone after decimation", () =>
{
    const rate = 48000;
    const samples = new Float64Array(rate);
    for (let i = 0; i < samples.length; i++)
    {
        const phase = 2 * Math.PI * 180 * i / rate;
        samples[i] = Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase);
    }
    const signal = decimate(samples, 6, rate);
    const frame = signal.subarray(2000, 2320);
    const estimate = yin(frame, 8000, 70, 400, 0.15);
    assert.ok(Math.abs(estimate.frequency - 180) < 1.5, `pitch ${estimate.frequency}`);
    assert.ok(rms(signal) > 0.5);
});
