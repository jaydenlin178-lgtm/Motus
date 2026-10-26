import { createRandom } from "./signals.js";

const random = createRandom(71);

function gaussian()
{
    const u = Math.max(random(), 1e-12);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function walkingSignal(seconds, cadence, jitter = 0.04, start = 0)
{
    const samples = [];
    const stepGap = 60 / cadence;
    const steps = [];
    let at = 0.3;
    while (at < seconds + 1)
    {
        steps.push(at);
        at += stepGap * (1 + gaussian() * jitter);
    }
    for (let t = 0; t <= seconds; t += 0.02)
    {
        let m = 9.81 + gaussian() * 0.15;
        for (const step of steps)
        {
            const d = (t - step) / 0.07;
            if (Math.abs(d) < 4)
            {
                m += 3.2 * Math.exp(-d * d);
            }
        }
        samples.push({ t: start + t * 1000, m });
    }
    return samples;
}

export function startFakeMotion(getCadence, onSample)
{
    const started = performance.now();
    let produced = 0;
    let steps = [];
    let nextStep = 0.4;
    const timer = window.setInterval(() =>
    {
        const elapsed = (performance.now() - started) / 1000;
        const cadence = getCadence();
        while (nextStep < elapsed + 1)
        {
            steps.push(nextStep);
            nextStep += 60 / cadence * (1 + gaussian() * 0.035);
        }
        steps = steps.filter((s) => s > elapsed - 1);
        while (produced * 0.02 <= elapsed)
        {
            const t = produced * 0.02;
            let m = 9.81 + gaussian() * 0.15;
            for (const step of steps)
            {
                const d = (t - step) / 0.07;
                if (Math.abs(d) < 4)
                {
                    m += 3.2 * Math.exp(-d * d);
                }
            }
            onSample(started + t * 1000, m);
            produced++;
        }
    }, 40);
    return () =>
    {
        window.clearInterval(timer);
    };
}
