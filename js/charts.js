import { h, s, clear } from "./ui.js";
import { spiralPath } from "./icons.js";

const MARGIN = { top: 16, right: 14, bottom: 38, left: 44 };

export function niceTicks(min, max, count = 4)
{
    if (!isFinite(min) || !isFinite(max) || min === max)
    {
        const single = [isFinite(min) ? min : 0];
        return single;
    }
    const span = max - min;
    const rough = span / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const residual = rough / magnitude;
    let step = magnitude;
    if (residual > 5)
    {
        step = 10 * magnitude;
    }
    else if (residual > 2)
    {
        step = 5 * magnitude;
    }
    else if (residual > 1)
    {
        step = 2 * magnitude;
    }
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step)
    {
        ticks.push(Math.round(v / step) * step);
    }
    return ticks;
}

export function ticksAtLeast(min, max, count = 4)
{
    let ticks = niceTicks(min, max, count);
    let tries = count;
    while (ticks.length < 3 && tries < 12)
    {
        tries += 2;
        ticks = niceTicks(min, max, tries);
    }
    return ticks;
}

function scale(domainMin, domainMax, rangeMin, rangeMax)
{
    const span = domainMax - domainMin || 1;
    return (value) => rangeMin + (value - domainMin) / span * (rangeMax - rangeMin);
}

function defaultFormat(value)
{
    if (!isFinite(value))
    {
        return "";
    }
    const abs = Math.abs(value);
    const digits = abs >= 10 || Number.isInteger(value) ? 0 : 1;
    return value.toFixed(digits);
}

export function mountChart(container, render)
{
    container.classList.add("chart-host");
    container.style.position = "relative";
    let lastWidth = 0;
    const draw = () =>
    {
        const width = Math.round(container.clientWidth);
        if (!width || width === lastWidth)
        {
            return;
        }
        lastWidth = width;
        clear(container);
        container.appendChild(render(width));
    };
    if ("ResizeObserver" in window)
    {
        const observer = new ResizeObserver(draw);
        observer.observe(container);
    }
    window.requestAnimationFrame(draw);
    return container;
}

function tooltipLayer(svg)
{
    const tip = h("div", { class: "chart-tip", role: "status", "aria-live": "polite" });
    const wrapper = h("div", { class: "chart-frame" }, svg, tip);
    const show = (x, y, primary, secondary, width) =>
    {
        tip.textContent = "";
        tip.appendChild(h("strong", null, primary));
        if (secondary)
        {
            tip.appendChild(h("span", null, secondary));
        }
        tip.classList.add("is-visible");
        const left = Math.min(Math.max(8, x - 60), width - 128);
        tip.style.left = left + "px";
        tip.style.top = Math.max(0, y - 58) + "px";
    };
    const hide = () =>
    {
        tip.classList.remove("is-visible");
    };
    const layer = { wrapper, show, hide };
    return layer;
}

function axes(svg, options)
{
    const { width, height, x, y, xTicks, yTicks, xFormat, yFormat, xLabel, yLabel } = options;
    const bottom = height - MARGIN.bottom;
    svg.appendChild(s("line", { class: "axis-line", x1: MARGIN.left, x2: width - MARGIN.right, y1: bottom + 0.5, y2: bottom + 0.5 }));
    for (const tick of xTicks)
    {
        const px = x(tick);
        svg.appendChild(s("line", { class: "axis-line", x1: px, x2: px, y1: bottom, y2: bottom + 4 }));
        svg.appendChild(s("text", { x: px, y: bottom + 17, "text-anchor": "middle" }, (xFormat || defaultFormat)(tick)));
    }
    for (const tick of yTicks)
    {
        const py = y(tick);
        svg.appendChild(s("text", { x: MARGIN.left - 8, y: py + 4, "text-anchor": "end" }, (yFormat || defaultFormat)(tick)));
    }
    if (xLabel)
    {
        svg.appendChild(s("text", { x: (MARGIN.left + width - MARGIN.right) / 2, y: height - 4, "text-anchor": "middle", class: "axis-title" }, xLabel));
    }
    if (yLabel)
    {
        svg.appendChild(s("text", { x: MARGIN.left - 8, y: MARGIN.top - 4, "text-anchor": "start", class: "axis-title", transform: "translate(" + (-MARGIN.left + 12) + " 0)" }, yLabel));
    }
}

