import { h, clear, formatNumber, sizeCanvas } from "../ui.js";
import { t, currentLang } from "../i18n.js";
import { isSimulated } from "../env.js";
import { done as doneTone } from "../sound.js";
import { speak, stopSpeaking } from "../speech.js";
import { stickyActions, button } from "../views/steps/common.js";
import { phaseLabel } from "./shared.js";
import { letterSizes, shrinkPct } from "../analysis/handwriting.js";

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

export const writing =
{
    id: "writing",
    icon: "pen",
    digits: 0,
    safety: false,
    run(api)
    {
        const body = api.body;
        const canvas = h("canvas", { "aria-label": t("ex.writing.title"), role: "img" });
        const pad = h("div", { class: "writing-pad" }, canvas);
        const label = h("div");
        const instruction = h("p", { class: "lede" }, "");
        const status = h("p", { class: "status-line" }, "");
        const finish = button(t("ex.writing.finish"), () => finishRound(), null, { disabled: true });
        const clearButton = button(t("spiral.clear"), () => reset(), "quiet");
        let round = 1;
        let points = [];
        let drawing = false;
        let origin = 0;
        let guide = null;
        let natural = null;
        let simTimer = null;

        api.onCleanup(() =>
        {
            if (simTimer)
            {
                window.clearInterval(simTimer);
            }
        });

        function size()
        {
            const rect = canvas.getBoundingClientRect();
            const dims = { width: rect.width || 320, height: rect.height || 200 };
            return dims;
        }

        function draw()
        {
            const dims = sizeCanvas(canvas);
            const ctx = canvas.getContext("2d");
            const k = dims.ratio;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, dims.width, dims.height);
            ctx.scale(k, k);
            const box = size();
            if (guide)
            {
                ctx.strokeStyle = "#2c3fc4";
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 6]);
                for (const y of [guide.top, guide.bottom])
                {
                    ctx.beginPath();
                    ctx.moveTo(10, y);
                    ctx.lineTo(box.width - 10, y);
                    ctx.stroke();
                }
                ctx.setLineDash([]);
            }
            ctx.strokeStyle = "#18213a";
            ctx.lineWidth = 2.6;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            let previous = null;
            for (const p of points)
            {
                if (previous && !p.start)
                {
                    ctx.beginPath();
                    ctx.moveTo(previous.x, previous.y);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                }
                previous = p;
            }
        }

        function localPoint(event, start)
        {
            const rect = canvas.getBoundingClientRect();
            const point = { x: event.clientX - rect.left, y: event.clientY - rect.top, t: event.timeStamp - origin, start };
            return point;
        }

        canvas.addEventListener("pointerdown", (event) =>
        {
            event.preventDefault();
            canvas.setPointerCapture(event.pointerId);
            stopSpeaking();
            if (points.length === 0)
            {
                origin = event.timeStamp;
            }
            drawing = true;
            points.push(localPoint(event, true));
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
                points.push(localPoint(item, false));
            }
            draw();
        });
        const lift = () =>
        {
            drawing = false;
            draw();
            finish.disabled = points.length < 40;
        };
        canvas.addEventListener("pointerup", lift);
        canvas.addEventListener("pointercancel", lift);

        function reset()
        {
            points = [];
            finish.disabled = true;
            status.textContent = "";
            draw();
        }

        function simulate()
        {
            const box = size();
            const cy = box.height / 2;
            const loops = 9;
            const total = 160;
            let i = 0;
            simTimer = window.setInterval(() =>
            {
                for (let step = 0; step < 4 && i <= total; step++, i++)
                {
                    const u = i / total;
                    const amplitude = guide ? (guide.bottom - guide.top) * 0.96 : box.height * (0.42 - 0.2 * u);
                    const x = box.width * (0.07 + 0.86 * u);
                    const y = (guide ? guide.bottom : cy + box.height * 0.2) - amplitude * Math.abs(Math.sin(Math.PI * loops * u));
                    points.push({ x, y, t: i * 30, start: i === 0 });
                }
                draw();
                if (i > total)
                {
                    window.clearInterval(simTimer);
                    simTimer = null;
                    finish.disabled = false;
                    window.setTimeout(() => finishRound(), 300);
                }
            }, 30);
        }

        function render()
        {
            clear(body);
            clear(label);
            label.appendChild(phaseLabel(round, 2, round === 1 ? "ex.writing.part1" : "ex.writing.part2"));
            instruction.textContent = round === 1 ? t("ex.writing.measure") : t("ex.writing.practice");
            body.appendChild(label);
            body.appendChild(instruction);
            body.appendChild(pad);
            body.appendChild(status);
            body.appendChild(stickyActions(finish, clearButton));
            points = [];
            finish.disabled = true;
            window.requestAnimationFrame(() =>
            {
                draw();
                if (isSimulated())
                {
                    simulate();
                }
            });
            speak(instruction.textContent);
        }

        function finishRound()
        {
            const box = size();
            const sizes = letterSizes(points, box.width);
            if (!sizes)
            {
                status.textContent = t("ex.writing.error");
                return;
            }
            doneTone();
            if (round === 1)
            {
                natural = sizes;
                const height = Math.min(box.height * 0.6, Math.max(box.height * 0.35, sizes[0]));
                guide = { top: box.height / 2 - height / 2, bottom: box.height / 2 + height / 2 };
                round = 2;
                render();
                return;
            }
            const height = guide.bottom - guide.top;
            const kept = sizes.reduce((sum, value) => sum + Math.min(1, value / height), 0) / sizes.length * 100;
            api.finish(
            {
                score: kept,
                highlights:
                [
                    [t("ex.writing.scoreLabel"), fmt(kept, 0), "%", false],
                    [t("ex.writing.shrinkBefore"), fmt(shrinkPct(natural), 0), "%", shrinkPct(natural) >= 25],
                    [t("ex.writing.shrinkAfter"), fmt(shrinkPct(sizes), 0), "%", shrinkPct(sizes) >= 25]
                ],
                note: t("ex.writing.note"),
                details: { natural, guided: sizes, guideHeight: height }
            });
        }

        render();
    }
};
