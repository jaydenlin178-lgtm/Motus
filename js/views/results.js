import { h } from "../ui.js";
import { icon } from "../icons.js";
import { t, sideWord, formatDate } from "../i18n.js";
import { speak } from "../speech.js";
import { latestScreening } from "../store.js";
import { computeScreening } from "../screening.js";
import { tappingBlock, tremorBlock, faceBlock, voiceBlock, spiralBlock } from "./result-blocks.js";

function verdictKeys(summary)
{
    const tier = summary.tier;
    if (summary.mode === "risk")
    {
        const keys = { title: "tier." + tier + ".title", body: "tier." + tier + ".body", next: "tier." + tier + ".next" };
        return keys;
    }
    const keys =
    {
        title: tier >= 2 ? "tier.motor2.title" : "tier.motor1.title",
        body: tier >= 2 ? "tier.motor2.body" : null,
        next: tier >= 2 ? "tier.2.next" : "tier.1.next"
    };
    return keys;
}

function verdictScale(tier)
{
    const steps = [1, 2, 3].map((level) =>
    {
        let state = "";
        if (level < tier)
        {
            state = " is-past";
        }
        else if (level === tier)
        {
            state = " is-current";
        }
        return h("div", { class: "verdict-step" + state }, h("span", { class: "verdict-bar" }), h("span", { class: "verdict-label" }, t("verdict.scale." + level)));
    });
    return h("div", { class: "verdict-scale", role: "img", "aria-label": t("verdict.scale.label", { n: tier, label: t("verdict.scale." + tier) }) }, steps);
}

function verdict(summary)
{
    const keys = verdictKeys(summary);
    return h("section", { class: "verdict graph-paper", "data-tier": String(summary.tier), "aria-live": "polite" },
        verdictScale(summary.tier),
        h("h2", null, t(keys.title)),
        keys.body ? h("p", null, t(keys.body)) : null,
        summary.mode === "motor" ? h("p", { class: "quiet" }, t("tier.young")) : null,
        h("p", { class: "next-step" }, t(keys.next)),
        h("div", { class: "verdict-actions" }, h("a", { class: "button", href: "#/report/screen" }, icon("print"), t("results.report"))));
}

function strengthKey(lr)
{
    const size = Math.abs(Math.log(lr));
    if (size >= Math.log(2.5))
    {
        return "strength.strong";
    }
    if (size >= Math.log(1.5))
    {
        return "strength.moderate";
    }
    return "strength.small";
}

function factorList(titleKey, items, direction)
{
    if (!items.length)
    {
        return null;
    }
    return h("div", { class: "section" },
        h("h3", null, t(titleKey)),
        h("div", { class: "factor-list" }, items.map((item) => h("div", { class: "factor-row is-" + direction },
            icon(direction === "up" ? "raised" : "lowered"),
            h("strong", null, t(item.labelKey, item.labelParams)),
            h("span", { class: "factor-strength" }, t(strengthKey(item.lr)))))));
}

function noteList(items)
{
    if (!items.length)
    {
        return null;
    }
    return h("div", { class: "section" },
        h("h3", null, t("results.noted")),
        h("div", null, items.map((item) => h("div", { class: "finding is-lowered" },
            icon("info"),
            h("div", null, h("strong", null, t(item.labelKey, item.labelParams)), item.noteKey ? h("p", null, t(item.noteKey)) : null)))));
}

function movementFindings(motor)
{
    const items = motor.flags.map((flag) =>
    {
        const sides = flag.sides && flag.sides.length ? flag.sides.map((side) => sideWord(side)).join(", ") : null;
        return h("div", { class: "finding is-flagged" },
            icon("flag"),
            h("div", null, h("strong", null, t("flag." + flag.id)), sides ? h("p", null, sides) : null));
    });
    return h("div", { class: "section" },
        h("h3", null, t("results.movement")),
        items.length ? h("div", null, items) : h("div", { class: "finding is-clear" }, icon("check"), h("div", null, h("strong", null, t("results.noFlags")))),
        h("p", { class: "result-note" }, t("results.motorRule")));
}

export function resultsView()
{
    const screening = latestScreening();
    if (!screening)
    {
        return h("div", { class: "stack" },
            h("h1", null, t("results.title")),
            h("p", null, t("results.none")),
            h("div", { class: "actions" }, h("a", { class: "button", href: "#/screen?new=1" }, t("home.screen.title"))));
    }
    const summary = computeScreening(screening);
    const results = screening.results || {};
    speak(t(verdictKeys(summary).title));
    return h("div", { class: "results" },
        h("div", { class: "stack-tight" },
            h("h1", null, t("results.title")),
            h("p", { class: "quiet" }, formatDate(screening.completedAt || screening.startedAt, false) + ". " + t("results.disclaimer"))),
        h("div", { class: "results-verdict" }, verdict(summary)),
        h("div", { class: "section-rule" },
            h("h2", null, t("results.shaped")),
            summary.mode === "risk" ? h("p", { class: "result-note" }, t("results.shapedNote")) : null,
            factorList("results.raised", summary.raised, "up"),
            factorList("results.lowered", summary.lowered, "down"),
            noteList(summary.notes),
            movementFindings(summary.motor)),
        h("div", { class: "section-rule" },
            h("h2", null, t("results.details")),
            tappingBlock(results.tapRight, "right"),
            tappingBlock(results.tapLeft, "left"),
            tremorBlock(results.tremorRest, results.tremorPosture),
            faceBlock(results.face),
            voiceBlock(results.voice),
            spiralBlock(results.spiralRight, "right", results.spiralRightDrawing),
            spiralBlock(results.spiralLeft, "left", results.spiralLeftDrawing)),
        h("div", { class: "actions section-rule" },
            h("a", { class: "button button-secondary", href: "#/report/screen" }, icon("print"), t("results.report")),
            h("a", { class: "button button-quiet", href: "#/screen?new=1" }, t("results.new"))));
}
