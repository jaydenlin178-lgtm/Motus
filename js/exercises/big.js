import { h, clear, formatNumber } from "../ui.js";
import { t, currentLang } from "../i18n.js";
import { openCamera, getHandTracker, startFrameLoop, detectHands, setActivity, getSource, closeCamera } from "../capture/camera.js";
import { handsFromResult } from "../capture/features.js";
import { createViewfinder, drawSource, drawHand, runCountdown, createTimer } from "../views/capture-ui.js";
import { done as doneTone, go } from "../sound.js";
import { speak, stopSpeaking } from "../speech.js";
import { setBusy } from "../busy.js";
import { stickyActions, button } from "../views/steps/common.js";
import { phaseLabel, percentileOf } from "./shared.js";

const MEASURE_MS = 10000;
const TARGET_TIMEOUT_MS = 8000;
const HOLD_FRAMES = 5;
const RADIUS = 0.09;
const ANGLES = [180, 0, 135, -45, 45, -135, 90, -90];
const STRETCH = 1.25;

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

export function cameraFailure(api, error)
{
    const kind = error && error.kind ? error.kind : "unsupported";
    if (kind === "denied")
    {
        api.fail(t("cam.denied.title"), t("cam.denied.body"));
    }
    else if (kind === "model")
    {
        api.fail(t("cam.modelError"));
    }
    else
    {
        api.fail(t("cam.unsupported"));
    }
}

function visibleBounds(canvas, source)
{
    const rect = canvas.getBoundingClientRect();
    const k = Math.max(rect.width / source.width, rect.height / source.height);
    const dw = source.width * k;
    const dh = source.height * k;
    const ox = (rect.width - dw) / 2;
    const oy = (rect.height - dh) / 2;
    const bounds = { x0: -ox / dw, x1: (rect.width - ox) / dw, y0: -oy / dh, y1: (rect.height - oy) / dh };
    return bounds;
}

function buildTargets(box, bounds)
{
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    const rx = Math.max(0.18, (box.x1 - box.x0) / 2 * STRETCH);
    const ry = Math.max(0.15, (box.y1 - box.y0) / 2 * STRETCH);
    const margin = 0.08;
    return ANGLES.map((degrees) =>
    {
        const angle = degrees * Math.PI / 180;
        const target =
        {
            x: Math.min(bounds.x1 - margin, Math.max(bounds.x0 + margin, cx + rx * Math.cos(angle))),
            y: Math.min(bounds.y1 - margin, Math.max(bounds.y0 + margin, cy - ry * Math.sin(angle)))
        };
        return target;
    });
}

