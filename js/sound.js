let context = null;

function getContext()
{
    if (!context)
    {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor)
        {
            return null;
        }
        context = new Ctor();
    }
    if (context.state === "suspended")
    {
        context.resume();
    }
    return context;
}

export function unlockAudio()
{
    getContext();
}

export function tone(frequency = 660, duration = 0.12, volume = 0.18)
{
    const ctx = getContext();
    if (!ctx)
    {
        return;
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
}

export function tick()
{
    tone(520, 0.09, 0.14);
}

export function go()
{
    tone(880, 0.22, 0.2);
}

export function done()
{
    tone(660, 0.12, 0.16);
    window.setTimeout(() =>
    {
        tone(990, 0.2, 0.16);
    }, 140);
}

function click(ctx, at, accent)
{
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1320 : 990;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.16, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.08);
}

export function startMetronome(bpm, onBeat)
{
    const ctx = getContext();
    if (!ctx)
    {
        const silent =
        {
            stop()
            {
                return null;
            }
        };
        return silent;
    }
    const interval = 60 / bpm;
    let next = ctx.currentTime + 0.15;
    let count = 0;
    const timers = [];
    const pump = () =>
    {
        while (next < ctx.currentTime + 0.25)
        {
            click(ctx, next, count % 4 === 0);
            const delay = Math.max(0, (next - ctx.currentTime) * 1000);
            const index = count;
            timers.push(window.setTimeout(() =>
            {
                if (onBeat)
                {
                    onBeat(index);
                }
            }, delay));
            next += interval;
            count++;
        }
    };
    pump();
    const loop = window.setInterval(pump, 60);
    const controller =
    {
        stop()
        {
            window.clearInterval(loop);
            for (const timer of timers)
            {
                window.clearTimeout(timer);
            }
        }
    };
    return controller;
}
