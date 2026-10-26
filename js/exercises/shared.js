import { h, sleep } from "../ui.js";
import { t } from "../i18n.js";
import { tick, go } from "../sound.js";

export function phaseLabel(n, total, key)
{
    return h("p", { class: "phase-label" }, h("strong", null, t("ex.part", { n, total })), h("span", null, t(key)));
}

export function countPanel()
{
    const number = h("span", null, "");
    const element = h("div", { class: "count-panel", hidden: true }, number);
    const api =
    {
        element,
        async run(seconds = 3)
        {
            element.hidden = false;
            for (let n = seconds; n > 0; n--)
            {
                number.textContent = String(n);
                tick();
                await sleep(800);
            }
            element.hidden = true;
            go();
        }
    };
    return api;
}

export function meter(options = {})
{
    const fill = h("div", { class: "meter-fill" });
    const target = h("div", { class: "meter-target" });
    const label = h("span", { class: "meter-label" }, "");
    const element = h("div", { class: "level-meter" }, h("div", { class: "meter-track" }, fill, target), label);
    const api =
    {
        element,
        setTarget(fraction)
        {
            target.style.left = (Math.max(0, Math.min(1, fraction)) * 100).toFixed(1) + "%";
            target.hidden = false;
        },
        set(fraction, onTarget, text)
        {
            fill.style.width = (Math.max(0, Math.min(1, fraction)) * 100).toFixed(1) + "%";
            element.classList.toggle("is-on-target", Boolean(onTarget));
            label.textContent = text || "";
        }
    };
    if (options.noTarget)
    {
        target.hidden = true;
    }
    return api;
}

export function percentileOf(values, p)
{
    if (!values.length)
    {
        return NaN;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return sorted[index];
}
