import { h, clear, formatNumber } from "../ui.js";
import { icon } from "../icons.js";
import { t, currentLang } from "../i18n.js";
import { isSimulated } from "../env.js";
import { analyzeSteps } from "../analysis/gait.js";
import { startMetronome, done as doneTone, unlockAudio } from "../sound.js";
import { speak, stopSpeaking } from "../speech.js";
import { setBusy } from "../busy.js";
import { createTimer } from "../views/capture-ui.js";
import { readout } from "../views/result-blocks.js";
import { stickyActions, button } from "../views/steps/common.js";
import { startFakeMotion } from "../sim/fake-motion.js";
import { phaseLabel, countPanel } from "./shared.js";

const MEASURE_MS = 30000;
const PRACTICE_MS = 60000;

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function askMotion()
{
    if (isSimulated())
    {
        return Promise.resolve("granted");
    }
    if (typeof window.DeviceMotionEvent === "undefined")
    {
        return Promise.resolve("unsupported");
    }
    if (typeof window.DeviceMotionEvent.requestPermission === "function")
    {
        return window.DeviceMotionEvent.requestPermission().catch(() => "denied");
    }
    return Promise.resolve("granted");
}

function listen(onSample, getCadence)
{
    if (isSimulated())
    {
        return startFakeMotion(getCadence, onSample);
    }
    const handler = (event) =>
    {
        const a = event.accelerationIncludingGravity;
        if (!a || a.x === null || a.x === undefined)
        {
            return;
        }
        onSample(performance.now(), Math.hypot(a.x, a.y || 0, a.z || 0));
    };
    window.addEventListener("devicemotion", handler);
    return () =>
    {
        window.removeEventListener("devicemotion", handler);
    };
}

function recordWalk(api, durationMs, simCadence, timer, onSteps)
{
    return new Promise((resolve) =>
    {
        const samples = [];
        let finished = false;
        let lastCount = 0;
        const started = performance.now();
        const stopListening = listen((time, magnitude) =>
        {
            samples.push({ t: time, m: magnitude });
        }, () => simCadence);
        const ticker = window.setInterval(() =>
        {
            const elapsed = performance.now() - started;
            timer.set(elapsed);
            if (elapsed - lastCount >= 1000)
            {
                lastCount = elapsed;
                const live = analyzeSteps(samples);
                if (live.ok)
                {
                    onSteps(live.steps);
                }
            }
            if (elapsed > 3000 && samples.length === 0)
            {
                finish("no-sensor");
            }
            else if (elapsed >= durationMs)
            {
                finish(null);
            }
        }, 100);
        function finish(reason)
        {
            if (finished)
            {
                return;
            }
            finished = true;
            window.clearInterval(ticker);
            stopListening();
            resolve({ samples, reason });
        }
        api.onCleanup(() => finish("cancelled"));
    });
}

function targetBeat(cadence)
{
    return Math.round(Math.min(132, Math.max(84, cadence * 1.1)));
}

