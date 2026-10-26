import { h, clear, sleep, sizeCanvas } from "../../ui.js";
import { t } from "../../i18n.js";
import { speak, stopSpeaking } from "../../speech.js";
import { go, done as doneTone } from "../../sound.js";
import { openMicrophone, record } from "../../capture/audio.js";
import { analyzeVowel, analyzeDdk, analyzeReading, noiseLevel } from "../../analysis/voice.js";
import { toDecibels } from "../../dsp.js";
import { voiceBlock } from "../result-blocks.js";
import { setBusy } from "../../busy.js";
import { createTimer } from "../capture-ui.js";
import { progressBar, errorBox, stickyActions, button } from "./common.js";

const PARTS = ["vowel", "ddk", "reading"];
const DURATIONS = { vowel: 6000, ddk: 6000, reading: 45000 };

function createLevelMeter()
{
    const canvas = h("canvas", { "aria-hidden": "true" });
    const element = h("div", { class: "meter graph-paper" }, canvas);
    let levels = [];
    const api =
    {
        element,
        reset()
        {
            levels = [];
            api.draw();
        },
        push(level)
        {
            levels.push(level);
            if (levels.length > 90)
            {
                levels.shift();
            }
            api.draw();
        },
        draw()
        {
            const size = sizeCanvas(canvas);
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, size.width, size.height);
            const barWidth = size.width / 90;
            ctx.fillStyle = "#2c3fc4";
            levels.forEach((level, i) =>
            {
                const db = Math.max(-60, toDecibels(level));
                const height = Math.max(2 * size.ratio, (db + 60) / 60 * size.height);
                const x = i * barWidth;
                ctx.fillRect(x + barWidth * 0.2, (size.height - height) / 2, barWidth * 0.6, height);
            });
        }
    };
    return api;
}

export function voiceStep(options)
{
    const root = h("div", { class: "step" });
    const body = h("div", { class: "stack" });
    const meter = createLevelMeter();
    const results = { noise: null, vowel: null, ddk: null, reading: null };
    let partIndex = 0;
    let micReady = false;
    let activeRecording = null;
    let disposed = false;

    root.appendChild(progressBar(options.progress));
    root.appendChild(h("h1", null, t("voice.title")));
    root.appendChild(body);

    function partInstruction(part)
    {
        if (part === "vowel")
        {
            return t("voice.quiet") + " " + t("voice.vowel");
        }
        return t(part === "ddk" ? "voice.ddk" : "voice.reading");
    }

    function renderPart()
    {
        const part = PARTS[partIndex];
        const instruction = partInstruction(part);
        clear(body);
        meter.reset();
        body.appendChild(h("p", { class: "quiet small" }, t("voice.part", { n: partIndex + 1 })));
        if (partIndex === 0)
        {
            body.appendChild(h("p", null, t("voice.intro")));
        }
        body.appendChild(h("p", { class: "big-instruction" }, part === "vowel" ? t("voice.vowel") : instruction));
        meter.element.classList.toggle("is-compact", part === "reading");
        body.appendChild(meter.element);
        if (part === "reading")
        {
            body.appendChild(h("p", { class: "reading-passage", lang: document.documentElement.lang }, t("voice.passage")));
        }
        const status = h("p", { class: "status-line", role: "status", "aria-live": "polite" }, "");
        body.appendChild(status);
        const timer = createTimer(part === "reading" ? DURATIONS.reading : DURATIONS[part]);
        if (part !== "reading")
        {
            body.appendChild(timer.element);
        }
        const startButton = button(t("voice.start"), () => runPart(part, status, timer, startButton, doneButton, skipButton));
        const doneButton = button(t("common.done"), () =>
        {
            if (activeRecording)
            {
                activeRecording.stop();
            }
        }, null, { hidden: true });
        const skipButton = button(t("common.skip"), () => options.onSkip(), "quiet");
        body.appendChild(stickyActions(startButton, doneButton, skipButton));
        speak(instruction);
    }

    async function runPart(part, status, timer, startButton, doneButton, skipButton)
    {
        stopSpeaking();
        startButton.hidden = true;
        skipButton.hidden = true;
        setBusy(true);
        if (!micReady)
        {
            try
            {
                await openMicrophone();
                micReady = true;
            }
            catch (error)
            {
                setBusy(false);
                clear(body);
                const denied = error && error.kind === "denied";
                body.appendChild(errorBox(t(denied ? "voice.denied.title" : "cam.unsupported"), denied ? t("voice.denied.body") : null));
                body.appendChild(stickyActions(button(t("common.retry"), () => renderPart()), button(t("common.skip"), () => options.onSkip(), "quiet")));
                return;
            }
        }
        if (part === "vowel")
        {
            status.textContent = t("voice.quiet");
            activeRecording = record({ durationMs: 1600, kind: "noise", onLevel: (level) => meter.push(level) });
            const noiseRecording = await activeRecording.done;
            results.noise = noiseLevel(noiseRecording.samples, noiseRecording.sampleRate);
        }
        if (disposed)
        {
            return;
        }
        go();
        await sleep(280);
        status.textContent = t("voice.speakNow");
        const started = performance.now();
        const tickTimer = window.setInterval(() =>
        {
            timer.set(performance.now() - started);
        }, 100);
        if (part === "reading")
        {
            doneButton.hidden = false;
        }
        activeRecording = record({ durationMs: DURATIONS[part], kind: part, onLevel: (level) => meter.push(level) });
        const recording = await activeRecording.done;
        activeRecording = null;
        window.clearInterval(tickTimer);
        setBusy(false);
        doneTone();
        if (disposed)
        {
            return;
        }
        status.textContent = "";
        const noise = results.noise === null ? 0.001 : results.noise;
        let analysis;
        if (part === "vowel")
        {
            analysis = analyzeVowel(recording.samples, recording.sampleRate, noise);
        }
        else if (part === "ddk")
        {
            analysis = analyzeDdk(recording.samples, recording.sampleRate, noise);
        }
        else
        {
            analysis = analyzeReading(recording.samples, recording.sampleRate, noise);
        }
        if (!analysis.ok)
        {
            clear(body);
            body.appendChild(errorBox(t("voice.error." + (analysis.reason || "no-voice"))));
            body.appendChild(stickyActions(button(t("common.retry"), () => renderPart()), button(t("common.skip"), () => options.onSkip(), "quiet")));
            return;
        }
        results[part] = analysis;
        if (partIndex < PARTS.length - 1)
        {
            partIndex++;
            renderPart();
            return;
        }
        showSummary();
    }

    function showSummary()
    {
        clear(body);
        const summary = { vowel: results.vowel, ddk: results.ddk, reading: results.reading, noiseDb: toDecibels(results.noise || 0) };
        body.appendChild(voiceBlock(summary, { heading: false }));
        body.appendChild(stickyActions(button(options.nextLabel || t("step.next"), () => options.onDone(summary)), button(t("step.again"), () =>
        {
            partIndex = 0;
            renderPart();
        }, "quiet")));
    }

    options.onCleanup(() =>
    {
        disposed = true;
        if (activeRecording)
        {
            activeRecording.stop();
        }
        setBusy(false);
        stopSpeaking();
    });

    renderPart();
    return root;
}
