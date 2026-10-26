import { h, clear, sizeCanvas } from "../../ui.js";
import { t, sideWord } from "../../i18n.js";
import { speak, stopSpeaking } from "../../speech.js";
import { done as doneTone } from "../../sound.js";
import { spiralPath } from "../../icons.js";
import { analyzeSpiral } from "../../analysis/spiral.js";
import { spiralBlock } from "../result-blocks.js";
import { isSimulated } from "../../env.js";
import { progressBar, errorBox, stickyActions, button } from "./common.js";

const TURNS = 3;

function turnsCovered(points, template)
{
    let total = 0;
    let previous = null;
    for (const p of points)
    {
        const angle = Math.atan2(p.y - template.cy, p.x - template.cx);
        if (previous !== null)
        {
            let step = angle - previous;
            if (step > Math.PI)
            {
                step -= 2 * Math.PI;
            }
            else if (step < -Math.PI)
            {
                step += 2 * Math.PI;
            }
            total += step;
        }
        previous = angle;
    }
    return Math.abs(total) / (2 * Math.PI);
}

export function spiralStep(options)
{
    const side = options.side;
    const root = h("div", { class: "step step-capture" });
    const body = h("div", { class: "stack" });
    const canvas = h("canvas", { "aria-label": t("spiral.title"), role: "img" });
    const pad = h("div", { class: "spiral-pad graph-paper" }, canvas);
    const area = h("div", { class: "spiral-area" }, pad);
    const status = h("p", { class: "status-line", role: "status", "aria-live": "polite" }, t("spiral.status.start"));
    const instruction = t("spiral.instruction", { side: sideWord(side) });
    let template = null;
    let points = [];
    let drawing = false;
    let origin = 0;
    let disposed = false;
    let simTimer = null;
    const finishButton = button(t("spiral.finish"), () => finish(), null, { disabled: true });
    const clearButton = button(t("spiral.clear"), () => reset(), "quiet");
    const skipButton = button(t("common.skip"), () => options.onSkip(), "quiet");

    root.appendChild(progressBar(options.progress));
    root.appendChild(h("h1", null, t("spiral.titleSide", { side: sideWord(side) })));
    root.appendChild(body);

    function layout()
    {
        const size = pad.clientWidth || 320;
        template = { cx: size / 2, cy: size / 2, spacing: size / 2 / (TURNS + 0.55), turns: TURNS, size };
    }

    function draw()
    {
        if (!template)
        {
            layout();
        }
        const dims = sizeCanvas(canvas);
        const ctx = canvas.getContext("2d");
        const k = dims.ratio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, dims.width, dims.height);
        ctx.scale(k, k);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#d7e0ec";
        ctx.lineWidth = 12;
        ctx.stroke(new Path2D(spiralPath(template.cx, template.cy, template.spacing, template.turns)));
        ctx.fillStyle = "#18213a";
        ctx.beginPath();
        ctx.arc(template.cx, template.cy, 5, 0, Math.PI * 2);
        ctx.fill();
        if (points.length > 1)
        {
            ctx.strokeStyle = "#2c3fc4";
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++)
            {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.stroke();
        }
    }

    function localPoint(event)
    {
        const rect = canvas.getBoundingClientRect();
        const scaleX = template.size / rect.width;
        const point = { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleX, t: event.timeStamp - origin };
        return point;
    }

    function addPoint(point)
    {
        points.push(point);
        if (points.length % 4 === 0)
        {
            draw();
        }
    }

    function afterStroke()
    {
        drawing = false;
        draw();
        const turns = turnsCovered(points, template);
        finishButton.disabled = turns < 1.5;
        status.textContent = turns < 1.5 ? t("spiral.error.short") : "";
    }

    canvas.addEventListener("pointerdown", (event) =>
    {
        if (!template)
        {
            layout();
        }
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        stopSpeaking();
        if (!drawing && points.length === 0)
        {
            origin = event.timeStamp;
        }
        drawing = true;
        status.textContent = t("spiral.status.drawing");
        addPoint(localPoint(event));
    });
    canvas.addEventListener("pointermove", (event) =>
    {
        if (!drawing)
        {
            return;
        }
        event.preventDefault();
        const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
        for (const item of events.length ? events : [event])
        {
            addPoint(localPoint(item));
        }
    });
    canvas.addEventListener("pointerup", afterStroke);
    canvas.addEventListener("pointercancel", afterStroke);

    function reset()
    {
        points = [];
        drawing = false;
        finishButton.disabled = true;
        status.textContent = t("spiral.status.start");
        draw();
    }

    function finish()
    {
        const result = analyzeSpiral(points, template);
        doneTone();
        if (!result.ok)
        {
            status.textContent = "";
            body.insertBefore(errorBox(t("spiral.error.short")), body.firstChild);
            reset();
            return;
        }
        const drawingRecord = { points: points.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })), template };
        clear(body);
        body.appendChild(spiralBlock(result, side, drawingRecord, { heading: false }));
        body.appendChild(stickyActions(button(options.nextLabel || t("step.next"), () => options.onDone(result, drawingRecord)), button(t("step.again"), () => renderSetup(), "quiet")));
    }

    function simulateDrawing()
    {
        import("../../sim/signals.js").then((signals) =>
        {
            const synthetic = signals.spiralPoints({ cx: template.cx, cy: template.cy, spacing: template.spacing, turns: 2.9, seconds: 6, tremorHz: side === "left" ? 5.4 : 0, tremorPx: side === "left" ? 2.4 : 0 });
            let index = 0;
            const startedAt = performance.now();
            simTimer = window.setInterval(() =>
            {
                const elapsed = performance.now() - startedAt;
                while (index < synthetic.length && synthetic[index].t <= elapsed)
                {
                    points.push(synthetic[index]);
                    index++;
                }
                draw();
                if (index >= synthetic.length)
                {
                    window.clearInterval(simTimer);
                    afterStroke();
                    window.setTimeout(() => finish(), 400);
                }
            }, 30);
        });
    }

    function renderSetup()
    {
        clear(body);
        points = [];
        body.appendChild(h("p", { class: "lede" }, instruction));
        body.appendChild(area);
        body.appendChild(status);
        body.appendChild(stickyActions(finishButton, h("div", { class: "actions-row" }, clearButton, skipButton)));
        status.textContent = t("spiral.status.start");
        finishButton.disabled = true;
        window.requestAnimationFrame(() =>
        {
            layout();
            draw();
            if (isSimulated())
            {
                simulateDrawing();
            }
        });
        speak(instruction);
    }

    options.onCleanup(() =>
    {
        disposed = true;
        if (simTimer)
        {
            window.clearInterval(simTimer);
        }
        stopSpeaking();
    });

    renderSetup();
    return root;
}