export const walking =
{
    id: "walking",
    icon: "walk",
    digits: 0,
    safety: true,
    run(api)
    {
        const body = api.body;
        let baseline = null;

        function failFor(reason)
        {
            const key = reason === "no-sensor" || reason === "unsupported" ? "ex.walking.error.sensor" : reason === "denied" ? "ex.walking.error.denied" : "ex.walking.error.steps";
            api.fail(t(key));
        }

        function measureScreen()
        {
            clear(body);
            const timer = createTimer(MEASURE_MS);
            const counter = countPanel();
            const count = h("p", { class: "walk-count", "aria-live": "polite" }, "");
            const status = h("p", { class: "status-line" }, "");
            const start = button(t("ex.walking.startWalk"), () =>
            {
                const permission = askMotion();
                unlockAudio();
                start.hidden = true;
                permission.then(async (state) =>
                {
                    if (state !== "granted")
                    {
                        failFor(state);
                        return;
                    }
                    setBusy(true);
                    stopSpeaking();
                    await counter.run(5);
                    status.textContent = t("ex.walking.keepWalking");
                    const result = await recordWalk(api, MEASURE_MS, 96, timer, (n) =>
                    {
                        count.textContent = t("ex.walking.liveSteps", { n });
                    });
                    if (result.reason === "cancelled")
                    {
                        return;
                    }
                    doneTone();
                    setBusy(false);
                    if (result.reason)
                    {
                        failFor(result.reason);
                        return;
                    }
                    const analysis = analyzeSteps(result.samples);
                    if (!analysis.ok)
                    {
                        failFor(analysis.reason);
                        return;
                    }
                    baseline = analysis;
                    practiceScreen();
                });
            });
            body.appendChild(phaseLabel(1, 2, "ex.walking.part1"));
            body.appendChild(h("p", { class: "big-instruction" }, t("ex.walking.measure")));
            body.appendChild(h("div", { class: "walk-stage" }, h("div", { class: "walk-figure" }, icon("walk")), count, counter.element));
            body.appendChild(timer.element);
            body.appendChild(status);
            body.appendChild(stickyActions(start));
            speak(t("ex.walking.measure"));
        }

        function practiceScreen()
        {
            clear(body);
            const bpm = targetBeat(baseline.cadence);
            const timer = createTimer(PRACTICE_MS);
            const counter = countPanel();
            const dot = h("div", { class: "beat-dot" });
            const count = h("p", { class: "walk-count", "aria-live": "polite" }, "");
            const status = h("p", { class: "status-line" }, "");
            const start = button(t("ex.walking.startBeat"), async () =>
            {
                start.hidden = true;
                unlockAudio();
                setBusy(true);
                stopSpeaking();
                await counter.run(5);
                status.textContent = t("ex.walking.onBeat");
                const metronome = startMetronome(bpm, () =>
                {
                    dot.classList.remove("is-beat");
                    void dot.offsetWidth;
                    dot.classList.add("is-beat");
                });
                api.onCleanup(() => metronome.stop());
                const result = await recordWalk(api, PRACTICE_MS, bpm * 0.98, timer, (n) =>
                {
                    count.textContent = t("ex.walking.liveSteps", { n });
                });
                metronome.stop();
                if (result.reason === "cancelled")
                {
                    return;
                }
                doneTone();
                setBusy(false);
                const analysis = result.reason ? { ok: false, reason: result.reason } : analyzeSteps(result.samples);
                if (!analysis.ok)
                {
                    failFor(analysis.reason);
                    return;
                }
                const change = (analysis.cadence - baseline.cadence) / baseline.cadence * 100;
                api.finish(
                {
                    score: analysis.cadence,
                    highlights:
                    [
                        [t("ex.walking.normal"), fmt(baseline.cadence, 0), t("ex.walking.unit"), false],
                        [t("ex.walking.withBeat"), fmt(analysis.cadence, 0), t("ex.walking.unit"), false],
                        [t("ex.walking.beat"), fmt(bpm, 0), t("ex.walking.unit"), false],
                        [t("ex.walking.evenness"), fmt(analysis.variationPct, 0), "%", false]
                    ],
                    note: t("ex.walking.note", { change: (change >= 0 ? "+" : "−") + fmt(Math.abs(change), 0) }),
                    details: { baseline: baseline.cadence, practice: analysis.cadence, beat: bpm, variation: analysis.variationPct }
                });
            });
            body.appendChild(h("div", { class: "readouts" },
                readout(t("ex.walking.normal"), fmt(baseline.cadence, 0), t("ex.walking.unit"), false),
                readout(t("ex.walking.evenness"), fmt(baseline.variationPct, 0), "%", false)));
            body.appendChild(phaseLabel(2, 2, "ex.walking.part2"));
            body.appendChild(h("p", { class: "big-instruction" }, t("ex.walking.practice", { bpm: fmt(bpm, 0) })));
            body.appendChild(h("div", { class: "walk-stage" }, dot, count, counter.element));
            body.appendChild(timer.element);
            body.appendChild(status);
            body.appendChild(stickyActions(start));
            speak(t("ex.walking.practice", { bpm: fmt(bpm, 0) }));
        }

        measureScreen();
    }
};
