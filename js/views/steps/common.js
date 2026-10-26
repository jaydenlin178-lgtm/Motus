import { h } from "../../ui.js";

export function progressBar(progress)
{
    if (!progress)
    {
        return null;
    }
    const fraction = Math.max(0, Math.min(1, progress.fraction));
    return h("div", { class: "progress" },
        h("div", { class: "progress-label" }, h("span", null, progress.label), progress.right ? h("span", null, progress.right) : null),
        h("div", { class: "progress-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(fraction * 100)) },
            h("div", { class: "progress-fill", style: { width: (fraction * 100).toFixed(1) + "%" } })));
}

export function errorBox(title, body)
{
    return h("div", { class: "error-box", role: "alert" }, h("strong", null, title), body ? h("p", null, body) : null);
}

export function stickyActions(...buttons)
{
    return h("div", { class: "actions actions-sticky" }, buttons);
}

export function button(label, onClick, variant, extra = {})
{
    return h("button", { class: "button" + (variant ? " button-" + variant : ""), type: "button", onClick, ...extra }, label);
}
