import { isSimulated } from "../env.js";
import { rms } from "../dsp.js";

let stream = null;
let context = null;
let workletReady = false;

export class MicError extends Error
{
    constructor(kind, cause)
    {
        super(kind);
        this.kind = kind;
        this.cause = cause;
    }
}

export async function openMicrophone()
{
    if (isSimulated())
    {
        return true;
    }
    if (stream && context)
    {
        if (context.state === "suspended")
        {
            await context.resume();
        }
        return true;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    {
        throw new MicError("unsupported");
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!context)
    {
        context = new Ctor();
    }
    const resuming = context.resume().catch(() => null);
    try
    {
        stream = await navigator.mediaDevices.getUserMedia(
        {
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
            video: false
        });
    }
    catch (error)
    {
        const denied = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
        throw new MicError(denied ? "denied" : "unsupported", error);
    }
    await resuming;
    if (context.state === "suspended")
    {
        await context.resume().catch(() => null);
    }
    return true;
}

export function closeMicrophone()
{
    if (stream)
    {
        for (const track of stream.getTracks())
        {
            track.stop();
        }
    }
    if (context)
    {
        context.close().catch(() => null);
    }
    stream = null;
    context = null;
    workletReady = false;
}

async function createCaptureNode(onChunk)
{
    if (context.audioWorklet && typeof AudioWorkletNode !== "undefined")
    {
        try
        {
            if (!workletReady)
            {
                await context.audioWorklet.addModule(new URL("./recorder-worklet.js", import.meta.url));
                workletReady = true;
            }
            const node = new AudioWorkletNode(context, "motus-recorder");
            node.port.onmessage = (event) => onChunk(event.data);
            return node;
        }
        catch (error)
        {
            workletReady = false;
        }
    }
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => onChunk(new Float32Array(event.inputBuffer.getChannelData(0)));
    return processor;
}

function merge(chunks, total)
{
    const out = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks)
    {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}

export function record(options)
{
    if (isSimulated())
    {
        return simulatedRecording(options);
    }
    const chunks = [];
    let total = 0;
    let node = null;
    let input = null;
    let sink = null;
    let finished = false;
    let resolveDone;
    const done = new Promise((resolve) =>
    {
        resolveDone = resolve;
    });
    const stop = () =>
    {
        if (finished)
        {
            return;
        }
        finished = true;
        if (input)
        {
            input.disconnect();
        }
        if (node)
        {
            node.disconnect();
        }
        if (sink)
        {
            sink.disconnect();
        }
        const recording = { samples: merge(chunks, total), sampleRate: context ? context.sampleRate : 48000 };
        resolveDone(recording);
    };
    (async () =>
    {
        node = await createCaptureNode((data) =>
        {
            if (finished)
            {
                return;
            }
            chunks.push(data);
            total += data.length;
            if (options.onLevel)
            {
                options.onLevel(rms(data));
            }
        });
        input = context.createMediaStreamSource(stream);
        sink = context.createGain();
        sink.gain.value = 0;
        input.connect(node);
        node.connect(sink);
        sink.connect(context.destination);
        if (options.durationMs)
        {
            window.setTimeout(stop, options.durationMs);
        }
    })();
    const controller = { done, stop };
    return controller;
}

function simulatedRecording(options)
{
    let finished = false;
    let resolveDone;
    const started = performance.now();
    const done = new Promise((resolve) =>
    {
        resolveDone = resolve;
    });
    const timer = window.setInterval(() =>
    {
        if (options.onLevel)
        {
            const t = (performance.now() - started) / 1000;
            const pause = t % 1.4 < 0.3;
            const gain = options.kind === "loud" ? 2.2 : 1;
            const level = options.kind === "noise" ? 0.002 : pause ? 0.004 : gain * (0.05 + 0.05 * Math.abs(Math.sin(t * 9)));
            options.onLevel(level);
        }
    }, 40);
    const stop = async () =>
    {
        if (finished)
        {
            return;
        }
        finished = true;
        window.clearInterval(timer);
        const seconds = Math.max(1, (performance.now() - started) / 1000);
        const signals = await import("../sim/signals.js");
        let samples;
        if (options.kind === "noise")
        {
            samples = signals.noiseSamples({ seconds });
        }
        else if (options.kind === "vowel")
        {
            samples = signals.vowelSamples({ seconds, f0: 128, wobbleSt: 0.25 });
        }
        else if (options.kind === "ddk")
        {
            samples = signals.ddkSamples({ seconds, rate: 4.1 });
        }
        else
        {
            samples = signals.readingSamples({ seconds: Math.max(seconds, 12), sdSemitones: 1.2 });
        }
        const recording = { samples, sampleRate: 48000 };
        resolveDone(recording);
    };
    if (options.durationMs)
    {
        window.setTimeout(stop, options.durationMs);
    }
    const controller = { done, stop };
    return controller;
}