function pathFrom(xs, ys, x, y)
{
    let d = "";
    let pen = false;
    for (let i = 0; i < xs.length; i++)
    {
        if (!isFinite(xs[i]) || !isFinite(ys[i]))
        {
            pen = false;
            continue;
        }
        d += (pen ? "L" : "M") + x(xs[i]).toFixed(1) + " " + y(ys[i]).toFixed(1);
        pen = true;
    }
    return d;
}

export function lineChart(options)
{
    return (width) =>
    {
        const height = options.height || 170;
        const xs = options.xs;
        const ys = options.ys;
        const finiteY = ys.filter((v) => isFinite(v));
        const xMin = options.xMin !== undefined ? options.xMin : Math.min(...xs);
        const xMax = options.xMax !== undefined ? options.xMax : Math.max(...xs);
        const yMin = options.yMin !== undefined ? options.yMin : Math.min(...finiteY);
        const yMax = options.yMax !== undefined ? options.yMax : Math.max(...finiteY) * 1.08;
        const x = scale(xMin, xMax, MARGIN.left, width - MARGIN.right);
        const y = scale(yMin, yMax, height - MARGIN.bottom, MARGIN.top);
        const svg = s("svg", { class: "chart", viewBox: "0 0 " + width + " " + height, width, height, role: "img", "aria-label": options.label || "" });
        if (options.band)
        {
            const [b0, b1] = options.band;
            svg.appendChild(s("rect", { class: "band", x: x(b0), y: MARGIN.top, width: Math.max(0, x(b1) - x(b0)), height: height - MARGIN.top - MARGIN.bottom }));
        }
        axes(svg, { width, height, x, y, xTicks: options.xTicks || niceTicks(xMin, xMax, 5), yTicks: options.yTicks || ticksAtLeast(yMin, yMax, 3), xFormat: options.xFormat, yFormat: options.yFormat, xLabel: options.xLabel, yLabel: options.yLabel });
        if (options.area)
        {
            const d = pathFrom(xs, ys, x, y);
            if (d)
            {
                svg.appendChild(s("path", { class: "area", d: d + "L" + x(xs[xs.length - 1]).toFixed(1) + " " + y(yMin).toFixed(1) + "L" + x(xs[0]).toFixed(1) + " " + y(yMin).toFixed(1) + "Z" }));
            }
        }
        svg.appendChild(s("path", { class: "trace", d: pathFrom(xs, ys, x, y) }));
        for (const marker of options.markers || [])
        {
            svg.appendChild(s("circle", { class: "dot", cx: x(marker.x), cy: y(marker.y), r: 4.5, stroke: "#ffffff", "stroke-width": 2 }));
            if (marker.label)
            {
                const anchor = x(marker.x) > width * 0.7 ? "end" : "start";
                svg.appendChild(s("text", { class: "marker-label", x: x(marker.x) + (anchor === "end" ? -10 : 10), y: y(marker.y) + 4, "text-anchor": anchor }, marker.label));
            }
        }
        const hair = s("line", { class: "axis-line", x1: 0, x2: 0, y1: MARGIN.top, y2: height - MARGIN.bottom, visibility: "hidden" });
        const focus = s("circle", { class: "dot", r: 4.5, stroke: "#ffffff", "stroke-width": 2, visibility: "hidden" });
        svg.appendChild(hair);
        svg.appendChild(focus);
        const layer = tooltipLayer(svg);
        const move = (event) =>
        {
            const rect = svg.getBoundingClientRect();
            const px = (event.clientX - rect.left) * (width / rect.width);
            let best = -1;
            let bestDistance = Infinity;
            for (let i = 0; i < xs.length; i++)
            {
                if (!isFinite(ys[i]))
                {
                    continue;
                }
                const distance = Math.abs(x(xs[i]) - px);
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    best = i;
                }
            }
            if (best < 0)
            {
                return;
            }
            const cx = x(xs[best]);
            const cy = y(ys[best]);
            hair.setAttribute("x1", cx);
            hair.setAttribute("x2", cx);
            hair.setAttribute("visibility", "visible");
            focus.setAttribute("cx", cx);
            focus.setAttribute("cy", cy);
            focus.setAttribute("visibility", "visible");
            const tip = options.tooltip ? options.tooltip(xs[best], ys[best]) : [defaultFormat(ys[best]), defaultFormat(xs[best])];
            layer.show(cx, cy, tip[0], tip[1], width);
        };
        const leave = () =>
        {
            hair.setAttribute("visibility", "hidden");
            focus.setAttribute("visibility", "hidden");
            layer.hide();
        };
        svg.addEventListener("pointermove", move);
        svg.addEventListener("pointerdown", move);
        svg.addEventListener("pointerleave", leave);
        return layer.wrapper;
    };
}

