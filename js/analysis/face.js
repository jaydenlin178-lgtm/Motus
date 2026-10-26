import { mean, median, downsampleForPlot } from "../dsp.js";

const BLINK_ON = 0.5;
const BLINK_OFF = 0.3;
const MIN_RESPONSE = 0.08;

export function countBlinks(frames)
{
    let closed = false;
    let count = 0;
    let lastBlink = -Infinity;
    const events = [];
    for (const frame of frames)
    {
        if (!frame.present)
        {
            continue;
        }
        if (!closed && frame.blink >= BLINK_ON)
        {
            closed = true;
            if (frame.t - lastBlink > 120)
            {
                count++;
                events.push(frame.t);
                lastBlink = frame.t;
            }
        }
        else if (closed && frame.blink <= BLINK_OFF)
        {
            closed = false;
        }
    }
    const result = { count, events };
    return result;
}

function expressionResponse(frames, cueTime, read)
{
    const before = frames.filter((f) => f.present && f.t >= cueTime - 800 && f.t < cueTime).map(read);
    const during = frames.filter((f) => f.present && f.t >= cueTime && f.t <= cueTime + 3200);
    if (during.length < 10)
    {
        return null;
    }
    const baseline = before.length ? median(before) : Math.min(...during.map(read));
    let peak = -Infinity;
    for (const frame of during)
    {
        peak = Math.max(peak, read(frame));
    }
    const amplitude = Math.max(0, peak - baseline);
    let riseMs = NaN;
    for (const frame of during)
    {
        if (amplitude < MIN_RESPONSE)
        {
            break;
        }
        if (read(frame) >= baseline + 0.8 * amplitude)
        {
            riseMs = frame.t - cueTime;
            break;
        }
    }
    const response = { amplitude, riseMs, peak, baseline };
    return response;
}

export function analyzeFace(frames, protocol)
{
    const neutral = frames.filter((f) => f.t >= protocol.neutralStart && f.t <= protocol.neutralEnd);
    const present = neutral.filter((f) => f.present);
    const coverage = neutral.length ? present.length / neutral.length : 0;
    if (present.length < 60 || coverage < 0.6)
    {
        const failure = { ok: false, reason: "tracking", coverage };
        return failure;
    }
    const seconds = (protocol.neutralEnd - protocol.neutralStart) / 1000;
    const blinks = countBlinks(neutral);
    const smileResponses = [];
    const smileAsymmetries = [];
    const browResponses = [];
    for (const cue of protocol.cues)
    {
        if (cue.type === "smile")
        {
            const response = expressionResponse(frames, cue.t, (f) => (f.smileL + f.smileR) / 2);
            if (response)
            {
                smileResponses.push(response);
                const left = expressionResponse(frames, cue.t, (f) => f.smileL);
                const right = expressionResponse(frames, cue.t, (f) => f.smileR);
                if (left && right && left.peak + right.peak > 0)
                {
                    smileAsymmetries.push(Math.abs(left.peak - right.peak) / ((left.peak + right.peak) / 2) * 100);
                }
            }
        }
        else if (cue.type === "brow")
        {
            const response = expressionResponse(frames, cue.t, (f) => f.brow);
            if (response)
            {
                browResponses.push(response);
            }
        }
    }
    const blinkTrace = downsampleForPlot(neutral.map((f) => (f.present ? f.blink : 0)), 360);
    const smileTrace = downsampleForPlot(frames.filter((f) => f.t > protocol.neutralEnd).map((f) => (f.present ? Math.max((f.smileL + f.smileR) / 2, f.brow) : 0)), 360);
    const rises = smileResponses.concat(browResponses).map((r) => r.riseMs).filter((v) => isFinite(v));
    const result =
    {
        ok: true,
        coverage,
        neutralSeconds: seconds,
        blinkCount: blinks.count,
        blinkRate: blinks.count / seconds * 60,
        smileAmplitude: smileResponses.length ? Math.max(...smileResponses.map((r) => r.amplitude)) : NaN,
        browAmplitude: browResponses.length ? Math.max(...browResponses.map((r) => r.amplitude)) : NaN,
        smileAsymmetry: smileAsymmetries.length ? mean(smileAsymmetries) : NaN,
        riseMs: rises.length ? mean(rises) : NaN,
        traces: { blink: blinkTrace, expression: smileTrace }
    };
    return result;
}
