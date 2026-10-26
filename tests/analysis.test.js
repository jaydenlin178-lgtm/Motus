import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTapping, asymmetry } from "../js/analysis/tapping.js";
import { analyzeTremorPhase } from "../js/analysis/tremor.js";
import { analyzeFace } from "../js/analysis/face.js";
import { analyzeVowel, analyzeDdk, analyzeReading, noiseLevel } from "../js/analysis/voice.js";
import { analyzeSpiral } from "../js/analysis/spiral.js";
import { tappingFrames, tremorFrames, faceFrames, vowelSamples, ddkSamples, readingSamples, noiseSamples, spiralPoints } from "../js/sim/signals.js";

test("tapping recovers rate and size for steady tapping", () =>
{
    const result = analyzeTapping(tappingFrames({ rateHz: 3.2, amplitudeCm: 6 }));
    assert.ok(result.ok);
    assert.ok(Math.abs(result.rate - 3.2) < 0.15, `rate ${result.rate}`);
    assert.ok(Math.abs(result.meanAmplitude - 6) < 0.8, `amplitude ${result.meanAmplitude}`);
    assert.ok(Math.abs(result.decrementPct) < 12, `decrement ${result.decrementPct}`);
    assert.equal(result.pauses, 0);
});

test("tapping detects a shrinking sequence", () =>
{
    const result = analyzeTapping(tappingFrames({ rateHz: 2.6, amplitudeCm: 6, decrement: 0.5 }));
    assert.ok(result.ok);
    assert.ok(result.decrementPct > 30, `decrement ${result.decrementPct}`);
    assert.ok(result.decrementP < 0.01, `p ${result.decrementP}`);
});

test("tapping tolerates dropped frames", () =>
{
    const result = analyzeTapping(tappingFrames({ rateHz: 3, dropRate: 0.15 }));
    assert.ok(result.ok);
    assert.ok(Math.abs(result.rate - 3) < 0.25, `rate ${result.rate}`);
});

test("tapping reports a still hand instead of inventing taps", () =>
{
    const result = analyzeTapping(tappingFrames({ amplitudeCm: 0.2 }));
    assert.equal(result.ok, false);
});

test("asymmetry compares hands", () =>
{
    const right = analyzeTapping(tappingFrames({ rateHz: 3.4, amplitudeCm: 6 }));
    const left = analyzeTapping(tappingFrames({ rateHz: 2.2, amplitudeCm: 4, seed: 4 }));
    const summary = asymmetry(right, left);
    assert.equal(summary.weakerSide, "left");
    assert.ok(summary.largest > 30);
});

test("tremor detection finds a 5 Hz rest tremor and ignores a still hand", () =>
{
    const phase = analyzeTremorPhase(tremorFrames({ right: { hz: 5.1, ampMm: 4 } }));
    assert.ok(phase.right.ok && phase.left.ok);
    assert.ok(phase.right.detected, `concentration ${phase.right.concentration}`);
    assert.ok(Math.abs(phase.right.frequency - 5.1) < 0.2, `frequency ${phase.right.frequency}`);
    assert.ok(phase.right.parkinsonianRange);
    assert.equal(phase.left.detected, false);
});

test("tremor amplitude estimate is in the right range", () =>
{
    const phase = analyzeTremorPhase(tremorFrames({ left: { hz: 6, ampMm: 6 } }));
    assert.ok(phase.left.detected);
    assert.ok(phase.left.amplitudeMm > 3 && phase.left.amplitudeMm < 12, `amplitude ${phase.left.amplitudeMm}`);
});

test("face analysis counts blinks and measures expressions", () =>
{
    const data = faceFrames({ blinkEveryMs: 3000, smileAmp: 0.8, browAmp: 0.6 });
    const result = analyzeFace(data.frames, data.protocol);
    assert.ok(result.ok);
    assert.ok(Math.abs(result.blinkRate - 20) < 2.5, `blink rate ${result.blinkRate}`);
    assert.ok(Math.abs(result.smileAmplitude - 0.75) < 0.1, `smile ${result.smileAmplitude}`);
    assert.ok(result.riseMs < 600, `rise ${result.riseMs}`);
});

test("face analysis sees reduced expression", () =>
{
    const data = faceFrames({ smileAmp: 0.2, browAmp: 0.12, blinkEveryMs: 10000 });
    const result = analyzeFace(data.frames, data.protocol);
    assert.ok(result.smileAmplitude < 0.25);
    assert.ok(result.blinkRate < 8);
});

test("voice analysis measures a steady vowel", () =>
{
    const noise = noiseLevel(noiseSamples(), 48000);
    const result = analyzeVowel(vowelSamples({ f0: 160 }), 48000, noise);
    assert.ok(result.ok);
    assert.ok(Math.abs(result.meanF0 - 160) < 3, `f0 ${result.meanF0}`);
    assert.ok(result.f0SdSemitones < 0.4, `sd ${result.f0SdSemitones}`);
    assert.ok(result.hnrDb > 10, `hnr ${result.hnrDb}`);
});

test("voice analysis counts syllables in pa-ta-ka", () =>
{
    const noise = noiseLevel(noiseSamples(), 48000);
    const result = analyzeDdk(ddkSamples({ rate: 5.5 }), 48000, noise);
    assert.ok(result.ok);
    assert.ok(Math.abs(result.syllableRate - 5.5) < 0.4, `rate ${result.syllableRate}`);
});

test("reading analysis separates lively and flat pitch", () =>
{
    const noise = noiseLevel(noiseSamples(), 48000);
    const lively = analyzeReading(readingSamples({ sdSemitones: 3.2 }), 48000, noise);
    const flat = analyzeReading(readingSamples({ sdSemitones: 0.7, seed: 8 }), 48000, noise);
    assert.ok(lively.ok && flat.ok);
    assert.ok(lively.f0SdSemitones > flat.f0SdSemitones + 1, `lively ${lively.f0SdSemitones} flat ${flat.f0SdSemitones}`);
    assert.ok(lively.pauseRatio > 0.05 && lively.pauseRatio < 0.3, `pause ${lively.pauseRatio}`);
});

test("spiral analysis finds drawing tremor and passes a smooth spiral", () =>
{
    const template = { cx: 180, cy: 180, spacing: 34 };
    const shaky = analyzeSpiral(spiralPoints({ tremorHz: 5.5, tremorPx: 3 }), template);
    const smooth = analyzeSpiral(spiralPoints({ seed: 2 }), template);
    assert.ok(shaky.ok && smooth.ok);
    assert.ok(shaky.tremor.detected, `concentration ${shaky.tremor.concentration}`);
    assert.ok(Math.abs(shaky.tremor.frequency - 5.5) < 0.3, `frequency ${shaky.tremor.frequency}`);
    assert.equal(smooth.tremor.detected, false);
    assert.ok(smooth.templateErrorPct < 5, `template error ${smooth.templateErrorPct}`);
});
