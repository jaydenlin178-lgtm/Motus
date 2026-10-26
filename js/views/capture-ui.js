import { h, sizeCanvas, sleep } from "../ui.js";
import { tick, go } from "../sound.js";

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const FACE_RINGS =
[
    [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
    [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
];
const FACE_LINES = [[70, 63, 105, 66, 107], [336, 296, 334, 293, 300]];
const INK = "#2c3fc4";
const GAP = "#ffe15a";

export function createViewfinder()
{
    const canvas = h("canvas", { "aria-hidden": "true" });
    const statusText = h("span", null, "");
    const status = h("div", { class: "viewfinder-status", role: "status", "aria-live": "polite" }, statusText);
    const countdownText = h("span", null, "");
    const countdown = h("div", { class: "countdown", hidden: true }, countdownText);
    const cueText = h("span", null, "");
    const cue = h("div", { class: "cue", hidden: true }, cueText);
    const loading = h("div", { class: "viewfinder-loading" }, "");
    const element = h("div", { class: "viewfinder" }, canvas, loading, cue, countdown, status);
    const api =
    {
        element,
        canvas,
        setLoading(text)
        {
            loading.textContent = text || "";
            loading.hidden = !text;
        },
        setStatus(text, good)
        {
            statusText.textContent = text || "";
            statusText.classList.toggle("is-good", Boolean(good));
            status.hidden = !text;
        },
        setCue(text)
        {
            cueText.textContent = text || "";
            cue.hidden = !text;
        },
        setCountdown(value)
        {
            countdownText.textContent = value === null ? "" : String(value);
            countdown.hidden = value === null;
        }
    };
    api.setLoading("");
    api.setStatus("");
    return api;
}

export function drawSource(canvas, source)
{
    const size = sizeCanvas(canvas);
    const ctx = canvas.getContext("2d");
    const sw = source.width;
    const sh = source.height;
    const k = Math.max(size.width / sw, size.height / sh);
    const dw = sw * k;
    const dh = sh * k;
    const ox = (size.width - dw) / 2;
    const oy = (size.height - dh) / 2;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.translate(size.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(source.element, ox, oy, dw, dh);
    const view =
    {
        ctx,
        ratio: size.ratio,
        map(point)
        {
            const mapped = { x: ox + point.x * dw, y: oy + point.y * dh };
            return mapped;
        },
        done()
        {
            ctx.restore();
        }
    };
    return view;
}

export function drawHand(view, landmarks, highlightGap)
{
    const ctx = view.ctx;
    const points = landmarks.map((p) => view.map(p));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 5 * view.ratio;
    for (const [a, b] of HAND_CONNECTIONS)
    {
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4 * view.ratio;
    for (const [a, b] of HAND_CONNECTIONS)
    {
        ctx.beginPath();
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
        ctx.stroke();
    }
    if (highlightGap)
    {
        ctx.strokeStyle = GAP;
        ctx.lineWidth = 4 * view.ratio;
        ctx.beginPath();
        ctx.moveTo(points[4].x, points[4].y);
        ctx.lineTo(points[8].x, points[8].y);
        ctx.stroke();
    }
    for (let i = 0; i < points.length; i++)
    {
        const radius = (i === 4 || i === 8) && highlightGap ? 6 : 3.4;
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, radius * view.ratio, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2 * view.ratio;
        ctx.strokeStyle = INK;
        ctx.stroke();
    }
}

export function drawFace(view, landmarks)
{
    const ctx = view.ctx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (indices, closed) =>
    {
        ctx.beginPath();
        indices.forEach((index, k) =>
        {
            const p = view.map(landmarks[index]);
            if (k === 0)
            {
                ctx.moveTo(p.x, p.y);
            }
            else
            {
                ctx.lineTo(p.x, p.y);
            }
        });
        if (closed)
        {
            ctx.closePath();
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 4.5 * view.ratio;
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2 * view.ratio;
        ctx.stroke();
    };
    for (const ring of FACE_RINGS)
    {
        stroke(ring, true);
    }
    for (const line of FACE_LINES)
    {
        stroke(line, false);
    }
}

export async function runCountdown(viewfinder, seconds = 3)
{
    for (let n = seconds; n > 0; n--)
    {
        viewfinder.setCountdown(n);
        tick();
        await sleep(800);
    }
    viewfinder.setCountdown(null);
    go();
}

export function createTimer(totalMs)
{
    const fill = h("div", { class: "timer-fill" });
    const label = h("span", null, "");
    const element = h("div", { class: "timer", "aria-hidden": "true" }, h("div", { class: "timer-track" }, fill), label);
    const api =
    {
        element,
        set(elapsedMs)
        {
            const progress = Math.min(1, elapsedMs / totalMs);
            fill.style.width = (progress * 100).toFixed(1) + "%";
            label.textContent = Math.max(0, Math.ceil((totalMs - elapsedMs) / 1000)) + " s";
        },
        reset()
        {
            fill.style.width = "0%";
            label.textContent = Math.ceil(totalMs / 1000) + " s";
        }
    };
    api.reset();
    return api;
}

export function createLiveTrace(options = {})
{
    const canvas = h("canvas", { "aria-hidden": "true" });
    const element = h("div", { class: "live-trace graph-paper" }, canvas);
    const windowMs = options.windowMs || 10000;
    let points = [];
    const api =
    {
        element,
        clear()
        {
            points = [];
            api.draw();
        },
        push(t, value)
        {
            points.push({ t, value });
            if (points.length > 2000)
            {
                points.shift();
            }
        },
        draw()
        {
            const size = sizeCanvas(canvas);
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, size.width, size.height);
            if (points.length < 2)
            {
                return;
            }
            const maxValue = options.max || Math.max(8, ...points.map((p) => p.value || 0));
            const pad = 8 * size.ratio;
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.2 * size.ratio;
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.beginPath();
            let pen = false;
            for (const p of points)
            {
                if (p.value === null || !isFinite(p.value))
                {
                    pen = false;
                    continue;
                }
                const x = pad + (p.t / windowMs) * (size.width - 2 * pad);
                const y = size.height - pad - (p.value / maxValue) * (size.height - 2 * pad);
                if (pen)
                {
                    ctx.lineTo(x, y);
                }
                else
                {
                    ctx.moveTo(x, y);
                    pen = true;
                }
            }
            ctx.stroke();
        }
    };
    return api;
}
