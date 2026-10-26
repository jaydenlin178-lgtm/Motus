import { h, s } from "../ui.js";
import { icon, spiralPath } from "../icons.js";
import { t } from "../i18n.js";
import { getState, latestScreening } from "../store.js";

function wobblySpiral(cx, cy, spacing, turns)
{
    const steps = Math.round(turns * 140);
    let d = "";
    for (let i = 0; i <= steps; i++)
    {
        const progress = i / steps;
        const angle = progress * turns * 2 * Math.PI;
        const wobble = Math.max(0, progress - 0.55) * 4.2 * Math.sin(angle * 9);
        const radius = spacing * angle / (2 * Math.PI) + wobble;
        d += (i === 0 ? "M" : "L") + (cx + radius * Math.cos(angle)).toFixed(2) + " " + (cy + radius * Math.sin(angle)).toFixed(2);
    }
    return d;
}

function hero()
{
    const svg = s("svg", { viewBox: "0 0 640 300", role: "img", "aria-hidden": "true", focusable: "false" });
    const cx = 320;
    const cy = 150;
    svg.appendChild(s("path", { class: "hero-guide", d: spiralPath(cx, cy, 34, 3.6) }));
    const trace = s("path", { class: "hero-trace", d: wobblySpiral(cx, cy, 34, 3.6) });
    svg.appendChild(trace);
    svg.appendChild(s("circle", { cx, cy, r: 4, fill: "#18213a" }));
    const draw = () =>
    {
        trace.classList.add("is-drawing");
    };
    window.requestAnimationFrame(() =>
    {
        const length = trace.getTotalLength ? trace.getTotalLength() : 2000;
        trace.style.strokeDasharray = String(length);
        trace.style.strokeDashoffset = String(length);
        const splash = document.getElementById("splash");
        if (splash && !splash.classList.contains("is-done"))
        {
            window.addEventListener("motus:splash-done", draw, { once: true });
        }
        else
        {
            window.requestAnimationFrame(draw);
        }
    });
    return h("div", { class: "hero graph-paper" }, svg);
}

function pathOption(iconName, title, sub, href)
{
    return h("a", { class: "path-option", href },
        h("span", { class: "path-icon" }, icon(iconName)),
        h("span", { class: "path-text" }, h("strong", null, title), h("span", null, sub)),
        icon("next", "path-chevron"));
}

export function homeView()
{
    const state = getState();
    const inProgress = state.screening && !state.screening.completedAt && (state.screening.age || Object.keys(state.screening.answers).length > 0);
    const last = latestScreening();
    const extras = [];
    if (inProgress)
    {
        extras.push(h("a", { class: "button button-secondary", href: "#/screen" }, t("home.resume")));
    }
    if (last)
    {
        extras.push(h("a", { class: "button button-quiet", href: "#/results" }, t("home.last")));
    }
    return h("div", { class: "home" },
        hero(),
        h("h1", { class: "home-title" }, t("home.title")),
        h("p", { class: "lede", style: { marginTop: "12px" } }, t("home.lede")),
        h("div", { class: "paths" },
            pathOption("clipboard", t("home.screen.title"), t("home.screen.sub"), "#/screen?new=1"),
            pathOption("chart", t("home.track.title"), t("home.track.sub"), "#/track"),
            pathOption("walk", t("home.exercise.title"), t("home.exercise.sub"), "#/exercises")),
        extras.length ? h("div", { class: "actions", style: { marginTop: "14px" } }, extras) : null,
        h("div", { class: "fine-print" },
            h("p", null, icon("shield"), h("span", null, t("home.privacy"))),
            h("p", null, icon("info"), h("span", null, t("home.notDiagnosis"))),
            h("p", null, icon("speaker"), h("span", null, t("home.voiceNote")))));
}