function roundedBar(x0, x1, yTop, yBase, radius)
{
    const r = Math.min(radius, (x1 - x0) / 2, Math.max(0, yBase - yTop));
    return "M" + x0 + " " + yBase + "L" + x0 + " " + (yTop + r) + "Q" + x0 + " " + yTop + " " + (x0 + r) + " " + yTop + "L" + (x1 - r) + " " + yTop + "Q" + x1 + " " + yTop + " " + x1 + " " + (yTop + r) + "L" + x1 + " " + yBase + "Z";
}

export function barChart(options)
{
    return (width) =>
    {
        const height = options.height || 170;
        const values = options.values;
        const yMax = options.yMax || Math.max(...values) * 1.15 || 1;
        const y = scale(0, yMax, height - MARGIN.bottom, MARGIN.top);
        const plotWidth = width - MARGIN.left - MARGIN.right;
        const band = plotWidth / Math.max(1, values.length);
        const barWidth = Math.max(2, Math.min(24, band - 2));
        const centerOf = (i) => MARGIN.left + band * i + band / 2;
        const svg = s("svg", { class: "chart", viewBox: "0 0 " + width + " " + height, width, height, role: "img", "aria-label": options.label || "" });
        const tickEvery = Math.max(1, Math.ceil(values.length / 8));
        const xTicks = [];
        for (let i = 0; i < values.length; i += tickEvery)
        {
            xTicks.push(i);
        }
        axes(svg,
        {
            width,
            height,
            x: (i) => centerOf(i),
            y,
            xTicks,
            yTicks: ticksAtLeast(0, yMax, 3),
            xFormat: (i) => String(i + 1),
            yFormat: options.yFormat,
            xLabel: options.xLabel,
            yLabel: options.yLabel
        });
        const bars = [];
        values.forEach((value, i) =>
        {
            const cx = centerOf(i);
            const bar = s("path", { class: "bar", d: roundedBar(cx - barWidth / 2, cx + barWidth / 2, y(value), height - MARGIN.bottom, 4) });
            svg.appendChild(bar);
            bars.push(bar);
        });
        if (options.fit)
        {
            const first = options.fit.intercept;
            const last = options.fit.intercept + options.fit.slope * (values.length - 1);
            svg.appendChild(s("line", { class: "fit-line" + (options.flagged ? " is-flagged" : ""), x1: centerOf(0), x2: centerOf(values.length - 1), y1: y(first), y2: y(last) }));
        }
        const layer = tooltipLayer(svg);
        values.forEach((value, i) =>
        {
            const hit = s("rect", { x: centerOf(i) - band / 2, y: MARGIN.top, width: band, height: height - MARGIN.top - MARGIN.bottom, fill: "transparent" });
            const enter = () =>
            {
                bars.forEach((bar, k) => bar.setAttribute("opacity", k === i ? "1" : "0.55"));
                const tip = options.tooltip ? options.tooltip(i, value) : [defaultFormat(value), String(i + 1)];
                layer.show(centerOf(i), y(value), tip[0], tip[1], width);
            };
            hit.addEventListener("pointerenter", enter);
            hit.addEventListener("pointerdown", enter);
            svg.appendChild(hit);
        });
        svg.addEventListener("pointerleave", () =>
        {
            bars.forEach((bar) => bar.setAttribute("opacity", "1"));
            layer.hide();
        });
        return layer.wrapper;
    };
}

