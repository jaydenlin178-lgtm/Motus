import { h, clear } from "../../ui.js";
import { t } from "../../i18n.js";
import { speak, stopSpeaking } from "../../speech.js";
import { done as doneTone, go } from "../../sound.js";
import { openCamera, getFaceTracker, startFrameLoop, detectFace, setActivity, getSource } from "../../capture/camera.js";
import { faceFromResult } from "../../capture/features.js";
import { createViewfinder, drawSource, drawFace, runCountdown, createTimer } from "../capture-ui.js";
import { analyzeFace } from "../../analysis/face.js";
import { faceBlock } from "../result-blocks.js";
import { setBusy } from "../../busy.js";
import { progressBar, errorBox, stickyActions, button } from "./common.js";
import { cameraErrorMessage } from "./tapping.js";

const NEUTRAL_MS = 30000;
const SCRIPT =
[
    { at: 30000, cue: "face.cue.smile", type: "smile" },
    { at: 33000, cue: "face.cue.relax" },
    { at: 34500, cue: "face.cue.brow", type: "brow" },
    { at: 37500, cue: "face.cue.relax" },
    { at: 39000, cue: "face.cue.smile", type: "smile" },
    { at: 42000, cue: "face.cue.relax" }
];
const TOTAL_MS = 43000;

export function faceStep(options)
{
    const root = h("div", { class: "step step-capture" });
    const body = h("div", { class: "stack" });
    const viewfinder = createViewfinder();
    const timer = createTimer(TOTAL_MS);
    const timerHolder = h("div", { hidden: true }, timer.element);
    const instruction = t("face.instruction");
    const cues = SCRIPT.filter((step) => step.type).map((step) => ({ type: step.type, at: step.at }));
    let mode = "setup";
    let frames = [];
    let recordStart = 0;
    let scriptIndex = 0;
    let stopLoop = null;
    let disposed = false;
    let actionsBar = null;
    const startButton = button(t("face.start"), () => start(), null, { disabled: true });
    const skipButton = button(t("common.skip"), () => options.onSkip(), "quiet");

    root.appendChild(progressBar(options.progress));
    root.appendChild(h("h1", null, t("face.title")));
    root.appendChild(body);

    function renderSetup()
    {
        clear(body);
        body.appendChild(h("p", { class: "lede" }, instruction));
        body.appendChild(viewfinder.element);
        body.appendChild(timerHolder);
        timerHolder.hidden = true;
        startButton.disabled = true;
        viewfinder.setCue("");
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
        const face = faceFromResult(detectFace(now));
        const view = drawSource(viewfinder.canvas, source);
        if (face)
        {
            drawFace(view, face.landmarks);
        }
        view.done();
        if (mode === "setup")
        {
            viewfinder.setStatus(face ? t("face.status.ready") : t("face.status.find"), Boolean(face));
            if (face)
            {
                startButton.disabled = false;
            }
        }
        else if (mode === "recording")
        {
            const elapsed = now - recordStart;
            frames.push(face ? { t: elapsed, present: true, blink: face.blink, smileL: face.smileL, smileR: face.smileR, brow: face.brow } : { t: elapsed, present: false });
            timer.set(elapsed);
            while (scriptIndex < SCRIPT.length && elapsed >= SCRIPT[scriptIndex].at)
            {
                const step = SCRIPT[scriptIndex];
                viewfinder.setCue(t(step.cue));
                if (step.type)
                {
                    go();
                }
                scriptIndex++;
            }
            if (elapsed < NEUTRAL_MS)
            {
                viewfinder.setStatus(t("face.status.relax"), Boolean(face));
            }
            else
            {
                viewfinder.setStatus("");
            }
            if (elapsed >= TOTAL_MS)
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
            viewfinder.setLoading(t("cam.loadingFace"));
            await getFaceTracker();
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
        setActivity("face", { recording: false, cues, neutralMs: NEUTRAL_MS });
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
        scriptIndex = 0;
        timer.reset();
        timerHolder.hidden = false;
        recordStart = performance.now();
        setActivity("face", { recording: true, cues, neutralMs: NEUTRAL_MS });
        mode = "recording";
    }

    function finish()
    {
        mode = "done";
        doneTone();
        setBusy(false);
        viewfinder.setCue("");
        setActivity("face", { recording: false, cues, neutralMs: NEUTRAL_MS });
        if (stopLoop)
        {
            stopLoop();
            stopLoop = null;
        }
        const protocol = { neutralStart: 0, neutralEnd: NEUTRAL_MS, cues: cues.map((cue) => ({ type: cue.type, t: cue.at })) };
        const result = analyzeFace(frames, protocol);
        clear(body);
        if (!result.ok)
        {
            body.appendChild(errorBox(t("face.error.tracking")));
            body.appendChild(stickyActions(button(t("common.retry"), () => retry()), button(t("common.skip"), () => options.onSkip(), "quiet")));
            return;
        }
        body.appendChild(faceBlock(result, { heading: false }));
        body.appendChild(stickyActions(button(options.nextLabel || t("step.next"), () => options.onDone(result)), button(t("step.again"), () => retry(), "quiet")));
    }

    function retry()
    {
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
