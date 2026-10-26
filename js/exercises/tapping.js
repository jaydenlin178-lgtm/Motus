import { h, clear, formatNumber } from "../ui.js";
import { t, currentLang, sideWord } from "../i18n.js";
import { getState } from "../store.js";
import { openCamera, getHandTracker, startFrameLoop, detectHands, setActivity, getSource, closeCamera } from "../capture/camera.js";
import { handsFromResult } from "../capture/features.js";
import { createViewfinder, drawSource, drawHand, runCountdown, createTimer } from "../views/capture-ui.js";
import { analyzeTapping } from "../analysis/tapping.js";
import { done as doneTone, tone } from "../sound.js";
import { speak, stopSpeaking } from "../speech.js";
import { setBusy } from "../busy.js";
import { stickyActions, button } from "../views/steps/common.js";
import { phaseLabel, meter } from "./shared.js";
import { cameraFailure } from "./big.js";

const MEASURE_MS = 10000;
const PRACTICE_MS = 20000;

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function largest(hands)
{
    let best = null;
    for (const hand of hands)
    {
        if (!best || hand.relativeSize > best.relativeSize)
        {
            best = hand;
        }
    }
    return best;
}

export const tapping =
{
    id: "tapping",
    icon: "target",
    digits: 0,
    safety: false,
    run(api)
    {
        const body = api.body;
        const side = getState().settings.dominant === "left" ? "left" : "right";
        const viewfinder = createViewfinder();
        const label = h("div");
        const instruction = h("p", { class: "lede" }, t("ex.tapping.measure", { side: sideWord(side) }));
        let timer = createTimer(MEASURE_MS);
        const sizeBar = meter();
        const extras = h("div", { class: "stack-tight", hidden: true }, sizeBar.element, timer.element);
        const start = button(t("tap.start"), () => startPhase(), null, { disabled: true });
        const actions = stickyActions(start);
        let phase = "setup";
        let round = 1;
        let stopLoop = null;
        let frames = [];
        let recordStart = 0;
        let target = NaN;
        let bigTaps = 0;
        let armed = true;
        let baseline = null;

        clear(body);
        label.appendChild(phaseLabel(1, 2, "ex.tapping.part1"));
        body.appendChild(label);
        body.appendChild(instruction);
        body.appendChild(viewfinder.element);
        body.appendChild(extras);
        body.appendChild(actions);
        speak(t("ex.tapping.measure", { side: sideWord(side) }));

        api.onCleanup(() =>
        {
            if (stopLoop)
            {
                stopLoop();
            }
            closeCamera();
        });

        function onFrame(now)
        {
            const source = getSource();
            if (!source)
            {
                return;
            }
            const hand = largest(handsFromResult(detectHands(now), source.width, source.height));
            const view = drawSource(viewfinder.canvas, source);
            if (hand)
            {
                drawHand(view, hand.image, true);
            }
            view.done();
            if (phase === "setup")
            {
                const ready = hand && hand.relativeSize >= 0.07 && hand.relativeSize <= 0.34;
                viewfinder.setStatus(ready ? t("tap.status.ready") : t("tap.status.find", { side: sideWord(side) }), Boolean(ready));
                start.disabled = !ready;
            }
            else if (phase === "recording")
            {
                const elapsed = now - recordStart;
                const gap = hand && isFinite(hand.gapCm) ? hand.gapCm : null;
                frames.push({ t: elapsed, d: gap });
                timer.set(elapsed);
                if (round === 2 && gap !== null)
                {
                    const hit = gap >= target;
                    if (hit && armed)
                    {
                        bigTaps++;
                        armed = false;
                        tone(880, 0.06, 0.1);
                    }
                    else if (gap < target * 0.45)
                    {
                        armed = true;
                    }
                    sizeBar.set(gap / (target * 1.5), hit, t("ex.tapping.bigCount", { n: bigTaps }));
                }
                viewfinder.setStatus(hand ? t("tap.status.go") : t("tap.status.lost"), Boolean(hand));
                if (elapsed >= (round === 1 ? MEASURE_MS : PRACTICE_MS))
                {
                    finishRound();
                }
            }
        }

        async function begin()
        {
            viewfinder.setLoading(t("cam.starting"));
            try
            {
                await openCamera();
                viewfinder.setLoading(t("cam.loadingHand"));
                await getHandTracker();
            }
            catch (error)
            {
                cameraFailure(api, error);
                return;
            }
            viewfinder.setLoading("");
            setActivity("tap-feedback", { recording: false });
            stopLoop = startFrameLoop(onFrame);
        }

        async function startPhase()
        {
            if (phase !== "setup")
            {
                return;
            }
            phase = "countdown";
            actions.hidden = true;
            setBusy(true);
            stopSpeaking();
            await runCountdown(viewfinder, 3);
            frames = [];
            bigTaps = 0;
            armed = true;
            extras.hidden = false;
            sizeBar.element.hidden = round === 1;
            timer.reset();
            recordStart = performance.now();
            setActivity("tap-feedback", { recording: true });
            phase = "recording";
        }

        function finishRound()
        {
            phase = "between";
            doneTone();
            setBusy(false);
            setActivity("tap-feedback", { recording: false });
            const result = analyzeTapping(frames);
            if (!result.ok)
            {
                api.fail(t("tap.error." + result.reason));
                return;
            }
            if (round === 1)
            {
                baseline = result;
                const sizes = result.taps.map((tap) => tap.amplitude).sort((a, b) => b - a);
                const best = sizes.slice(0, Math.min(5, sizes.length));
                target = 0.9 * best.reduce((a, b) => a + b, 0) / best.length;
                round = 2;
                clear(label);
                label.appendChild(phaseLabel(2, 2, "ex.tapping.part2"));
                instruction.textContent = t("ex.tapping.practice", { target: fmt(target, 1) });
                speak(t("ex.tapping.practice", { target: fmt(target, 1) }));
                sizeBar.setTarget(1 / 1.5);
                sizeBar.set(0, false, "");
                const practiceTimer = createTimer(PRACTICE_MS);
                timer.element.replaceWith(practiceTimer.element);
                timer = practiceTimer;
                actions.hidden = false;
                start.disabled = true;
                extras.hidden = true;
                phase = "setup";
                return;
            }
            const reached = result.taps.filter((tap) => tap.amplitude >= target).length;
            const score = result.taps.length ? reached / result.taps.length * 100 : 0;
            api.finish(
            {
                score,
                highlights:
                [
                    [t("ex.tapping.scoreLabel"), fmt(score, 0), "%", false],
                    [t("ex.tapping.target"), fmt(target, 1), "cm", false],
                    [t("ex.tapping.shrinkBefore"), fmt(baseline.decrementPct, 0), "%", false],
                    [t("ex.tapping.shrinkAfter"), fmt(result.decrementPct, 0), "%", false]
                ],
                note: t("ex.tapping.note"),
                details: { target, reached, taps: result.taps.length, decrementBefore: baseline.decrementPct, decrementAfter: result.decrementPct }
            });
        }

        begin();
    }
};
