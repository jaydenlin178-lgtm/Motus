import { h, clear } from "../../ui.js";
import { t } from "../../i18n.js";
import { speak, stopSpeaking } from "../../speech.js";
import { done as doneTone } from "../../sound.js";
import { openCamera, getHandTracker, startFrameLoop, detectHands, setActivity, getSource } from "../../capture/camera.js";
import { handsFromResult, assignSides } from "../../capture/features.js";
import { createViewfinder, drawSource, drawHand, runCountdown, createTimer } from "../capture-ui.js";
import { analyzeTremorPhase } from "../../analysis/tremor.js";
import { tremorBlock } from "../result-blocks.js";
import { setBusy } from "../../busy.js";
import { progressBar, errorBox, stickyActions, button } from "./common.js";
import { cameraErrorMessage } from "./tapping.js";

const DURATION = 15000;

function compact(hand)
{
    if (!hand || !isFinite(hand.mmPerPx))
    {
        return null;
    }
    const sample = { palmX: hand.palmX, palmY: hand.palmY, tipX: hand.tipX, tipY: hand.tipY, mmPerPx: hand.mmPerPx };
    return sample;
}

export function tremorStep(options)
{
    const phases = options.phases || ["rest", "posture"];
    const root = h("div", { class: "step step-capture" });
    const body = h("div", { class: "stack" });
    const viewfinder = createViewfinder();
    const timer = createTimer(DURATION);
    const timerHolder = h("div", { hidden: true }, timer.element);
    const results = {};
    let phaseIndex = 0;
    let mode = "setup";
    let frames = [];
    let recordStart = 0;
    let stopLoop = null;
    let disposed = false;
    let actionsBar = null;
    const title = h("h1", null, options.title || t("tremor.title"));
    const startButton = button("", () => start(), null, { disabled: true });
    const skipButton = button(t("common.skip"), () => options.onSkip(), "quiet");

    root.appendChild(progressBar(options.progress));
    root.appendChild(title);
    root.appendChild(body);

    function currentPhase()
    {
        return phases[phaseIndex];
    }

    function renderSetup()
    {
        const phase = currentPhase();
        const instruction = t(phase === "rest" ? "tremor.rest.instruction" : "tremor.posture.instruction");
        clear(body);
        body.appendChild(h("p", { class: "lede" }, instruction));
        body.appendChild(viewfinder.element);
        body.appendChild(timerHolder);
        startButton.textContent = t(phase === "rest" ? "tremor.start.rest" : "tremor.start.posture");
        startButton.disabled = true;
        timerHolder.hidden = true;
        actionsBar = stickyActions(startButton, skipButton);
        body.appendChild(actionsBar);
        speak(instruction);
    }

    function onFrame(now)
    {
        const source = getSource();
        if (!source || disposed)
        {
            return;
        }
        const hands = handsFromResult(detectHands(now), source.width, source.height);
        const sides = assignSides(hands);
        const view = drawSource(viewfinder.canvas, source);
        for (const hand of hands.slice(0, 2))
        {
            drawHand(view, hand.image, false);
        }
        view.done();
        const both = sides.right && sides.left;
        if (mode === "setup")
        {
            if (both)
            {
                viewfinder.setStatus(t("tremor.status.ready"), true);
                startButton.disabled = false;
            }
            else
            {
                viewfinder.setStatus(hands.length ? t("tremor.status.one") : t("tremor.status.find"), false);
            }
        }
        else if (mode === "recording")
        {
            const elapsed = now - recordStart;
            frames.push({ t: elapsed, right: compact(sides.right), left: compact(sides.left) });
            timer.set(elapsed);
            viewfinder.setStatus(t(currentPhase() === "rest" ? "tremor.status.rest" : "tremor.status.posture"), Boolean(both));
            if (elapsed >= DURATION)
            {
                finishPhase();
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
            viewfinder.setLoading("");
            clear(body);
            body.appendChild(cameraErrorMessage(error));
            body.appendChild(stickyActions(button(t("common.retry"), () => begin()), button(t("common.skip"), () => options.onSkip(), "quiet")));
            return;
        }
        if (disposed)
        {
            return;
        }
        viewfinder.setLoading("");
        setActivity("tremor-" + currentPhase(), { recording: false });
        if (stopLoop)
        {
            stopLoop();
        }
        stopLoop = startFrameLoop(onFrame);
    }

    async function start()
    {
        if (mode !== "setup")
        {
            return;
        }
        mode = "countdown";
        setBusy(true);
        stopSpeaking();
        actionsBar.hidden = true;
        await runCountdown(viewfinder, 3);
        if (disposed)
        {
            return;
        }
        frames = [];
        timer.reset();
        timerHolder.hidden = false;
        recordStart = performance.now();
        setActivity("tremor-" + currentPhase(), { recording: true });
        mode = "recording";
    }

    function finishPhase()
    {
        mode = "analyzing";
        doneTone();
        const phase = currentPhase();
        const analysis = analyzeTremorPhase(frames);
        const failed = !analysis.right.ok && !analysis.left.ok;
        if (failed)
        {
            setBusy(false);
            if (stopLoop)
            {
                stopLoop();
                stopLoop = null;
            }
            clear(body);
            const reason = analysis.right.reason || analysis.left.reason || "tracking";
            body.appendChild(errorBox(t("tremor.error." + reason)));
            body.appendChild(stickyActions(button(t("common.retry"), () => retry()), button(t("common.skip"), () => options.onSkip(), "quiet")));
            return;
        }
        results[phase] = analysis;
        if (phaseIndex < phases.length - 1)
        {
            phaseIndex++;
            mode = "setup";
            setBusy(false);
            setActivity("tremor-" + currentPhase(), { recording: false });
            renderSetup();
            return;
        }
        setBusy(false);
        if (stopLoop)
        {
            stopLoop();
            stopLoop = null;
        }
        showSummary();
    }

    function showSummary()
    {
        clear(body);
        body.appendChild(tremorBlock(results.rest || null, results.posture || null, { heading: false }));
        body.appendChild(stickyActions(button(options.nextLabel || t("step.next"), () => options.onDone(results)), button(t("step.again"), () => retry(), "quiet")));
    }

    function retry()
    {
        phaseIndex = 0;
        mode = "setup";
        renderSetup();
        begin();
    }

    options.onCleanup(() =>
    {
        disposed = true;
        if (stopLoop)
        {
            stopLoop();
        }
        setBusy(false);
        stopSpeaking();
    });

    renderSetup();
    begin();
    return root;
}
