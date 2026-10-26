import { h, clear } from "../../ui.js";
import { t, sideWord } from "../../i18n.js";
import { speak, stopSpeaking } from "../../speech.js";
import { done as doneTone } from "../../sound.js";
import { openCamera, getHandTracker, startFrameLoop, detectHands, setActivity, getSource } from "../../capture/camera.js";
import { handsFromResult } from "../../capture/features.js";
import { createViewfinder, drawSource, drawHand, runCountdown, createTimer, createLiveTrace } from "../capture-ui.js";
import { analyzeTapping } from "../../analysis/tapping.js";
import { tappingReadouts, tappingCharts } from "../result-blocks.js";
import { setBusy } from "../../busy.js";
import { progressBar, errorBox, stickyActions, button } from "./common.js";

const DURATION = 10000;

function largestHand(hands)
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

export function cameraErrorMessage(error)
{
    const kind = error && error.kind ? error.kind : "unsupported";
    if (kind === "denied")
    {
        return errorBox(t("cam.denied.title"), t("cam.denied.body"));
    }
    if (kind === "model")
    {
        return errorBox(t("cam.modelError"));
    }
    return errorBox(t("cam.unsupported"));
}

export function tappingStep(options)
{
    const side = options.side;
    const activityName = "tap-" + side;
    const root = h("div", { class: "step step-capture" });
    const body = h("div", { class: "stack" });
    const viewfinder = createViewfinder();
    const timer = createTimer(DURATION);
    const trace = createLiveTrace({ windowMs: DURATION, max: 10 });
    const recordingExtras = h("div", { hidden: true }, timer.element, trace.element);
    let stopLoop = null;
    let phase = "setup";
    let frames = [];
    let recordStart = 0;
    let disposed = false;
    let actionsBar = null;

    const startButton = button(t("tap.start"), () => start(), null, { disabled: true });
    const skipButton = button(t("common.skip"), () => options.onSkip(), "quiet");
    const instruction = t("tap.instruction", { side: sideWord(side) });

    root.appendChild(progressBar(options.progress));
    root.appendChild(h("h1", null, t("tap.title", { side: sideWord(side) })));
    root.appendChild(body);

    function renderSetup()
    {
        clear(body);
        body.appendChild(h("p", { class: "lede" }, instruction));
        body.appendChild(viewfinder.element);
        body.appendChild(recordingExtras);
        actionsBar = stickyActions(startButton, skipButton);
        body.appendChild(actionsBar);
        recordingExtras.hidden = true;
        startButton.disabled = true;
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
        const hand = largestHand(hands);
        const view = drawSource(viewfinder.canvas, source);
        if (hand)
        {
            drawHand(view, hand.image, true);
        }
        view.done();
        if (phase === "setup")
        {
            if (!hand)
            {
                viewfinder.setStatus(t("tap.status.find", { side: sideWord(side) }), false);
            }
            else if (hand.relativeSize < 0.07)
            {
                viewfinder.setStatus(t("tap.status.closer"), false);
            }
            else if (hand.relativeSize > 0.34)
            {
                viewfinder.setStatus(t("tap.status.farther"), false);
            }
            else
            {
                viewfinder.setStatus(t("tap.status.ready"), true);
                startButton.disabled = false;
            }
        }
        else if (phase === "recording")
        {
            const elapsed = now - recordStart;
            const gap = hand && isFinite(hand.gapCm) ? hand.gapCm : null;
            frames.push({ t: elapsed, d: gap });
            trace.push(elapsed, gap);
            trace.draw();
            timer.set(elapsed);
            viewfinder.setStatus(hand ? t("tap.status.go") : t("tap.status.lost"), Boolean(hand));
            if (elapsed >= DURATION)
            {
                finish();
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
        setActivity(activityName, { recording: false });
        if (stopLoop)
        {
            stopLoop();
        }
        stopLoop = startFrameLoop(onFrame);
    }

    async function start()
    {
        if (phase !== "setup")
        {
            return;
        }
        phase = "countdown";
        setBusy(true);
        stopSpeaking();
        actionsBar.hidden = true;
        await runCountdown(viewfinder, 3);
        if (disposed)
        {
            return;
        }
        frames = [];
        trace.clear();
        timer.reset();
        recordingExtras.hidden = false;
        recordStart = performance.now();
        setActivity(activityName, { recording: true });
        phase = "recording";
    }

    function finish()
    {
        phase = "done";
        doneTone();
        setBusy(false);
        setActivity(activityName, { recording: false });
        if (stopLoop)
        {
            stopLoop();
            stopLoop = null;
        }
        const result = analyzeTapping(frames);
        clear(body);
        if (!result.ok)
        {
            body.appendChild(errorBox(t("tap.error." + result.reason)));
            body.appendChild(stickyActions(button(t("common.retry"), () => retry()), button(t("common.skip"), () => options.onSkip(), "quiet")));
            speak(t("tap.error." + result.reason));
            return;
        }
        body.appendChild(tappingReadouts(result));
        body.appendChild(tappingCharts(result));
        body.appendChild(stickyActions(button(options.nextLabel || t("step.next"), () => options.onDone(result)), button(t("step.again"), () => retry(), "quiet")));
    }

    function retry()
    {
        phase = "setup";
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
