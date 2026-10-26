export function createRandom(seed = 7)
{
    let state = seed >>> 0;
    return function next()
    {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function gaussian(random)
{
    const u = Math.max(random(), 1e-12);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function frameTimes(durationMs, fps, jitterMs, random)
{
    const times = [];
    let t = 0;
    while (t <= durationMs)
    {
        times.push(t);
        t += 1000 / fps + (random() - 0.5) * 2 * jitterMs;
    }
    return times;
}

export function tappingFrames(options = {})
{
    const random = createRandom(options.seed || 11);
    const durationMs = options.durationMs || 10000;
    const fps = options.fps || 30;
    const rate = options.rateHz || 3;
    const amplitude = options.amplitudeCm || 6;
    const decrement = options.decrement || 0;
    const noise = options.noiseCm === undefined ? 0.15 : options.noiseCm;
    const slowdown = options.slowdown || 0;
    const times = frameTimes(durationMs, fps, options.jitterMs || 4, random);
    const frames = [];
    let phase = 0;
    let last = 0;
    for (const t of times)
    {
        const progress = t / durationMs;
        const localRate = rate * (1 - slowdown * progress);
        phase += 2 * Math.PI * localRate * (t - last) / 1000;
        last = t;
        const size = amplitude * (1 - decrement * progress);
        const openness = 0.5 - 0.5 * Math.cos(phase);
        const d = 0.4 + size * openness + gaussian(random) * noise;
        const dropped = options.dropRate && random() < options.dropRate;
        frames.push({ t, d: dropped ? null : Math.max(0, d) });
    }
    return frames;
}

export function tremorFrames(options = {})
{
    const random = createRandom(options.seed || 23);
    const durationMs = options.durationMs || 15000;
    const fps = options.fps || 30;
    const mmPerPx = options.mmPerPx || 0.7;
    const noisePx = options.noisePx === undefined ? 0.6 : options.noisePx;
    const times = frameTimes(durationMs, fps, options.jitterMs || 4, random);
    const hands = { right: options.right || null, left: options.left || null };
    const frames = [];
    for (const t of times)
    {
        const frame = { t };
        for (const side of ["right", "left"])
        {
            const spec = hands[side] || { hz: 0, ampMm: 0 };
            const baseX = side === "right" ? 200 : 440;
            const drift = 3 * Math.sin(2 * Math.PI * 0.2 * t / 1000);
            const tremorPx = spec.ampMm / 2 / mmPerPx * Math.sin(2 * Math.PI * spec.hz * t / 1000);
            frame[side] =
            {
                palmX: baseX + drift + tremorPx + gaussian(random) * noisePx,
                palmY: 300 + drift * 0.5 + tremorPx * 0.6 + gaussian(random) * noisePx,
                tipX: baseX + drift + tremorPx * 1.4 + gaussian(random) * noisePx * 1.4,
                tipY: 220 + drift * 0.5 + tremorPx * 0.8 + gaussian(random) * noisePx * 1.4,
                mmPerPx
            };
        }
        frames.push(frame);
    }
    return frames;
}

export function faceFrames(options = {})
{
    const random = createRandom(options.seed || 31);
    const neutralMs = options.neutralMs || 30000;
    const totalMs = neutralMs + 14000;
    const fps = options.fps || 30;
    const blinkEveryMs = options.blinkEveryMs || 3500;
    const smileAmp = options.smileAmp === undefined ? 0.75 : options.smileAmp;
    const browAmp = options.browAmp === undefined ? 0.6 : options.browAmp;
    const riseMs = options.riseMs || 450;
    const cues =
    [
        { type: "smile", t: neutralMs + 1000 },
        { type: "brow", t: neutralMs + 5500 },
        { type: "smile", t: neutralMs + 10000 }
    ];
    const times = frameTimes(totalMs, fps, 3, random);
    const frames = [];
    for (const t of times)
    {
        let blink = 0.05 + random() * 0.05;
        const sinceBlink = t % blinkEveryMs;
        if (t < neutralMs && sinceBlink < 150)
        {
            blink = 0.85;
        }
        let smile = 0.04 + random() * 0.03;
        let brow = 0.05 + random() * 0.03;
        for (const cue of cues)
        {
            const elapsed = t - cue.t;
            if (elapsed >= 0 && elapsed <= 3000)
            {
                const level = Math.min(1, elapsed / riseMs);
                if (cue.type === "smile")
                {
                    smile = Math.max(smile, smileAmp * level);
                }
                else
                {
                    brow = Math.max(brow, browAmp * level);
                }
            }
        }
        frames.push({ t, present: true, blink, smileL: smile, smileR: smile * 0.95, brow });
    }
    const protocol = { neutralStart: 0, neutralEnd: neutralMs, cues };
    const result = { frames, protocol };
    return result;
}

export function voicedTone(f0Track, sampleRate, amplitude = 0.2, random = createRandom(5))
{
    const out = new Float32Array(f0Track.length);
    let phase = 0;
    for (let i = 0; i < f0Track.length; i++)
    {
        const f0 = f0Track[i];
        if (f0 > 0)
        {
            phase += 2 * Math.PI * f0 / sampleRate;
            let value = 0;
            for (let h = 1; h <= 8; h++)
            {
                value += Math.sin(h * phase) / h;
            }
            out[i] = amplitude * 0.6 * value + gaussian(random) * 0.002;
        }
        else
        {
            out[i] = gaussian(random) * 0.002;
        }
    }
    return out;
}

export function vowelSamples(options = {})
{
    const sampleRate = options.sampleRate || 48000;
    const seconds = options.seconds || 6;
    const f0 = options.f0 || 150;
    const track = new Float64Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < track.length; i++)
    {
        const t = i / sampleRate;
        const wobble = (options.wobbleSt || 0.15) * Math.sin(2 * Math.PI * 5 * t);
        track[i] = t > 0.3 && t < seconds - 0.3 ? f0 * Math.pow(2, wobble / 12) : 0;
    }
    return voicedTone(track, sampleRate);
}

export function ddkSamples(options = {})
{
    const sampleRate = options.sampleRate || 48000;
    const seconds = options.seconds || 6;
    const rate = options.rate || 5.5;
    const f0 = options.f0 || 140;
    const track = new Float64Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < track.length; i++)
    {
        const t = i / sampleRate;
        const cycle = (t * rate) % 1;
        track[i] = t > 0.4 && t < seconds - 0.4 && cycle < 0.55 ? f0 : 0;
    }
    return voicedTone(track, sampleRate);
}

export function readingSamples(options = {})
{
    const sampleRate = options.sampleRate || 48000;
    const seconds = options.seconds || 20;
    const f0 = options.f0 || 130;
    const spread = options.sdSemitones || 3;
    const random = createRandom(options.seed || 41);
    const track = new Float64Array(Math.round(seconds * sampleRate));
    const syllableRate = options.syllableRate || 4.5;
    let target = 0;
    let current = 0;
    for (let i = 0; i < track.length; i++)
    {
        const t = i / sampleRate;
        if (i % Math.round(sampleRate * 0.25) === 0)
        {
            target = gaussian(random) * spread;
        }
        current += (target - current) * 0.0004;
        const inPause = (t % 5) > 4.4;
        const syllable = ((t * syllableRate) % 1) < 0.7;
        track[i] = t > 0.5 && t < seconds - 0.5 && !inPause && syllable ? f0 * Math.pow(2, current / 12) : 0;
    }
    return voicedTone(track, sampleRate, 0.18, random);
}

export function noiseSamples(options = {})
{
    const sampleRate = options.sampleRate || 48000;
    const seconds = options.seconds || 2;
    const random = createRandom(options.seed || 3);
    const out = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < out.length; i++)
    {
        out[i] = gaussian(random) * (options.level || 0.002);
    }
    return out;
}

export function spiralPoints(options = {})
{
    const random = createRandom(options.seed || 53);
    const cx = options.cx || 180;
    const cy = options.cy || 180;
    const spacing = options.spacing || 34;
    const turns = options.turns || 3;
    const seconds = options.seconds || 7;
    const sampleHz = options.sampleHz || 90;
    const tremorHz = options.tremorHz || 0;
    const tremorPx = options.tremorPx || 0;
    const points = [];
    const count = Math.round(seconds * sampleHz);
    for (let i = 0; i <= count; i++)
    {
        const t = i * 1000 / sampleHz + (random() - 0.5) * 3;
        const progress = i / count;
        const angle = progress * turns * 2 * Math.PI;
        const radius = spacing * angle / (2 * Math.PI) + tremorPx * Math.sin(2 * Math.PI * tremorHz * t / 1000) + gaussian(random) * 0.4;
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), t: Math.max(0, t) });
    }
    points.sort((a, b) => a.t - b.t);
    return points;
}
