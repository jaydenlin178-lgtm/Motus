import { h, clear, formatNumber, sleep } from "../ui.js";
import { t, currentLang } from "../i18n.js";
import { openMicrophone, closeMicrophone, record } from "../capture/audio.js";
import { toDecibels } from "../dsp.js";
import { go, done as doneTone } from "../sound.js";
import { speak, stopSpeaking } from "../speech.js";
import { setBusy } from "../busy.js";
import { createTimer } from "../views/capture-ui.js";
import { stickyActions, button } from "../views/steps/common.js";
import { phaseLabel, meter, percentileOf } from "./shared.js";

const BASELINE_MS = 6000;
const TARGET_DB = 6;
const REPS =
[
    { key: "ex.voice.rep.ahh", ms: 5000 },
    { key: "ex.voice.rep.phrase1", ms: 4000 },
    { key: "ex.voice.rep.ahh", ms: 5000 },
    { key: "ex.voice.rep.phrase2", ms: 4000 }
];

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function capture(api, durationMs, kind, onLevel, timer)
{
    const recording = record({ durationMs, kind, onLevel });
    api.onCleanup(() => recording.stop());
    const started = performance.now();
    const ticker = window.setInterval(() =>
    {
        timer.set(performance.now() - started);
    }, 100);
    return recording.done.then(() =>
    {
        window.clearInterval(ticker);
    });
}

export const voice =
{
    id: "voice",
    icon: "loud",
    digits: 0,
    safety: false,
    run(api)
    {
        const body = api.body;
        let baselineDb = NaN;
        let alive = true;
        api.onCleanup(() =>
        {
            alive = false;
            closeMicrophone();
        });

        function baselineScreen()
        {
            clear(body);
            const timer = createTimer(BASELINE_MS);
            const levelBar = meter({ noTarget: true });
            const levels = [];
            const start = button(t("ex.voice.startNormal"), async () =>
            {
                start.hidden = true;
                stopSpeaking();
                setBusy(true);
                try
                {
                    await openMicrophone();
                }
                catch (error)
                {
                    api.fail(t(error && error.kind === "denied" ? "voice.denied.title" : "cam.unsupported"), error && error.kind === "denied" ? t("voice.denied.body") : null);
                    return;
                }
                if (!alive)
                {
                    return;
                }
                go();
                await sleep(250);
                await capture(api, BASELINE_MS, "reading", (level) =>
                {
                    const db = toDecibels(level);
                    levels.push(db);
                    levelBar.set((db + 60) / 60, false, "");
                }, timer);
                if (!alive)
                {
                    return;
                }
                doneTone();
                setBusy(false);
                const floor = percentileOf(levels, 0.1);
                const speech = levels.filter((db) => db > floor + 8);
                if (speech.length < levels.length * 0.15)
                {
                    api.fail(t("voice.error.no-voice"));
                    return;
                }
                baselineDb = percentileOf(speech, 0.6);
                practiceScreen();
            });
            body.appendChild(phaseLabel(1, 2, "ex.voice.part1"));
            body.appendChild(h("p", { class: "big-instruction" }, t("ex.voice.measure")));
            body.appendChild(h("p", { class: "reading-passage" }, t("ex.voice.sentence")));
            body.appendChild(levelBar.element);
            body.appendChild(timer.element);
            body.appendChild(stickyActions(start));
            speak(t("ex.voice.measure"));
        }

        function practiceScreen()
        {
            clear(body);
            const target = baselineDb + TARGET_DB;
            const low = baselineDb - 18;
            const high = target + 10;
            const scale = (db) => (db - low) / (high - low);
            const levelBar = meter();
            levelBar.setTarget(scale(target));
            const prompt = h("p", { class: "big-instruction" }, "");
            const repLabel = h("p", { class: "quiet small" }, "");
            const timer = createTimer(REPS[0].ms);
            let voiced = 0;
            let onTarget = 0;
            let loudest = -Infinity;
            let smooth = low;
            const start = button(t("ex.voice.startLoud"), async () =>
            {
                start.hidden = true;
                stopSpeaking();
                setBusy(true);
                for (let i = 0; i < REPS.length; i++)
                {
                    const rep = REPS[i];
                    repLabel.textContent = t("ex.voice.repCount", { n: i + 1, total: REPS.length });
                    prompt.textContent = t(rep.key);
                    const repTimer = createTimer(rep.ms);
                    timer.element.replaceWith(repTimer.element);
                    timer.element = repTimer.element;
                    if (!alive)
                    {
                        return;
                    }
                    go();
                    await sleep(300);
                    await capture(api, rep.ms, "loud", (level) =>
                    {
                        const db = toDecibels(level);
                        smooth = smooth * 0.6 + db * 0.4;
                        if (db > baselineDb - 10)
                        {
                            voiced++;
                            if (db >= target)
                            {
                                onTarget++;
                            }
                            loudest = Math.max(loudest, db);
                        }
                        const hit = smooth >= target;
                        levelBar.set(scale(smooth), hit, hit ? t("ex.voice.onTarget") : t("ex.voice.louder"));
                    }, repTimer);
                    if (!alive)
                    {
                        return;
                    }
                    if (i < REPS.length - 1)
                    {
                        prompt.textContent = t("ex.voice.rest");
                        levelBar.set(0, false, "");
                        await sleep(1500);
                    }
                }
                doneTone();
                setBusy(false);
                if (voiced < 10)
                {
                    api.fail(t("voice.error.no-voice"));
                    return;
                }
                const score = onTarget / voiced * 100;
                api.finish(
                {
                    score,
                    highlights:
                    [
                        [t("ex.voice.scoreLabel"), fmt(score, 0), "%", false],
                        [t("ex.voice.loudest"), "+" + fmt(Math.max(0, loudest - baselineDb), 0), "dB", false]
                    ],
                    note: t("ex.voice.note"),
                    details: { baselineDb, targetDb: target, loudestDb: loudest }
                });
            });
            body.appendChild(phaseLabel(2, 2, "ex.voice.part2"));
            body.appendChild(repLabel);
            body.appendChild(prompt);
            prompt.textContent = t("ex.voice.practice");
            body.appendChild(levelBar.element);
            body.appendChild(timer.element);
            body.appendChild(stickyActions(start));
            speak(t("ex.voice.practice"));
        }

        baselineScreen();
    }
};
