import { h, clear, formatNumber } from "../ui.js";
import { t, currentLang } from "../i18n.js";
import { openCamera, getFaceTracker, startFrameLoop, detectFace, setActivity, getSource, closeCamera } from "../capture/camera.js";
import { faceFromResult } from "../capture/features.js";
import { createViewfinder, drawSource, drawFace, runCountdown, createTimer } from "../views/capture-ui.js";
import { go, done as doneTone } from "../sound.js";
import { speak, stopSpeaking } from "../speech.js";
import { setBusy } from "../busy.js";
import { stickyActions, button } from "../views/steps/common.js";
import { meter } from "./shared.js";
import { cameraFailure } from "./big.js";

const MOVES = ["smile", "brow", "mouth", "smile", "brow", "mouth"];
const HOLD_MS = 3000;
const REST_MS = 2000;
const TOTAL_MS = MOVES.length * (HOLD_MS + REST_MS);

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function strength(face, move)
{
    if (move === "smile")
    {
        return (face.smileL + face.smileR) / 2;
    }
    if (move === "brow")
    {
        return face.brow;
    }
    return face.mouth;
}

export const face =
{
    id: "face",
    icon: "face",
    digits: 0,
    safety: false,
    run(api)
    {
        const body = api.body;
        const viewfinder = createViewfinder();
        const timer = createTimer(TOTAL_MS);
        const bar = meter({ noTarget: true });
        const extras = h("div", { hidden: true }, bar.element, timer.element);
        const instruction = h("p", { class: "lede" }, t("ex.face.measure"));
        const start = button(t("ex.face.start"), () => startSession(), null, { disabled: true });
        const actions = stickyActions(start);
        const cues = MOVES.map((type, i) => ({ type, at: i * (HOLD_MS + REST_MS) }));
        const peaks = { smile: [], brow: [], mouth: [] };
        let phase = "setup";
        let stopLoop = null;
        let recordStart = 0;
        let lastCue = -1;
        let current = 0;

        clear(body);
        body.appendChild(instruction);
        body.appendChild(viewfinder.element);
        body.appendChild(extras);
        body.appendChild(actions);
        speak(t("ex.face.measure"));

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
            const found = faceFromResult(detectFace(now));
            const view = drawSource(viewfinder.canvas, source);
            if (found)
            {
                drawFace(view, found.landmarks);
            }
            view.done();
            if (phase === "setup")
            {
                viewfinder.setStatus(found ? t("face.status.ready") : t("face.status.find"), Boolean(found));
                start.disabled = !found;
                return;
            }
            if (phase !== "recording")
            {
                return;
            }
            const elapsed = now - recordStart;
            timer.set(elapsed);
            const index = Math.min(MOVES.length - 1, Math.floor(elapsed / (HOLD_MS + REST_MS)));
            const inHold = elapsed - index * (HOLD_MS + REST_MS) < HOLD_MS;
            const move = MOVES[index];
            if (index !== lastCue)
            {
                lastCue = index;
                current = 0;
                go();
                viewfinder.setCue(t("ex.face.cue." + move));
            }
            if (!inHold)
            {
                viewfinder.setCue(t("face.cue.relax"));
            }
            if (found && inHold)
            {
                const value = strength(found, move);
                current = Math.max(current, value);
                bar.set(value, value >= 0.5, t("ex.face.strength", { n: fmt(value * 100, 0) }));
                peaks[move][Math.floor(index / 3)] = current;
            }
            if (elapsed >= TOTAL_MS)
            {
                finish();
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
                cameraFailure(api, error);
                return;
            }
            viewfinder.setLoading("");
            setActivity("face-exercise", { recording: false, cues: [] });
            stopLoop = startFrameLoop(onFrame);
        }

        async function startSession()
        {
            if (phase !== "setup")
            {
                return;
            }
            phase = "countdown";
            actions.hidden = true;
            setBusy(true);
            stopSpeaking();
            instruction.textContent = t("ex.face.practice");
            await runCountdown(viewfinder, 3);
            extras.hidden = false;
            timer.reset();
            recordStart = performance.now();
            setActivity("face-exercise", { recording: true, cues, neutralMs: 0 });
            viewfinder.setStatus("");
            phase = "recording";
        }

        function finish()
        {
            phase = "done";
            doneTone();
            viewfinder.setCue("");
            const best = (move) => Math.max(0, ...peaks[move].filter((v) => isFinite(v))) * 100;
            const smile = best("smile");
            const brow = best("brow");
            const mouth = best("mouth");
            const score = (smile + brow + mouth) / 3;
            if (score <= 0)
            {
                api.fail(t("face.error.tracking"));
                return;
            }
            api.finish(
            {
                score,
                highlights:
                [
                    [t("ex.face.scoreLabel"), fmt(score, 0), "%", false],
                    [t("ex.face.smile"), fmt(smile, 0), "%", false],
                    [t("ex.face.brow"), fmt(brow, 0), "%", false],
                    [t("ex.face.mouth"), fmt(mouth, 0), "%", false]
                ],
                note: t("ex.face.note"),
                details: { smile, brow, mouth }
            });
        }

        begin();
    }
};
