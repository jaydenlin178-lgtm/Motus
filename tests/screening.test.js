import test from "node:test";
import assert from "node:assert/strict";
import { posteriorProbability, priorForAge, computeScreening, prodromalStrength } from "../js/screening.js";
import { collectFlags } from "../js/analysis/flags.js";

function screening(age, sex, answers, results = {})
{
    const record = { age, sex, answers, results };
    return record;
}

const QUIET_ANSWERS =
{
    dreams: "no",
    smell: "no",
    constipation: "no",
    sleepiness: "no",
    dizziness: "no",
    urinary: "no",
    mood: "no",
    family: "no",
    pesticides: "no",
    solvents: "no",
    caffeine: "yes",
    smoking: "never",
    activity: "yes",
    diabetes: "no"
};

test("posterior matches the worked example in the 2015 criteria", () =>
{
    const prior = priorForAge(62);
    assert.equal(prior, 0.0125);
    const posterior = posteriorProbability(prior, [{ lr: 616 }]);
    assert.ok(Math.abs(posterior - 0.886) < 0.002, `posterior ${posterior}`);
});

test("no prior exists under age 50, so only movement is reported", () =>
{
    const summary = computeScreening(screening(42, "female", QUIET_ANSWERS));
    assert.equal(summary.mode, "motor");
    assert.equal(summary.tier, 1);
});

test("answers that lower risk keep the result at the first tier", () =>
{
    const summary = computeScreening(screening(66, "female", QUIET_ANSWERS));
    assert.equal(summary.mode, "risk");
    assert.equal(summary.tier, 1);
    assert.ok(summary.posteriorPct < summary.priorPct, `${summary.posteriorPct} vs ${summary.priorPct}`);
});

test("risk factors alone never reach the top tier", () =>
{
    const answers = { ...QUIET_ANSWERS, family: "yes", pesticides: "yes", solvents: "yes", caffeine: "no", activity: "no", diabetes: "yes", dreams: "unsure", constipation: "unsure", sleepiness: "unsure", dizziness: "unsure", urinary: "unsure", mood: "unsure" };
    const summary = computeScreening(screening(84, "male", answers));
    assert.ok(summary.posteriorPct >= 30, `posterior ${summary.posteriorPct}`);
    assert.equal(summary.prodromal, 1);
    assert.equal(summary.tier, 2);
});

test("strong prodromal signs reach the top tier", () =>
{
    const answers = { ...QUIET_ANSWERS, dreams: "yes", constipation: "yes", sleepiness: "yes", dizziness: "yes", caffeine: "no" };
    const summary = computeScreening(screening(68, "male", answers));
    assert.ok(prodromalStrength(summary.factors) >= 14);
    assert.ok(summary.posteriorPct >= 30, `posterior ${summary.posteriorPct}`);
    assert.equal(summary.tier, 3);
});

test("motor testing counts only when half the completed tests show findings", () =>
{
    const slowTap = { ok: true, rate: 1.9, tapCount: 20, decrementPct: 5, decrementP: 0.5, pauses: 0, intervalCv: 10, meanAmplitude: 5 };
    const normalTap = { ok: true, rate: 3.6, tapCount: 30, decrementPct: 4, decrementP: 0.6, pauses: 0, intervalCv: 9, meanAmplitude: 6 };
    const calmHand = { ok: true, detected: false, parkinsonianRange: false };
    const shakyHand = { ok: true, detected: true, parkinsonianRange: true, frequency: 5, amplitudeMm: 2 };
    const face = { ok: true, blinkRate: 16, smileAmplitude: 0.5, browAmplitude: 0.4, riseMs: 600 };
    const voice = { reading: { ok: true, f0SdSemitones: 2.4 }, ddk: { ok: true, syllableRate: 5.8 } };
    const borderline = collectFlags({ tapRight: slowTap, tapLeft: slowTap, tremorRest: { right: calmHand, left: calmHand }, face, voice });
    assert.equal(borderline.completed, 4);
    assert.equal(borderline.abnormal, 1);
    assert.equal(borderline.status, "borderline");
    const positive = collectFlags({ tapRight: slowTap, tapLeft: normalTap, tremorRest: { right: calmHand, left: shakyHand }, face, voice });
    assert.equal(positive.abnormal, 2);
    assert.equal(positive.status, "positive");
    const negative = collectFlags({ tapRight: normalTap, tapLeft: normalTap, face, voice });
    assert.equal(negative.status, "negative");
    const single = collectFlags({ tapRight: slowTap });
    assert.equal(single.status, "insufficient");
});

test("a borderline movement result is noted but not counted", () =>
{
    const slowTap = { ok: true, rate: 1.9, tapCount: 20, decrementPct: 5, decrementP: 0.5, pauses: 0, intervalCv: 10, meanAmplitude: 5 };
    const face = { ok: true, blinkRate: 16, smileAmplitude: 0.5, browAmplitude: 0.4, riseMs: 600 };
    const voice = { reading: { ok: true, f0SdSemitones: 2.4 }, ddk: { ok: true, syllableRate: 5.8 } };
    const summary = computeScreening(screening(70, "female", QUIET_ANSWERS, { tapRight: slowTap, tapLeft: slowTap, face, voice }));
    assert.equal(summary.motor.status, "borderline");
    assert.ok(!summary.factors.some((factor) => factor.id === "motor"));
    assert.ok(summary.notes.some((note) => note.labelKey === "factor.motor.borderline"));
});
