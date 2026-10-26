import { h, toast, formatNumber } from "../ui.js";
import { icon } from "../icons.js";
import { t, currentLang, dayLabel, formatHour, formatDate } from "../i18n.js";
import { getState, update, newId } from "../store.js";
import { scatterChart } from "../charts.js";
import { readout, panel } from "./result-blocks.js";
import { checkSpeed, checkTremor, hoursSinceDose, baseline, doseCurve, doseDomain, exampleData, TIME } from "../track-data.js";
import { mean } from "../dsp.js";

function fmt(value, digits)
{
    return formatNumber(value, digits, currentLang());
}

function sortedTrack()
{
    const track = getState().track;
    const checks = track.checks.slice().sort((a, b) => a.at - b.at);
    const doses = track.doses.slice().sort((a, b) => a.at - b.at);
    const data = { checks, doses, hasExample: checks.some((c) => c.example) || doses.some((d) => d.example) };
    return data;
}

function startOfDay(timestamp)
{
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

function dayAxis(firstDay, lastAt)
{
    const days = Math.max(1, Math.floor((startOfDay(lastAt) - firstDay) / TIME.DAY) + 1);
    const every = Math.max(1, Math.ceil(days / 5));
    const ticks = [];
    for (let day = 0; day < days; day += every)
    {
        ticks.push(day + 0.5);
    }
    const axis =
    {
        domain: [0, days],
        ticks,
        format: (x) => formatDate(firstDay + Math.floor(x) * TIME.DAY + 12 * TIME.HOUR, false).replace(/,? \d{4}$/, "")
    };
    return axis;
}

function dosePanel(onClose)
{
    const log = (minutesAgo) =>
    {
        update((draft) =>
        {
            draft.track.doses.push({ id: newId(), at: Date.now() - minutesAgo * 60000 });
        });
        toast(t("track.dose.saved"));
        onClose(true);
    };
    const options = [["track.dose.now", 0], ["track.dose.30", 30], ["track.dose.60", 60], ["track.dose.120", 120]];
    return h("div", { class: "panel graph-paper dose-panel" },
        h("h3", null, t("track.dose.when")),
        h("div", { class: "dose-grid" }, options.map(([key, minutes]) => h("button", { class: "button button-secondary", type: "button", onClick: () => log(minutes) }, t(key)))),
        h("button", { class: "button button-quiet", type: "button", onClick: () => onClose(false) }, t("track.dose.cancel")));
}

function summaryReadouts(checks)
{
    const latest = checks[checks.length - 1];
    const base = baseline(checks);
    const latestSpeed = checkSpeed(latest);
    const weekCount = checks.filter((c) => c.at >= Date.now() - 7 * TIME.DAY).length;
    const items = [readout(t("track.latest"), fmt(latestSpeed, 1), t("m.speed.unit"), false)];
    if (base)
    {
        const change = (latestSpeed - base.mean) / base.mean * 100;
        items.push(readout(t("track.change"), (change >= 0 ? "+" : "−") + fmt(Math.abs(change), 0), "%", false));
    }
    items.push(readout(t("track.week"), String(weekCount), null, false));
    return h("div", { class: "readouts section" + (items.length === 3 ? " readouts-3" : "") }, items);
}

function dayChart(checks)
{
    const base = baseline(checks);
    const firstDay = startOfDay(checks[0].at);
    const axis = dayAxis(firstDay, checks[checks.length - 1].at);
    const points = checks.map((check) =>
    {
        const point =
        {
            x: (check.at - firstDay) / TIME.DAY,
            y: checkSpeed(check),
            tip: [fmt(checkSpeed(check), 1) + " " + t("m.speed.unit"), dayLabel(check.at) + ", " + formatHour(check.at)]
        };
        return point;
    }).filter((p) => isFinite(p.y));
    const byDay = new Map();
    for (const point of points)
    {
        const day = Math.floor(point.x);
        if (!byDay.has(day))
        {
            byDay.set(day, []);
        }
        byDay.get(day).push(point.y);
    }
    const dailyMeans = Array.from(byDay.entries()).sort((a, b) => a[0] - b[0]).map(([day, values]) => ({ x: day + 0.5, y: mean(values) }));
    const legend = [{ kind: "dot", label: t("chart.each") }];
    if (dailyMeans.length > 1)
    {
        legend.push({ kind: "line", label: t("chart.dailyAverage") });
    }
    if (base)
    {
        legend.push({ kind: "baseline", label: t("track.baseline") });
    }
    return panel(t("track.byDay"), t("m.speed.unit"), scatterChart(
    {
        points,
        curve: dailyMeans,
        band: base ? [base.low, base.high] : null,
        xDomain: axis.domain,
        xTicks: axis.ticks,
        xFormat: axis.format,
        yFormat: (y) => fmt(y, 1),
        height: 200
    }), legend);
}

function doseChart(checks, doses)
{
    const points = checks.map((check) =>
    {
        const hours = hoursSinceDose(check, doses);
        const point =
        {
            x: hours,
            y: checkSpeed(check),
            tip: [fmt(checkSpeed(check), 1) + " " + t("m.speed.unit"), t("track.afterDose", { n: fmt(hours, 1) })]
        };
        return point;
    }).filter((p) => p.x !== null && isFinite(p.y));
    if (points.length < 6)
    {
        return h("div", { class: "section" }, h("h3", null, t("track.byDose")), h("p", { class: "quiet", style: { marginTop: "8px" } }, t("track.needMore")));
    }
    return h("div", { class: "section stack" },
        panel(t("track.byDose"), t("m.speed.unit"), scatterChart(
        {
            points,
            curve: doseCurve(points),
            xDomain: doseDomain(points),
            xLabel: t("track.hoursAxis"),
            yFormat: (y) => fmt(y, 1),
            height: 210
        }), [{ kind: "dot", label: t("chart.each") }, { kind: "line", label: t("chart.averageCurve") }]),
        h("p", { class: "result-note" }, t("track.byDose.note")));
}

function tremorChart(checks)
{
    const firstDay = startOfDay(checks[0].at);
    const axis = dayAxis(firstDay, checks[checks.length - 1].at);
    const points = checks.map((check) =>
    {
        const size = checkTremor(check);
        const point = { x: (check.at - firstDay) / TIME.DAY, y: size, tip: [fmt(size, 1) + " mm", dayLabel(check.at) + ", " + formatHour(check.at)] };
        return point;
    }).filter((p) => isFinite(p.y));
    if (points.length < 3)
    {
        return null;
    }
    return h("div", { class: "section" }, panel(t("track.tremorByDay"), "mm", scatterChart(
    {
        points,
        xDomain: axis.domain,
        xTicks: axis.ticks,
        xFormat: axis.format,
        yDomain: [0, Math.max(2, ...points.map((p) => p.y)) * 1.15],
        yFormat: (y) => fmt(y, 0),
        height: 170
    })));
}

function history(checks, doses)
{
    const recent = checks.slice(-8).reverse();
    return h("div", { class: "section" },
        h("h3", { style: { marginBottom: "10px" } }, t("track.history")),
        h("ul", { class: "log-list" }, recent.map((check) =>
        {
            const hours = hoursSinceDose(check, doses);
            return h("li", null,
                h("span", { class: "when" }, dayLabel(check.at) + ", " + formatHour(check.at)),
                h("span", { class: "value" }, fmt(checkSpeed(check), 1) + " " + t("m.speed.unit")),
                h("span", { class: "what" }, hours === null ? t("track.noDose") : t("track.afterDose", { n: fmt(hours, 1) })));
        })));
}

export function trackView(context)
{
    const { checks, doses, hasExample } = sortedTrack();
    const doseHolder = h("div");
    const doseButton = h("button", { class: "button button-secondary", type: "button" }, icon("pill"), t("track.dose"));
    doseButton.addEventListener("click", () =>
    {
        doseHolder.replaceChildren(dosePanel((saved) =>
        {
            doseHolder.replaceChildren();
            if (saved)
            {
                context.rerender();
            }
        }));
    });
    const header = h("div", { class: "stack" },
        h("h1", null, t("track.title")),
        h("p", { class: "lede" }, t("track.lede")),
        hasExample ? h("p", null, h("span", { class: "example-tag" }, t("track.example.tag"))) : null);
    const actions = h("div", { class: "actions" },
        h("a", { class: "button", href: "#/track/check" }, icon("hand"), t("track.check")),
        doseButton,
        doseHolder);
    const sections = [];
    if (checks.length === 0)
    {
        sections.push(h("p", { class: "quiet section" }, t("track.empty")));
    }
    else
    {
        sections.push(summaryReadouts(checks));
        if (checks.length >= 3)
        {
            sections.push(h("div", { class: "section" }, dayChart(checks)));
        }
        sections.push(doseChart(checks, doses));
        sections.push(tremorChart(checks));
        sections.push(history(checks, doses));
    }
    const exampleButton = h("button", { class: "button button-quiet", type: "button" }, hasExample ? t("track.example.remove") : t("track.example.load"));
    exampleButton.addEventListener("click", () =>
    {
        update((draft) =>
        {
            if (hasExample)
            {
                draft.track.checks = draft.track.checks.filter((c) => !c.example);
                draft.track.doses = draft.track.doses.filter((d) => !d.example);
            }
            else
            {
                const data = exampleData();
                draft.track.checks = draft.track.checks.concat(data.checks);
                draft.track.doses = draft.track.doses.concat(data.doses);
            }
        });
        context.rerender();
    });
    return h("div", { class: "track" },
        header,
        actions,
        sections,
        h("div", { class: "actions section-rule" },
            checks.length ? h("a", { class: "button button-secondary", href: "#/report/track" }, icon("print"), t("track.report")) : null,
            exampleButton));
}
