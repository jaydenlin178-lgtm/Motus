import { asymmetry } from "./tapping.js";

export const THRESHOLDS =
{
    slowTappingRate: 2.5,
    decrementPct: 30,
    decrementP: 0.05,
    pauses: 2,
    irregularCv: 30,
    asymmetryPct: 30,
    lowBlinkRate: 8,
    reducedSmile: 0.35,
    reducedBrow: 0.25,
    slowRiseMs: 1100,
    monotoneSemitones: 1.6,
    slowDdkRate: 4.5
};

function tappingFlags(result, side, flags)
{
    if (!result || !result.ok)
    {
        return;
    }
    if (result.rate < THRESHOLDS.slowTappingRate)
    {
        flags.push({ id: "slowTapping", test: "tapping", side });
    }
    if (result.tapCount >= 8 && result.decrementPct >= THRESHOLDS.decrementPct && result.decrementP < THRESHOLDS.decrementP)
    {
        flags.push({ id: "decrement", test: "tapping", side });
    }
    if (result.pauses >= THRESHOLDS.pauses)
    {
        flags.push({ id: "pauses", test: "tapping", side });
    }
    if (result.intervalCv > THRESHOLDS.irregularCv)
    {
        flags.push({ id: "irregular", test: "tapping", side });
    }
}

function uniqueById(flags)
{
    const seen = new Map();
    for (const flag of flags)
    {
        if (!seen.has(flag.id))
        {
            seen.set(flag.id, { ...flag, sides: flag.side ? [flag.side] : [] });
        }
        else if (flag.side)
        {
            const existing = seen.get(flag.id);
            if (!existing.sides.includes(flag.side))
            {
                existing.sides.push(flag.side);
            }
        }
    }
    return Array.from(seen.values());
}

export function collectFlags(results)
{
    const flags = [];
    const tested = [];
    if (results.tapRight || results.tapLeft)
    {
        tested.push("tapping");
    }
    tappingFlags(results.tapRight, "right", flags);
    tappingFlags(results.tapLeft, "left", flags);
    const sides = asymmetry(results.tapRight, results.tapLeft);
    if (sides && sides.largest >= THRESHOLDS.asymmetryPct)
    {
        flags.push({ id: "asymmetry", test: "tapping", side: sides.weakerSide });
    }
    if (results.tremorRest)
    {
        tested.push("tremor");
        for (const side of ["right", "left"])
        {
            const hand = results.tremorRest[side];
            if (hand && hand.ok && hand.parkinsonianRange)
            {
                flags.push({ id: "restTremor", test: "tremor", side });
            }
        }
    }
    if (results.face && results.face.ok)
    {
        tested.push("face");
        const face = results.face;
        if (face.blinkRate < THRESHOLDS.lowBlinkRate)
        {
            flags.push({ id: "lowBlink", test: "face" });
        }
        if (face.smileAmplitude < THRESHOLDS.reducedSmile && face.browAmplitude < THRESHOLDS.reducedBrow)
        {
            flags.push({ id: "reducedExpression", test: "face" });
        }
        if (face.riseMs > THRESHOLDS.slowRiseMs)
        {
            flags.push({ id: "slowExpression", test: "face" });
        }
    }
    if (results.voice)
    {
        tested.push("voice");
        const reading = results.voice.reading;
        const ddk = results.voice.ddk;
        if (reading && reading.ok && reading.f0SdSemitones < THRESHOLDS.monotoneSemitones)
        {
            flags.push({ id: "monotone", test: "voice" });
        }
        if (ddk && ddk.ok && ddk.syllableRate < THRESHOLDS.slowDdkRate)
        {
            flags.push({ id: "slowDdk", test: "voice" });
        }
    }
    if (results.spiralRight || results.spiralLeft)
    {
        tested.push("spiral");
        for (const side of ["right", "left"])
        {
            const spiral = results[side === "right" ? "spiralRight" : "spiralLeft"];
            if (spiral && spiral.ok && spiral.tremor.detected)
            {
                flags.push({ id: "spiralTremor", test: "spiral", side });
            }
        }
    }
    const unique = uniqueById(flags);
    const abnormalTests = tested.filter((test) => unique.some((flag) => flag.test === test));
    let status = "insufficient";
    if (tested.length >= 2)
    {
        if (abnormalTests.length * 2 >= tested.length)
        {
            status = "positive";
        }
        else if (abnormalTests.length === 0)
        {
            status = "negative";
        }
        else
        {
            status = "borderline";
        }
    }
    const summary =
    {
        flags: unique,
        count: unique.length,
        tested,
        abnormalTests,
        completed: tested.length,
        abnormal: abnormalTests.length,
        status,
        positive: status === "positive"
    };
    return summary;
}