export function scatterChart(options)
{
    return (width) =>
    {
        const height = options.height || 190;
        const points = options.points;
        const xMin = options.xDomain ? options.xDomain[0] : Math.min(...points.map((p) => p.x));
        const xMax = options.xDomain ? options.xDomain[1] : Math.max(...points.map((p) => p.x));
        const ys = points.map((p) => p.y);
        const yMin = options.yDomain ? options.yDomain[0] : Math.min(...ys) * 0.9;
        const yMax = options.yDomain ? options.yDomain[1] : Math.max(...ys) * 1.1;
        const x = scale(xMin, xMax, MARGIN.left + 6, width - MARGIN.right - 6);
        const y = scale(yMin, yMax, height - MARGIN.bottom - 8, MARGIN.top);
        const svg = s("svg", { class: "chart", viewBox: "0 0 " + width + " " + height, width, height, role: "img", "aria-label": options.label || "" });
        if (options.band)
        {
            svg.appendChild(s("rect", { class: "baseline-band", x: MARGIN.left, width: width - MARGIN.left - MARGIN.right, y: y(options.band[1]), height: Math.max(0, y(options.band[0]) - y(options.band[1])) }));
        }
        axes(svg,
        {
            width,
            height,
            x,
            y,
            xTicks: options.xTicks || niceTicks(xMin, xMax, 5),
            yTicks: ticksAtLeast(yMin, yMax, 3),
            xFormat: options.xFormat,
            yFormat: options.yFormat,
            xLabel: options.xLabel,
            yLabel: options.yLabel
        });
        if (options.curve && options.curve.length > 1)
        {
            svg.appendChild(s("path", { class: "trace", d: pathFrom(options.curve.map((p) => p.x), options.curve.map((p) => p.y), x, y) }));
        }
        const dots = [];
        for (const point of points)
        {
            const dot = s("circle", { class: point.hollow ? "dot-hollow" : "dot", cx: x(point.x), cy: y(point.y), r: 4.5, stroke: point.hollow ? null : "#ffffff", "stroke-width": point.hollow ? null : 2 });
            svg.appendChild(dot);
            dots.push(dot);
        }
        const layer = tooltipLayer(svg);
        points.forEach((point, i) =>
        {
            const hit = s("circle", { cx: x(point.x), cy: y(point.y), r: 13, fill: "transparent" });
            const enter = () =>
            {
                dots.forEach((dot, k) => dot.setAttribute("r", k === i ? "6.5" : "4.5"));
                if (point.tip)
                {
                    layer.show(x(point.x), y(point.y), point.tip[0], point.tip[1], width);
                }
            };
            hit.addEventListener("pointerenter", enter);
            hit.addEventListener("pointerdown", enter);
            svg.appendChild(hit);
        });
        svg.addEventListener("pointerleave", () =>
        {
            dots.forEach((dot) => dot.setAttribute("r", "4.5"));
            layer.hide();
        });
        return layer.wrapper;
    };
}

export function spiralFigure(points, template, size = 280)
{
    const svg = s("svg", { class: "chart", viewBox: "0 0 " + template.size + " " + template.size, width: size, height: size, role: "img" });
    svg.appendChild(s("path", { d: spiralPath(template.cx, template.cy, template.spacing, template.turns), fill: "none", stroke: "#d7e0ec", "stroke-width": 10, "stroke-linecap": "round" }));
    let d = "";
    points.forEach((p, i) =>
    {
        d += (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1);
    });
    svg.appendChild(s("path", { d, fill: "none", stroke: "#2c3fc4", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return svg;
}