export const big =
{
    id: "big",
    icon: "reach",
    digits: 0,
    safety: true,
    run(api)
    {
        const body = api.body;
        const viewfinder = createViewfinder();
        const timer = createTimer(MEASURE_MS);
        const timerHolder = h("div", { hidden: true }, timer.element);
        const instruction = h("p", { class: "lede" }, t("ex.big.setup"));
        const label = h("div");
        const start = button(t("ex.big.startMeasure"), () => startMeasure(), null, { disabled: true });
        const actions = stickyActions(start);
        let phase = "setup";
        let stopLoop = null;
        let palms = [];
        let recordStart = 0;
        let targets = [];
        let targetIndex = 0;
        let targetStart = 0;
        let holdCount = 0;
        let hits = 0;
        const hitTimes = [];
        const activityTarget = { x: 0.5, y: 0.5 };

        clear(body);
        label.appendChild(phaseLabel(1, 2, "ex.big.part1"));
        body.appendChild(label);
        body.appendChild(instruction);
        body.appendChild(viewfinder.element);
        body.appendChild(timerHolder);
        body.appendChild(actions);
        speak(t("ex.big.setup"));

        api.onCleanup(() =>
        {
            if (stopLoop)
            {
                stopLoop();
            }
            closeCamera();
        });

        function drawTarget(view, target, progress)
        {
            const ctx = view.ctx;
            const center = view.map(target);
            const edge = view.map({ x: target.x, y: target.y + RADIUS });
            const radius = Math.abs(edge.y - center.y);
            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 225, 90, 0.28)";
            ctx.fill();
            ctx.lineWidth = 4 * view.ratio;
            ctx.strokeStyle = "#ffe15a";
            ctx.stroke();
            if (progress > 0)
            {
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.arc(center.x, center.y, radius * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                ctx.closePath();
                ctx.fillStyle = "rgba(255, 225, 90, 0.85)";
                ctx.fill();
            }
        }

        function onFrame(now)
        {
            const source = getSource();
            if (!source)
            {
                return;
            }
            const hands = handsFromResult(detectHands(now), source.width, source.height);
            const view = drawSource(viewfinder.canvas, source);
            for (const hand of hands.slice(0, 2))
            {
                drawHand(view, hand.image, false);
            }
            if (phase === "practice" && targets[targetIndex])
            {
                drawTarget(view, targets[targetIndex], holdCount / HOLD_FRAMES);
            }
            view.done();
            if (phase === "setup")
            {
                viewfinder.setStatus(hands.length ? t("ex.big.found") : t("tremor.status.find"), hands.length > 0);
                start.disabled = hands.length === 0;
            }
            else if (phase === "measure")
            {
                const elapsed = now - recordStart;
                for (const hand of hands)
                {
                    palms.push({ x: hand.palmX / source.width, y: hand.palmY / source.height });
                }
                timer.set(elapsed);
                if (elapsed >= MEASURE_MS)
                {
                    finishMeasure(source);
                }
            }
            else if (phase === "practice")
            {
                const target = targets[targetIndex];
                const inside = hands.some((hand) => Math.hypot((hand.palmX / source.width - target.x) * source.width, (hand.palmY / source.height - target.y) * source.height) < RADIUS * source.height);
                holdCount = inside ? holdCount + 1 : 0;
                if (holdCount >= HOLD_FRAMES)
                {
                    hits++;
                    hitTimes.push(now - targetStart);
                    go();
                    nextTarget(now);
                }
                else if (now - targetStart > TARGET_TIMEOUT_MS)
                {
                    nextTarget(now);
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
            setActivity("big-setup", {});
            stopLoop = startFrameLoop(onFrame);
        }

        async function startMeasure()
        {
            if (phase !== "setup")
            {
                return;
            }
            phase = "countdown";
            actions.hidden = true;
            setBusy(true);
            stopSpeaking();
            instruction.textContent = t("ex.big.measure");
            speak(t("ex.big.measure"));
            await runCountdown(viewfinder, 3);
            palms = [];
            timerHolder.hidden = false;
            timer.reset();
            recordStart = performance.now();
            setActivity("big-measure", {});
            viewfinder.setStatus(t("ex.big.wide"), true);
            phase = "measure";
        }

        function finishMeasure(source)
        {
            phase = "between";
            doneTone();
            timerHolder.hidden = true;
            if (palms.length < 40)
            {
                api.fail(t("ex.big.error"));
                return;
            }
            const box =
            {
                x0: percentileOf(palms.map((p) => p.x), 0.05),
                x1: percentileOf(palms.map((p) => p.x), 0.95),
                y0: percentileOf(palms.map((p) => p.y), 0.05),
                y1: percentileOf(palms.map((p) => p.y), 0.95)
            };
            targets = buildTargets(box, visibleBounds(viewfinder.canvas, source));
            clear(label);
            label.appendChild(phaseLabel(2, 2, "ex.big.part2"));
            instruction.textContent = t("ex.big.practice");
            speak(t("ex.big.practice"));
            window.setTimeout(() =>
            {
                targetIndex = 0;
                hits = 0;
                holdCount = 0;
                setTarget(performance.now());
                phase = "practice";
            }, 1800);
        }

        function setTarget(now)
        {
            targetStart = now;
            holdCount = 0;
            const target = targets[targetIndex];
            activityTarget.x = target.x;
            activityTarget.y = target.y;
            setActivity("big-practice", { target: activityTarget });
            viewfinder.setStatus(t("ex.big.count", { n: targetIndex + 1, total: targets.length }), true);
        }

        function nextTarget(now)
        {
            targetIndex++;
            if (targetIndex >= targets.length)
            {
                finishPractice();
                return;
            }
            setTarget(now);
        }

        function finishPractice()
        {
            phase = "done";
            doneTone();
            const score = hits / targets.length * 100;
            const average = hitTimes.length ? hitTimes.reduce((a, b) => a + b, 0) / hitTimes.length / 1000 : NaN;
            api.finish(
            {
                score,
                highlights:
                [
                    [t("ex.big.scoreLabel"), fmt(score, 0), "%", false],
                    [t("ex.big.time"), fmt(average, 1), "s", false],
                    [t("ex.big.reached"), t("ex.big.ofTotal", { n: hits, total: targets.length }), null, false]
                ],
                note: t("ex.big.note"),
                details: { hits, total: targets.length, averageSeconds: average }
            });
        }

        begin();
    }
};
